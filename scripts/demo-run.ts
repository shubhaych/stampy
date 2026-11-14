/**
 * npm run demo:run — rehearse the whole loop live, end to end, and stop at "ready for review".
 * The caseworker's approve/reject stays a human click on /cases/<id>.
 *
 *  1. File a case with the sample documents (Claude reads them; questions open).
 *  2. Approve and send the request email (AgentMail → the test applicant inbox).
 *  3. Replay the phone call through the public Vapi webhook (same payloads Vapi sends), or --sim-call
 *     to use the in-process simulated call.
 *  4. The test applicant inbox replies in the thread with the October paystub photo attached
 *     (AgentMail → websocket → Claude reads the attachment).
 *  5. Wait for the recompute.
 *
 * Flags: --email=<applicant email> (default stampy-applicant-test@agentmail.to, created if missing),
 *        --phone=+1..., --sim-call, --worker=http://localhost:8787
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, envValue } from './lib';

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const W = arg('worker', `http://localhost:${envValue('WORKER_PORT') || 8787 + Number(envValue('SLOT') || 0)}`);
const applicant = arg('email', 'stampy-applicant-test@agentmail.to');
const phone = arg('phone', '+14155550123');
const simCall = process.argv.includes('--sim-call');
const AM = 'https://api.agentmail.to/v0';
const amKey = envValue('AGENTMAIL_API_KEY');
const secret = envValue('STAMPY_WEBHOOK_SECRET');
const worker = { name: 'Rehearsal', code: envValue('DEMO_WORKER_CODE') || 'stampy-worker' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const step = (s: string) => console.log(`\n▸ ${s}`);

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const t = await r.text();
  if (!r.ok) throw new Error(`${init?.method ?? 'GET'} ${url} → ${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t) as T;
}
const am = <T>(path: string, init: RequestInit = {}) =>
  json<T>(`${AM}${path}`, { ...init, headers: { authorization: `Bearer ${amKey}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Bundle = any;
const bundle = (id: string) => json<Bundle>(`${W}/cases/${id}`);
async function waitFor(id: string, what: string, pred: (b: Bundle) => boolean, timeoutMs = 180_000): Promise<Bundle> {
  const t = Date.now();
  for (;;) {
    const b = await bundle(id);
    if (pred(b)) return b;
    if (Date.now() - t > timeoutMs) throw new Error(`timed out waiting for ${what} (status ${b.case.status})`);
    await sleep(2000);
  }
}

const status = await json<{ modes: Record<string, string>; publicUrl: string | null; phoneNumber: string | null; inboxEmail: string | null }>(`${W}/status`);
console.log(`worker ${W}: ${JSON.stringify(status.modes)}  phone ${status.phoneNumber}  inbox ${status.inboxEmail}  public ${status.publicUrl}`);
const liveEmail = status.modes.email === 'live';

if (liveEmail && applicant.endsWith('@agentmail.to')) {
  const list = await am<{ inboxes: { inbox_id: string; email?: string }[] }>('/inboxes?limit=50');
  if (!list.inboxes.some((i) => (i.email ?? i.inbox_id) === applicant)) {
    await am('/inboxes', { method: 'POST', body: JSON.stringify({ username: applicant.split('@')[0], display_name: 'Lena Torres Test Applicant' }) });
    console.log(`created test applicant inbox ${applicant}`);
  }
}

step('1. Applicant uploads the application form, September paystub and lease');
const form = new FormData();
form.set('applicantName', 'Lena Torres');
form.set('applicantEmail', applicant);
form.set('applicantPhone', phone);
form.set('samples', 'application-form,paystub-2026-09,lease');
const created = await json<{ id: string; refCode: string }>(`${W}/cases`, { method: 'POST', body: form });
console.log(`case ${created.id}, reference ${created.refCode}`);
let b = await waitFor(created.id, 'documents read', (x) => x.case.status !== 'reading' && x.documents.every((d: Bundle) => !['pending', 'reading'].includes(d.readStatus)) && x.outreach.length > 0);
for (const q of b.questions) console.log(`  ? ${q.title} (${q.kind}): ${q.status}${q.stakeMonthly != null ? `, ${q.stakeMonthly}/mo at stake, ${q.direction}` : ''}`);

step('2. Caseworker approves the drafted request email; it is sent');
await json(`${W}/cases/${created.id}/outreach/request/send`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ worker }) });
b = await bundle(created.id);
console.log(`  request email: ${b.outreach.find((o: Bundle) => o.kind === 'request').status}`);

step(`3. Applicant calls in (${simCall || !status.publicUrl ? 'simulated in-process' : 'Vapi webhook replay through the tunnel'})`);
if (simCall || !status.publicUrl) {
  await json(`${W}/cases/${created.id}/simulate/call`, { method: 'POST' });
} else {
  const url = `${status.publicUrl}/webhooks/vapi`;
  const headers = { 'content-type': 'application/json', ...(secret ? { 'x-stampy-secret': secret } : {}) };
  const call = { id: `rehearsal-${Date.now()}`, customer: { number: phone } };
  const send = (message: object) => json<{ results?: { result: string }[] }>(url, { method: 'POST', headers, body: JSON.stringify({ message: { call, customer: call.customer, ...message } }) });
  await send({ type: 'assistant-request' });
  const v = await send({ type: 'tool-calls', toolCallList: [{ id: 't1', type: 'function', function: { name: 'verify_caller', arguments: { reference_code: created.refCode } } }] });
  const verified = JSON.parse(v.results![0]!.result) as { questions: { question_id: string; ask: string }[] };
  console.log(`  verified; asks: ${verified.questions.map((q) => q.ask).join(' | ')}`);
  for (const q of verified.questions) {
    const r = await send({ type: 'tool-calls', toolCallList: [{ id: `t-${q.question_id}`, type: 'function', function: { name: 'record_answer', arguments: JSON.stringify({ question_id: q.question_id, answer: 'every two weeks', caller_quote: 'Oh, every two weeks. Every other Friday.' }) } }] });
    console.log(`  ${r.results![0]!.result}`);
  }
  await send({ type: 'end-of-call-report', endedReason: 'customer-ended-call', artifact: { transcript: '(rehearsal replay)', messages: [
    { role: 'bot', message: 'Hi, thanks for calling. I am an automated AI assistant and this call is recorded. You can ask for a person to call you back at any time. Please say your reference number.', secondsFromStart: 0.4 },
    { role: 'user', message: `It's ${created.refCode.split('').join(' ')}.`, secondsFromStart: 12.6 },
    { role: 'bot', message: 'How often are you paid: every week, every two weeks, twice a month, or once a month?', secondsFromStart: 31.6 },
    { role: 'user', message: 'Oh, every two weeks. Every other Friday.', secondsFromStart: 42.0 },
    { role: 'bot', message: "Got it. I'll email you a checklist for the paystub. Thanks for calling.", secondsFromStart: 47.1 },
  ] } });
}
b = await waitFor(created.id, 'checklist email', (x) => x.outreach.some((o: Bundle) => o.kind === 'checklist' && o.status !== 'draft'), 60_000);
for (const q of b.questions) console.log(`  ${q.title}: ${q.status}${q.closedNote ? ` (${q.closedNote})` : ''}`);
console.log(`  checklist email: ${b.outreach.find((o: Bundle) => o.kind === 'checklist').status}`);

step('4. Applicant replies in the thread with a photo of the October paystub');
if (liveEmail && applicant.endsWith('@agentmail.to')) {
  let checklistMsg: { message_id: string } | undefined;
  for (let i = 0; i < 20 && !checklistMsg; i++) {
    const msgs = await am<{ messages: { message_id: string; subject?: string; preview?: string }[] }>(`/inboxes/${encodeURIComponent(applicant)}/messages?limit=10`);
    checklistMsg = msgs.messages.find((m) => (m.preview ?? '').includes('Thanks for calling') && (m.subject ?? '').includes(`${created.refCode.slice(0, 3)} ${created.refCode.slice(3)}`));
    if (!checklistMsg) await sleep(2000);
  }
  if (!checklistMsg) throw new Error('the checklist email did not arrive in the applicant inbox');
  const photo = readFileSync(join(ROOT, 'data/samples/paystub-2026-10-photo.jpg')).toString('base64');
  await am(`/inboxes/${encodeURIComponent(applicant)}/messages/${encodeURIComponent(checklistMsg.message_id)}/reply`, {
    method: 'POST',
    body: JSON.stringify({ text: 'Here is my October paystub. Thanks!', attachments: [{ filename: 'IMG_2041.jpg', content_type: 'image/jpeg', content: photo }] }),
  });
  console.log('  reply sent with IMG_2041.jpg');
} else {
  await json(`${W}/cases/${created.id}/simulate/reply`, { method: 'POST' });
  console.log('  simulated reply injected');
}

step('5. Claude reads the attachment, questions close, PolicyEngine recomputes');
b = await waitFor(created.id, 'recompute', (x) => x.case.status === 'ready_for_review' || x.case.status === 'needs_person', 240_000);
for (const q of b.questions) console.log(`  ${q.title}: ${q.status}${q.closedNote ? ` (${q.closedNote})` : ''}`);
if (b.recompute) {
  const { before, after } = b.recompute;
  console.log(`  income  $${before.incomeMonthly} → $${after.incomeMonthly} a month`);
  console.log(`  benefit $${before.benefitMonthly} → $${after.benefitMonthly} a month  (${b.recompute.engine}, ${b.recompute.ms} ms)`);
}
console.log(`\nStatus: ${b.case.status}. The caseworker decides at http://localhost:${3000 + Number(envValue('SLOT') || 0)}/cases/${created.id}`);
