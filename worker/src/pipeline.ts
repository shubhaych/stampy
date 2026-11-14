/**
 * The loop, step by step. Each step is deterministic code; Claude only reads documents and runs the call.
 *   upload → read documents → detect conflicts → draft request email (a caseworker approves sending)
 *   call ends → detect → checklist email (promised on the call) or recompute
 *   reply arrives → read attachments → detect → recompute when nothing is open → caseworker decides
 * Work on one case is serialized so webhooks arriving together cannot interleave.
 */
import type { Question } from '@stampy/contracts/stampy';
import type { Db, Q } from './db';
import { tx } from './db';
import { env } from './env';
import { id } from './ids';
import { audit } from './core/audit';
import { AI, SYSTEM, assertCan, type Identity } from './core/authz';
import { consume, LimitError } from './core/limits';
import { detect, listQuestions } from './ledger/detector';
import { listFacts } from './ledger/facts';
import { readDocument } from './reader/reader';
import { HttpError, addDocument, getCaseRow, latestRecompute, setStatus, touch } from './cases/service';
import { checklistEmail, requestEmail } from './email/templates';
import { downloadAttachment, ensureInbox, replyTo, sendMessage, type AmMessage } from './email/agentmail';
import { callInNumber } from './voice/vapi';
import { benefitFor, describe, engineName, filedInputs, resolvedInputs } from './rules/benefit';

/* ---------------- per-case serialization ---------------- */
const chains = new Map<string, Promise<unknown>>();
export function onCase<T>(caseId: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(caseId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  const settled = next.then(() => undefined, () => undefined);
  chains.set(caseId, settled);
  void settled.then(() => { if (chains.get(caseId) === settled) chains.delete(caseId); });
  return next;
}

const log = (...a: unknown[]) => console.log('[pipeline]', ...a);

/* ---------------- documents ---------------- */

export async function readAndDetect(db: Db, caseId: string, docIds: string[]): Promise<void> {
  await Promise.all(docIds.map((d) => readDocument(db, d).then((r) => log(`read ${d}: ${r.ok ? `${r.kind}, ${r.facts} facts` : r.error}`))));
  await afterEvidence(db, caseId, 'documents');
}

/** Run the detector and move the case forward. `trigger` says what just happened. */
export async function afterEvidence(db: Db, caseId: string, trigger: 'documents' | 'call' | 'reply' | 'manual'): Promise<void> {
  const c = await getCaseRow(db, caseId);
  if (c.status === 'approved' || c.status === 'rejected') return;
  const res = await detect(db, caseId, { state: c.state, createdAt: c.created_at });
  const questions = await listQuestions(db, caseId);
  const open = questions.filter((q) => q.status === 'open');
  log(`${caseId} after ${trigger}: opened ${res.opened.length}, closed ${res.closed.length}, open ${open.length}`);

  const docs = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM document WHERE case_id=$1 AND read_status IN ('pending','reading')`, [caseId]);
  if (docs.rows[0]!.n > 0) return; // still reading

  if (open.length) {
    await setStatus(db, caseId, 'questions_open');
    if (trigger === 'documents') await draftRequest(db, caseId, questions);
    if (trigger === 'call') await maybeSendChecklist(db, caseId, questions);
    return;
  }
  await recompute(db, caseId);
}

/* ---------------- outreach ---------------- */

async function draftRequest(db: Q, caseId: string, questions: Question[]): Promise<void> {
  const exists = await db.query(`SELECT 1 FROM outreach WHERE case_id=$1 AND kind='request'`, [caseId]);
  if (exists.rows.length) return;
  const c = await getCaseRow(db, caseId);
  const { subject, text } = requestEmail({ name: c.applicant_name, refCode: c.ref_code, phone: callInNumber(), questions });
  const oid = id('OUT');
  await db.query(`INSERT INTO outreach (id, case_id, kind, to_addr, subject, body_text, status) VALUES ($1,$2,'request',$3,$4,$5,'draft')`, [oid, caseId, c.applicant_email, subject, text]);
  await audit(db, { caseId, who: AI, kind: 'ai', action: 'email.drafted', entity: 'outreach', entityId: oid, data: { kind: 'request', questions: questions.filter((q) => q.status === 'open').map((q) => q.id) } });
}

function allowed(to: string): boolean {
  return !env.EMAIL_ALLOWED_RECIPIENTS.length || env.EMAIL_ALLOWED_RECIPIENTS.map((x) => x.toLowerCase()).includes(to.toLowerCase());
}

/** Deliver an outreach row through AgentMail (live) or record it as simulated (fixture). */
async function deliver(db: Q, outreachId: string): Promise<void> {
  const o = (await db.query(`SELECT * FROM outreach WHERE id=$1`, [outreachId])).rows[0];
  const c = await getCaseRow(db, o.case_id);
  const simulated = env.EMAIL_MODE !== 'live' || !allowed(o.to_addr);
  try {
    if (simulated) {
      await db.query(`UPDATE outreach SET status='simulated', sent_at=now(), error=$2 WHERE id=$1`, [o.id, env.EMAIL_MODE === 'live' ? `${o.to_addr} is not in EMAIL_ALLOWED_RECIPIENTS` : null]);
    } else {
      await consume(db, 'email', env.EMAIL_DAILY_LIMIT);
      const sent = o.kind === 'checklist' && c.email_last_message_id
        ? await replyTo(c.email_last_message_id, o.body_text)
        : await sendMessage(o.to_addr, o.subject, o.body_text);
      await db.query(`UPDATE outreach SET status='sent', sent_at=now(), agentmail_message_id=$2, thread_id=$3 WHERE id=$1`, [o.id, sent.message_id, sent.thread_id]);
      await db.query(`UPDATE app_case SET email_thread_id=coalesce(email_thread_id,$2), email_last_message_id=$3, updated_at=now() WHERE id=$1`, [c.id, sent.thread_id, sent.message_id]);
    }
    await audit(db, { caseId: c.id, who: SYSTEM, kind: 'outreach', action: 'email.sent', entity: 'outreach', entityId: o.id, data: { kind: o.kind, simulated, to: o.to_addr } });
  } catch (e) {
    const msg = e instanceof LimitError ? e.message : (e as Error).message.slice(0, 300);
    await db.query(`UPDATE outreach SET status='failed', error=$2 WHERE id=$1`, [o.id, msg]);
    await audit(db, { caseId: c.id, who: SYSTEM, kind: 'outreach', action: 'email.failed', entity: 'outreach', entityId: o.id, data: { kind: o.kind, error: msg } });
    throw new HttpError(502, `Email not sent: ${msg}`);
  }
}

/** A caseworker approves the drafted request email; only then is it sent. */
export async function approveAndSendRequest(db: Db, caseId: string, who: Identity): Promise<void> {
  assertCan(who, 'outreach.approve');
  const o = (await db.query(`SELECT * FROM outreach WHERE case_id=$1 AND kind='request' ORDER BY created_at DESC LIMIT 1`, [caseId])).rows[0];
  if (!o) throw new HttpError(409, 'There is no drafted request email for this case.');
  if (o.status === 'sent' || o.status === 'simulated') throw new HttpError(409, 'The request email was already sent.');
  // Refresh the call-in number in case the phone line was set up after the draft.
  const c = await getCaseRow(db, caseId);
  const { subject, text } = requestEmail({ name: c.applicant_name, refCode: c.ref_code, phone: callInNumber(), questions: await listQuestions(db, caseId) });
  await db.query(`UPDATE outreach SET approved_by=$2, subject=$3, body_text=$4, status='draft', error=NULL WHERE id=$1`, [o.id, who.id, subject, text]);
  await audit(db, { caseId, who, kind: 'human', action: 'email.approved', entity: 'outreach', entityId: o.id, data: { kind: 'request' } });
  await deliver(db, o.id);
}

async function maybeSendChecklist(db: Q, caseId: string, questions: Question[]): Promise<void> {
  const stillNeeded = questions.filter((q) => q.channel === 'document' && q.status === 'open');
  if (!stillNeeded.length) return;
  const already = await db.query(`SELECT 1 FROM outreach WHERE case_id=$1 AND kind='checklist' AND status IN ('sent','simulated','draft')`, [caseId]);
  if (already.rows.length) return;
  const c = await getCaseRow(db, caseId);
  const closed = questions.filter((q) => q.channel === 'phone' && q.status === 'closed');
  const { text } = checklistEmail({ name: c.applicant_name, refCode: c.ref_code, closed, stillNeeded });
  const oid = id('OUT');
  const subject = `Re: your food assistance application (ref ${c.ref_code.slice(0, 3)} ${c.ref_code.slice(3)}): what to send`;
  await db.query(`INSERT INTO outreach (id, case_id, kind, to_addr, subject, body_text, status, approved_by) VALUES ($1,$2,'checklist',$3,$4,$5,'draft',$6)`,
    [oid, caseId, c.applicant_email, subject, text, env.AUTO_SEND_CHECKLIST ? 'promised on the call' : null]);
  await audit(db, { caseId, who: SYSTEM, kind: 'outreach', action: 'email.drafted', entity: 'outreach', entityId: oid, data: { kind: 'checklist', stillNeeded: stillNeeded.map((q) => q.id) } });
  if (env.AUTO_SEND_CHECKLIST) await deliver(db, oid).catch((e) => log(`checklist not sent: ${(e as Error).message}`));
}

/* ---------------- inbound email ---------------- */

const SUPPORTED = /^(image\/(png|jpe?g|gif|webp)|application\/pdf)$/;

/** Handle a reply from AgentMail (websocket or webhook). Idempotent on message_id. */
export async function onInboundEmail(db: Db, m: AmMessage, opts: { simulated?: boolean; attachments?: { filename: string; contentType: string; bytes: Buffer }[] } = {}): Promise<{ inboundId: string | null; caseId: string | null }> {
  const fromAddr = (m.from.match(/<([^>]+)>/)?.[1] ?? m.from).trim().toLowerCase();
  const ib = opts.simulated ? null : await ensureInbox(false).catch(() => null);
  if (ib && fromAddr === (ib.email ?? '').toLowerCase()) return { inboundId: null, caseId: null }; // our own message
  const body = m.extracted_text ?? m.text ?? '';
  // Match by thread, then by a reference number in the subject/body, then by sender address.
  const ref = `${m.subject ?? ''} ${body}`.match(/\b(\d{3})\s?(\d{3})\b/);
  const c =
    (await db.query(`SELECT id FROM app_case WHERE email_thread_id=$1 LIMIT 1`, [m.thread_id])).rows[0] ??
    (ref ? (await db.query(`SELECT id FROM app_case WHERE ref_code=$1 LIMIT 1`, [ref[1]! + ref[2]!])).rows[0] : undefined) ??
    (await db.query(`SELECT id FROM app_case WHERE applicant_email=$1 ORDER BY created_at DESC LIMIT 1`, [fromAddr])).rows[0];
  const caseId: string | null = c?.id ?? null;
  const inboundId = id('IN');
  const ins = await db.query(
    `INSERT INTO inbound_email (id, case_id, agentmail_message_id, thread_id, from_addr, subject, body_text, attachment_count, simulated)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (agentmail_message_id) DO NOTHING RETURNING id`,
    [inboundId, caseId, m.message_id, m.thread_id, fromAddr, m.subject ?? null, body.slice(0, 5000), (opts.attachments ?? m.attachments ?? []).length, !!opts.simulated],
  );
  if (!ins.rows[0]) return { inboundId: null, caseId }; // duplicate delivery
  if (!caseId) { log(`inbound ${m.message_id} from ${fromAddr} matched no case`); return { inboundId, caseId: null }; }

  return onCase(caseId, async () => {
    await db.query(`UPDATE app_case SET email_last_message_id=$2, updated_at=now() WHERE id=$1`, [caseId, m.message_id]);
    const applicant: Identity = { id: `applicant:${fromAddr}`, role: 'applicant' };
    await audit(db, { caseId, who: applicant, kind: 'outreach', action: 'email.received', entity: 'inbound_email', entityId: inboundId, data: { attachments: (opts.attachments ?? m.attachments ?? []).length, simulated: !!opts.simulated } });
    const docIds: string[] = [];
    const files = opts.attachments ?? [];
    if (!opts.attachments) {
      for (const a of m.attachments ?? []) {
        try {
          files.push(await downloadAttachment(m.inbox_id, m.message_id, a.attachment_id));
        } catch (e) {
          log(`attachment ${a.attachment_id} failed: ${(e as Error).message}`);
        }
      }
    }
    for (const f of files) {
      if (!SUPPORTED.test(f.contentType)) { log(`skipping ${f.filename} (${f.contentType})`); continue; }
      docIds.push(await addDocument(db, { caseId, filename: f.filename, contentType: f.contentType, bytes: f.bytes, source: 'email', sourceRef: m.message_id }, applicant));
    }
    await Promise.all(docIds.map((d) => readDocument(db, d)));
    await afterEvidence(db, caseId, 'reply');
    return { inboundId, caseId };
  });
}

/* ---------------- recompute and decision ---------------- */

export async function recompute(db: Q, caseId: string): Promise<void> {
  const c = await getCaseRow(db, caseId);
  const facts = await listFacts(db, caseId);
  const questions = await listQuestions(db, caseId);
  const filed = filedInputs(facts, c.state, c.created_at.slice(0, 10));
  if (!filed) {
    await setStatus(db, caseId, 'needs_person');
    await audit(db, { caseId, who: SYSTEM, kind: 'rules', action: 'recompute.skipped', entity: 'app_case', entityId: caseId, data: { reason: 'the application form is missing pay amount or frequency' } });
    return;
  }
  const resolved = resolvedInputs(facts, questions, filed);
  const t = Date.now();
  const [before, after] = await Promise.all([
    benefitFor(filed, `As filed: ${describe(filed)}`),
    benefitFor(resolved, `From resolved evidence: ${describe(resolved)}`),
  ]);
  const rid = id('RC');
  await db.query(`INSERT INTO recompute (id, case_id, engine, inputs, before, after, ms) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [rid, caseId, engineName(), JSON.stringify({ filed, resolved }), JSON.stringify(before), JSON.stringify(after), Date.now() - t]);
  await setStatus(db, caseId, 'ready_for_review');
  await audit(db, { caseId, who: SYSTEM, kind: 'rules', action: 'recompute.done', entity: 'recompute', entityId: rid, data: { before: { incomeMonthly: before.incomeMonthly, benefitMonthly: before.benefitMonthly }, after: { incomeMonthly: after.incomeMonthly, benefitMonthly: after.benefitMonthly } } });
}

export async function decide(db: Db, caseId: string, who: Identity, action: 'approve' | 'reject', note: string | null): Promise<void> {
  assertCan(who, action === 'approve' ? 'change.approve' : 'change.reject');
  await tx(db, async (t) => {
    const c = await getCaseRow(t, caseId);
    if (c.status !== 'ready_for_review') throw new HttpError(409, `The case is ${c.status.replace(/_/g, ' ')}, not ready for review.`);
    const rc = await latestRecompute(t, caseId);
    const did = id('DEC');
    await t.query(`INSERT INTO decision (id, case_id, action, recompute_id, decided_by, note) VALUES ($1,$2,$3,$4,$5,$6)`, [did, caseId, action, rc?.id ?? null, who.id, note]);
    await setStatus(t, caseId, action === 'approve' ? 'approved' : 'rejected');
    await audit(t, { caseId, who, kind: 'human', action: `decision.${action}`, entity: 'decision', entityId: did, data: { recomputeId: rc?.id ?? null, note } });
  });
}

export async function touchCase(db: Q, caseId: string): Promise<void> {
  await touch(db, caseId);
}
