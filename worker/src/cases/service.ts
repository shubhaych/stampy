/** Cases: create from an upload, store documents, and assemble the bundle the caseworker page renders. */
import type { Call, CaseBundleV2, CaseSummary, Decision, DocumentMeta, InboundEmail, Outreach, Recompute } from '@stampy/contracts/stampy';
import type { Q } from '../db';
import { id, refCode } from '../ids';
import { env } from '../env';
import { audit, readAudit } from '../core/audit';
import type { Identity } from '../core/authz';
import { listFacts } from '../ledger/facts';
import { listQuestions } from '../ledger/detector';
import { sampleBySha, sha256 } from '../reader/samples';

export class HttpError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503, message: string) {
    super(message);
  }
}

export function normalizePhone(raw: string): string {
  const d = raw.replace(/[^\d+]/g, '');
  if (/^\+\d{8,15}$/.test(d)) return d;
  const digits = d.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  throw new HttpError(422, 'Enter a phone number with area code, like (415) 555-0123.');
}

export async function createCase(db: Q, input: { name: string; email: string; phone: string; state?: string }): Promise<{ id: string; refCode: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new HttpError(422, 'Name is required.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(422, 'Enter a valid email address.');
  const phone = normalizePhone(input.phone);
  const n = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM app_case`)).rows[0]!.n;
  for (let attempt = 0; attempt < 5; attempt++) {
    const caseId = `STP-${1001 + n + attempt}`;
    const code = refCode();
    const r = await db.query(
      `INSERT INTO app_case (id, ref_code, applicant_name, applicant_email, applicant_phone, state) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
      [caseId, code, name, email, phone, (input.state ?? 'CA').toUpperCase().slice(0, 2)],
    );
    if (r.rows[0]) {
      await audit(db, { caseId, who: { id: `applicant:${email}`, role: 'applicant' }, kind: 'source', action: 'case.created', entity: 'app_case', entityId: caseId, data: { refCode: code } });
      return { id: caseId, refCode: code };
    }
  }
  throw new HttpError(500, 'could not allocate a case id');
}

export async function addDocument(db: Q, input: { caseId: string; filename: string; contentType: string; bytes: Buffer; source: 'upload' | 'email'; sourceRef?: string | null }, who: Identity): Promise<string> {
  if (input.bytes.length > 15 * 1024 * 1024) throw new HttpError(422, `${input.filename} is larger than 15 MB.`);
  const sha = sha256(input.bytes);
  const sample = sampleBySha(sha);
  const docId = id('DOC');
  const ct = input.contentType === 'image/jpg' ? 'image/jpeg' : input.contentType;
  await db.query(
    `INSERT INTO document (id, case_id, filename, content_type, bytes, sha256, synthetic, source, source_ref, kind) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [docId, input.caseId, input.filename, ct, input.bytes, sha, !!sample, input.source, input.sourceRef ?? null, sample?.kind ?? 'unknown'],
  );
  await audit(db, { caseId: input.caseId, who, kind: 'source', action: 'document.received', entity: 'document', entityId: docId, data: { docId, source: input.source, filename: input.filename, synthetic: !!sample } });
  return docId;
}

export interface CaseRow {
  id: string; ref_code: string; applicant_name: string; applicant_email: string; applicant_phone: string; state: string;
  status: CaseSummary['status']; email_thread_id: string | null; email_last_message_id: string | null; created_at: string; updated_at: string;
}

export async function getCaseRow(db: Q, caseId: string): Promise<CaseRow> {
  const r = await db.query<CaseRow>(`SELECT * FROM app_case WHERE id = $1`, [caseId]);
  if (!r.rows[0]) throw new HttpError(404, `case ${caseId} not found`);
  return r.rows[0];
}

export async function setStatus(db: Q, caseId: string, status: CaseSummary['status']): Promise<void> {
  await db.query(`UPDATE app_case SET status=$2, updated_at=now() WHERE id=$1`, [caseId, status]);
}

export async function touch(db: Q, caseId: string): Promise<void> {
  await db.query(`UPDATE app_case SET updated_at=now() WHERE id=$1`, [caseId]);
}

export async function listCases(db: Q): Promise<CaseSummary[]> {
  const r = await db.query(
    `SELECT c.*, (SELECT count(*)::int FROM open_question q WHERE q.case_id=c.id AND q.status <> 'closed') AS open_questions,
            (SELECT count(*)::int FROM document d WHERE d.case_id=c.id) AS documents
     FROM app_case c ORDER BY c.created_at DESC LIMIT 200`,
  );
  return r.rows.map(rowToSummary);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSummary(x: any): CaseSummary {
  return {
    id: x.id, refCode: x.ref_code, applicantName: x.applicant_name, applicantEmail: x.applicant_email, applicantPhone: x.applicant_phone,
    state: x.state, status: x.status, createdAt: x.created_at, updatedAt: x.updated_at, openQuestions: x.open_questions ?? 0, documents: x.documents ?? 0,
  };
}

export async function latestRecompute(db: Q, caseId: string): Promise<Recompute | null> {
  const r = await db.query(`SELECT * FROM recompute WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`, [caseId]);
  const x = r.rows[0];
  return x ? { id: x.id, caseId: x.case_id, engine: x.engine, before: x.before, after: x.after, ms: x.ms, createdAt: x.created_at } : null;
}

export async function getBundle(db: Q, caseId: string, extras: { phoneNumber: string | null; modes: CaseBundleV2['modes'] }): Promise<CaseBundleV2> {
  const c = await db.query(
    `SELECT c.*, (SELECT count(*)::int FROM open_question q WHERE q.case_id=c.id AND q.status <> 'closed') AS open_questions,
            (SELECT count(*)::int FROM document d WHERE d.case_id=c.id) AS documents FROM app_case c WHERE c.id=$1`,
    [caseId],
  );
  if (!c.rows[0]) throw new HttpError(404, `case ${caseId} not found`);
  const [docs, facts, questions, outreach, inbound, calls, recompute, decision, auditRows] = await Promise.all([
    db.query(`SELECT id, case_id, kind, filename, content_type, synthetic, source, read_status, read_error, summary, received_at FROM document WHERE case_id=$1 ORDER BY received_at, id`, [caseId]),
    listFacts(db, caseId),
    listQuestions(db, caseId),
    db.query(`SELECT * FROM outreach WHERE case_id=$1 ORDER BY created_at`, [caseId]),
    db.query(`SELECT * FROM inbound_email WHERE case_id=$1 ORDER BY received_at`, [caseId]),
    db.query(`SELECT * FROM call WHERE case_id=$1 ORDER BY started_at`, [caseId]),
    latestRecompute(db, caseId),
    db.query(`SELECT * FROM decision WHERE case_id=$1 ORDER BY at DESC LIMIT 1`, [caseId]),
    readAudit(db, caseId),
  ]);
  return {
    case: rowToSummary(c.rows[0]),
    documents: docs.rows.map((x): DocumentMeta => ({
      id: x.id, caseId: x.case_id, kind: x.kind, filename: x.filename, contentType: x.content_type, synthetic: x.synthetic, source: x.source,
      readStatus: x.read_status, readError: x.read_error, summary: x.summary, receivedAt: x.received_at,
    })),
    facts,
    questions,
    outreach: outreach.rows.map((x): Outreach => ({
      id: x.id, caseId: x.case_id, kind: x.kind, toAddr: x.to_addr, subject: x.subject, bodyText: x.body_text, status: x.status,
      threadId: x.thread_id, error: x.error, approvedBy: x.approved_by, createdAt: x.created_at, sentAt: x.sent_at,
    })),
    inbound: inbound.rows.map((x): InboundEmail => ({
      id: x.id, caseId: x.case_id, fromAddr: x.from_addr, subject: x.subject, bodyText: x.body_text, attachmentCount: x.attachment_count, simulated: x.simulated, receivedAt: x.received_at,
    })),
    calls: calls.rows.map(rowToCall),
    recompute,
    decision: decision.rows[0]
      ? ((x): Decision => ({ id: x.id, caseId: x.case_id, action: x.action, recomputeId: x.recompute_id, decidedBy: x.decided_by, note: x.note, at: x.at }))(decision.rows[0])
      : null,
    audit: auditRows,
    phoneNumber: extras.phoneNumber,
    modes: extras.modes,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToCall(x: any): Call {
  const msgs = (Array.isArray(x.messages) ? x.messages : []) as { role: string; message?: string; text?: string; secondsFromStart?: number }[];
  return {
    id: x.id, caseId: x.case_id, fromNumber: x.from_number, verified: x.verified, simulated: x.simulated, status: x.status,
    startedAt: x.started_at, endedAt: x.ended_at, endedReason: x.ended_reason,
    turns: msgs
      .filter((m) => m.role === 'assistant' || m.role === 'bot' || m.role === 'user' || m.role === 'caller')
      .map((m): Call['turns'][number] => ({ role: m.role === 'user' || m.role === 'caller' ? 'caller' : 'assistant', text: m.message ?? m.text ?? '', atSeconds: typeof m.secondsFromStart === 'number' ? Math.round(m.secondsFromStart * 10) / 10 : null }))
      .filter((t) => t.text.trim()),
    recordingUrl: x.recording_url, callbackRequested: x.callback_requested,
  };
}

export { env };
