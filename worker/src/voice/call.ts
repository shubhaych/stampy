/**
 * Inbound call (Vapi runs it: Deepgram speech-to-text → Claude → ElevenLabs text-to-speech).
 * The applicant calls whenever it suits them. The assistant discloses it is an AI, says the call is recorded,
 * offers a human callback, finds the case by reference code (and caller number), asks only the open
 * phone questions, and records each answer as a ledger fact with the caller's words and the time in the call.
 * It never states benefit amounts or eligibility and never writes to the case file.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Question } from '@stampy/contracts/stampy';
import type { Db, Q } from '../db';
import { env } from '../env';
import { id } from '../ids';
import { audit } from '../core/audit';
import { AI, SYSTEM } from '../core/authz';
import { consume, LimitError } from '../core/limits';
import { appendFact } from '../ledger/facts';
import { listQuestions } from '../ledger/detector';
import { normalizeField } from '../ledger/normalize';
import { afterEvidence, onCase } from '../pipeline';

/* ---------------- assistant config ---------------- */

const SYSTEM_PROMPT = (agency: string) => `You are the automated phone assistant for ${agency}, helping applicants finish a food assistance (SNAP) application. You speak on a phone call, so keep every turn short, warm and plain, one question at a time.

Rules you must follow:
- You already told the caller you are an AI assistant, that the call is recorded, and that they can ask for a person to call back. If they ask for a person at any point, call request_callback and tell them a caseworker will call them back.
- Before discussing anything about an application, get the six-digit reference number and call verify_caller with the digits. If it fails, ask them to read it again (two tries), then offer a callback. Never confirm whether someone has an application until verify_caller succeeds.
- After verify_caller succeeds, ask only the questions it returns, in order, in plain words. When the caller answers, briefly repeat back what you understood, then call record_answer with the question_id, the answer in a few words, and the caller's own words as caller_quote.
- If an answer is unclear, ask once more. Do not lead the caller toward any particular answer.
- Never state or guess a benefit amount, eligibility, approval, or what will happen to the case. A caseworker reviews everything. Never accuse, argue, or pressure.
- If verify_caller says documents are still needed, tell the caller you'll email a checklist right after the call and they can reply with a photo.
- When done, thank them and end the call with the endCall tool. Keep the call under four minutes.`;

function fnTool(name: string, description: string, properties: Record<string, unknown>, required: string[], server: { url: string; headers: Record<string, string> }) {
  return { type: 'function', function: { name, description, parameters: { type: 'object', properties, required } }, server };
}

export function buildAssistant(publicBaseUrl: string) {
  const headers: Record<string, string> = env.WEBHOOK_SECRET ? { 'x-stampy-secret': env.WEBHOOK_SECRET } : {};
  const server = { url: `${publicBaseUrl}/webhooks/vapi`, headers };
  const credentials = [
    ...(env.DEEPGRAM_API_KEY ? [{ provider: 'deepgram', apiKey: env.DEEPGRAM_API_KEY }] : []),
    ...(env.ELEVENLABS_API_KEY ? [{ provider: '11labs', apiKey: env.ELEVENLABS_API_KEY }] : []),
  ];
  return {
    name: 'Stampy benefits line',
    firstMessage: `Hi, thanks for calling ${env.AGENCY_NAME}. I'm an automated AI assistant, and this call is recorded. You can ask for a person to call you back at any time. To find your application, please say the six-digit reference number from your email.`,
    firstMessageMode: 'assistant-speaks-first',
    model: {
      provider: 'anthropic',
      model: env.VAPI_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT(env.AGENCY_NAME) }],
      tools: [
        fnTool('verify_caller', 'Find the caller’s application by the six-digit reference number they read out. Returns the questions to ask.', {
          reference_code: { type: 'string', description: 'The six digits the caller said, digits only.' },
        }, ['reference_code'], server),
        fnTool('record_answer', 'Record the caller’s answer to one question returned by verify_caller.', {
          question_id: { type: 'string', description: 'The id of the question being answered.' },
          answer: { type: 'string', description: 'The answer in a few words, e.g. "every two weeks".' },
          caller_quote: { type: 'string', description: 'What the caller actually said.' },
        }, ['question_id', 'answer', 'caller_quote'], server),
        fnTool('request_callback', 'The caller wants a person to call them back.', {
          reason: { type: 'string', description: 'Why, in the caller’s words.' },
        }, ['reason'], server),
        { type: 'endCall' },
      ],
    },
    transcriber: { provider: 'deepgram', model: 'nova-3', language: 'en', smartFormat: true },
    voice: { provider: '11labs', voiceId: env.ELEVENLABS_VOICE_ID, model: env.ELEVENLABS_MODEL },
    maxDurationSeconds: env.VOICE_MAX_CALL_SECONDS,
    serverMessages: ['tool-calls', 'end-of-call-report', 'status-update'],
    server,
    ...(credentials.length ? { credentials } : {}),
  };
}

/* ---------------- call rows ---------------- */

export async function startCall(db: Q, vapiCallId: string | null, fromNumber: string | null, simulated = false): Promise<string> {
  if (vapiCallId) {
    const existing = await db.query(`SELECT id FROM call WHERE vapi_call_id=$1`, [vapiCallId]);
    if (existing.rows[0]) return existing.rows[0].id;
  }
  const cid = id('CALL');
  await db.query(`INSERT INTO call (id, vapi_call_id, from_number, simulated) VALUES ($1,$2,$3,$4)`, [cid, vapiCallId, fromNumber, simulated]);
  return cid;
}

async function callRow(db: Q, callId: string) {
  return (await db.query(`SELECT * FROM call WHERE id=$1 OR vapi_call_id=$1`, [callId])).rows[0] as
    | { id: string; case_id: string | null; from_number: string | null; verified: boolean; simulated: boolean; started_at: string; status: string }
    | undefined;
}

const secondsSince = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 100) / 10);

/* ---------------- tools ---------------- */

export async function verifyCaller(db: Q, callId: string, referenceCode: string): Promise<string> {
  const call = await callRow(db, callId);
  if (!call) return 'error: call not found';
  const digits = referenceCode.replace(/\D/g, '');
  const c = (await db.query(`SELECT id, applicant_name, applicant_phone FROM app_case WHERE ref_code=$1`, [digits])).rows[0] as { id: string; applicant_name: string; applicant_phone: string } | undefined;
  if (!c) return JSON.stringify({ ok: false, message: 'No application matches that reference number. Ask the caller to read it again.' });
  const phoneMatched = !!call.from_number && call.from_number === c.applicant_phone;
  await db.query(`UPDATE call SET case_id=$2, verified=true WHERE id=$1`, [call.id, c.id]);
  await audit(db, { caseId: c.id, who: SYSTEM, kind: 'outreach', action: 'call.started', entity: 'call', entityId: call.id, data: { from: call.from_number, simulated: call.simulated } });
  await audit(db, { caseId: c.id, who: SYSTEM, kind: 'outreach', action: 'call.verified', entity: 'call', entityId: call.id, data: { phoneMatched, simulated: call.simulated } });
  const qs = await listQuestions(db, c.id);
  const phoneQs = qs.filter((q) => q.channel === 'phone' && q.status !== 'closed');
  const docs = qs.filter((q) => q.channel === 'document' && q.status === 'open');
  return JSON.stringify({
    ok: true,
    first_name: c.applicant_name.split(/\s+/)[0],
    questions: phoneQs.map((q) => ({ question_id: q.id, ask: q.ask })),
    documents_still_needed: docs.map((q) => q.ask),
    note: phoneQs.length ? 'Ask these questions in order.' : 'Nothing to ask by phone.',
  });
}

export async function recordAnswer(db: Q, callId: string, a: { questionId: string; answer: string; quote: string; atSeconds?: number }): Promise<string> {
  const call = await callRow(db, callId);
  if (!call?.verified || !call.case_id) return 'error: verify the caller first';
  const q = (await listQuestions(db, call.case_id)).find((x) => x.id === a.questionId);
  if (!q || q.channel !== 'phone') return 'error: unknown question_id';
  const at = a.atSeconds ?? secondsSince(call.started_at);
  const f = await appendFact(db, {
    caseId: call.case_id, field: q.field, value: a.answer, sourceKind: 'phone_call', sourceRef: call.id,
    sourceLabel: `Applicant on the phone${call.simulated ? ' (simulated call)' : ''}`, line: a.quote, atSeconds: at,
    confidence: 0.9, questionId: q.id, prov: call.simulated ? 'fixture' : 'live', createdBy: call.simulated ? 'ai:simulated-call' : `ai:vapi/${env.VAPI_MODEL}`,
  }, AI);
  await audit(db, { caseId: call.case_id, who: AI, kind: 'ai', action: 'call.answer_recorded', entity: 'fact', entityId: f.id, data: { questionId: q.id, value: f.normalized, atSeconds: at, callId: call.id } });
  return `Recorded: ${q.title.toLowerCase()} = ${a.answer}.`;
}

export async function requestCallback(db: Q, callId: string, reason: string): Promise<string> {
  const call = await callRow(db, callId);
  if (!call) return 'error: call not found';
  await db.query(`UPDATE call SET callback_requested=$2 WHERE id=$1`, [call.id, reason.slice(0, 500)]);
  if (call.case_id) {
    await db.query(`UPDATE app_case SET status='needs_person', updated_at=now() WHERE id=$1 AND status NOT IN ('approved','rejected')`, [call.case_id]);
    await audit(db, { caseId: call.case_id, who: SYSTEM, kind: 'outreach', action: 'call.callback_requested', entity: 'call', entityId: call.id, data: { reason } });
  }
  return 'Callback requested. Tell the caller a caseworker will call them back.';
}

/* ---------------- end of call ---------------- */

export interface Turn { role: 'assistant' | 'user'; message: string; secondsFromStart: number }

export async function endCall(db: Db, callId: string, info: { endedReason?: string; transcript?: string; messages?: Turn[]; recordingUrl?: string | null }): Promise<void> {
  const call = await callRow(db, callId);
  if (!call || call.status === 'ended') return;
  await db.query(`UPDATE call SET status='ended', ended_at=now(), ended_reason=$2, transcript=$3, messages=$4, recording_url=$5 WHERE id=$1`,
    [call.id, info.endedReason ?? null, info.transcript ?? null, JSON.stringify(info.messages ?? []), info.recordingUrl ?? null]);
  if (!call.case_id) return;
  const caseId = call.case_id;
  await audit(db, { caseId, who: SYSTEM, kind: 'outreach', action: 'call.ended', entity: 'call', entityId: call.id, data: { endedReason: info.endedReason ?? null, simulated: call.simulated } });
  await onCase(caseId, async () => {
    if (!call.simulated && info.messages?.length) await extractMissedAnswers(db, call.id, caseId, info.messages);
    await afterEvidence(db, caseId, 'call');
  });
}

/** Fallback: if the assistant forgot to call record_answer, read the transcript (Claude) for answers to open phone questions. */
async function extractMissedAnswers(db: Q, callId: string, caseId: string, messages: Turn[]): Promise<void> {
  if (env.AI_MODE !== 'live') return;
  const qs = (await listQuestions(db, caseId)).filter((q) => q.channel === 'phone' && q.status === 'open');
  const answered = new Set((await db.query(`SELECT question_id FROM fact WHERE source_ref=$1 AND question_id IS NOT NULL`, [callId])).rows.map((r) => r.question_id));
  const missing = qs.filter((q) => !answered.has(q.id));
  if (!missing.length) return;
  try {
    await consume(db, 'ai_run', env.AI_DAILY_RUN_LIMIT);
  } catch (e) {
    if (e instanceof LimitError) return;
    throw e;
  }
  const Out = z.object({ answers: z.array(z.object({ question_id: z.string(), answer: z.string(), caller_quote: z.string(), seconds_from_start: z.number() })) });
  const transcript = messages.map((m) => `[${m.secondsFromStart.toFixed(1)}s] ${m.role === 'user' ? 'CALLER' : 'ASSISTANT'}: ${m.message}`).join('\n');
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const r = await client.messages.parse({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low', format: zodOutputFormat(Out) },
    system: 'Find the caller’s answers to the listed questions in a call transcript. Only include a question if the caller clearly answered it; quote the caller verbatim. Never infer.',
    messages: [{ role: 'user', content: `Questions:\n${missing.map((q) => `${q.id}: ${q.ask}`).join('\n')}\n\nTranscript:\n${transcript}` }],
  });
  for (const a of r.parsed_output?.answers ?? []) {
    const q = missing.find((x) => x.id === a.question_id);
    if (!q || !normalizeField(q.field, a.answer)) continue;
    await recordAnswer(db, callId, { questionId: q.id, answer: a.answer, quote: a.caller_quote, atSeconds: a.seconds_from_start });
  }
}

/* ---------------- simulated call (fixture) ---------------- */

/** Runs a scripted call through the same tool handlers a live call uses. */
export async function simulateCall(db: Db, caseId: string): Promise<string> {
  const c = (await db.query(`SELECT ref_code, applicant_name, applicant_phone FROM app_case WHERE id=$1`, [caseId])).rows[0] as { ref_code: string; applicant_name: string; applicant_phone: string } | undefined;
  if (!c) throw new Error('case not found');
  await consume(db, 'voice_call', env.VOICE_DAILY_CALL_LIMIT);
  const callId = await startCall(db, null, c.applicant_phone, true);
  const qs: Question[] = await listQuestions(db, caseId);
  const freqQ = qs.find((q) => q.field === 'pay_frequency' && q.status !== 'closed');
  const docQ = qs.find((q) => q.channel === 'document' && q.status === 'open');
  const spokenCode = c.ref_code.split('').join(' ');
  const first = c.applicant_name.split(/\s+/)[0];
  const turns: Turn[] = [
    { role: 'assistant', secondsFromStart: 0, message: `Hi, thanks for calling ${env.AGENCY_NAME}. I'm an automated AI assistant, and this call is recorded. You can ask for a person to call you back at any time. To find your application, please say the six-digit reference number from your email.` },
    { role: 'user', secondsFromStart: 13.2, message: `Sure, it's ${spokenCode}.` },
  ];
  await verifyCaller(db, callId, c.ref_code);
  turns.push({ role: 'assistant', secondsFromStart: 19.4, message: `Thank you, ${first}, I found your application. I just need to confirm a couple of things. I can't tell you anything about amounts or decisions; a caseworker reviews everything.` });
  if (freqQ) {
    turns.push({ role: 'assistant', secondsFromStart: 31.6, message: `How often are you paid: every week, every two weeks, twice a month, or once a month?` });
    turns.push({ role: 'user', secondsFromStart: 42.0, message: `Oh, every two weeks. Every other Friday.` });
    await recordAnswer(db, callId, { questionId: freqQ.id, answer: 'every two weeks', quote: 'Oh, every two weeks. Every other Friday.', atSeconds: 42.0 });
    turns.push({ role: 'assistant', secondsFromStart: 46.8, message: `Got it, every two weeks. I've recorded that.` });
  }
  // Any other open phone question: the simulated caller confirms the value the documents show that the form does not.
  let t = 50;
  for (const q of qs.filter((x) => x.channel === 'phone' && x.status === 'open' && x.id !== freqQ?.id)) {
    const pick = q.candidates.find((k) => !k.sources.some((l) => l.startsWith('Application form'))) ?? q.candidates[0];
    if (!pick) continue;
    turns.push({ role: 'assistant', secondsFromStart: t, message: q.ask });
    turns.push({ role: 'user', secondsFromStart: t + 9, message: `The correct one is ${pick.label}.` });
    await recordAnswer(db, callId, { questionId: q.id, answer: pick.label, quote: `The correct one is ${pick.label}.`, atSeconds: t + 9 });
    turns.push({ role: 'assistant', secondsFromStart: t + 13, message: `Got it, ${pick.label}. I've recorded that.` });
    t += 18;
  }
  if (docQ) turns.push({ role: 'assistant', secondsFromStart: 50.5, message: `One more thing we need is a recent paystub. I'll email you a checklist right after this call; you can reply with a photo.` });
  turns.push({ role: 'user', secondsFromStart: 58.9, message: `Okay, I'll send it tonight. Thanks.` });
  turns.push({ role: 'assistant', secondsFromStart: 61.7, message: `Thanks for calling. Goodbye.` });
  await endCall(db, callId, { endedReason: 'assistant-ended-call (simulated)', messages: turns, transcript: turns.map((t) => `${t.role === 'user' ? 'Caller' : 'AI'}: ${t.message}`).join('\n') });
  return callId;
}
