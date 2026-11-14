/** Worker HTTP surface: REST for the web app, SSE for live pages, webhooks for Vapi and AgentMail. */
import { timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import type { StampyEvent } from '@stampy/contracts/stampy';
import type { Db } from './db';
import { env } from './env';
import { subscribe } from './events';
import { AuthzError, identityFromCode, SYSTEM, type Identity } from './core/authz';
import { LimitError, used } from './core/limits';
import { HttpError, addDocument, createCase, getBundle, listCases } from './cases/service';
import { approveAndSendRequest, decide, onCase, onInboundEmail, readAndDetect, recompute, afterEvidence } from './pipeline';
import { listSamples, sampleBytes } from './reader/samples';
import { inboxAddress, verifySvix, type AmMessage } from './email/agentmail';
import { buildAssistant, endCall, recordAnswer, requestCallback, simulateCall, startCall, verifyCaller, type Turn } from './voice/call';
import { callInNumber } from './voice/vapi';
import { policyEngineHealth } from './rules/benefit';
import { publicBaseUrl } from './tunnel';

export function modes() {
  return { ai: env.AI_MODE, email: env.EMAIL_MODE, voice: env.VOICE_MODE, rules: 'policyengine-us (local)' };
}

function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function worker(body: { worker?: { name?: string; code?: string } }): Identity {
  const w = identityFromCode(body.worker?.code, (body.worker?.name ?? '').trim() || 'caseworker', env);
  if (!w) throw new HttpError(401, 'Sign in as a caseworker (name and access code) first.');
  return w;
}

export function createApp(db: Db): Hono {
  const app = new Hono();
  app.use('*', cors({ origin: (o) => o ?? '*' }));

  app.onError((e, c) => {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    if (e instanceof AuthzError) return c.json({ error: e.message }, 403);
    if (e instanceof LimitError) return c.json({ error: e.message }, 429);
    console.error('[worker]', e);
    return c.json({ error: (e as Error).message ?? 'internal error' }, 500);
  });

  app.get('/health', (c) => c.json({ ok: true }));

  app.get('/status', async (c) => {
    const pe = await policyEngineHealth();
    return c.json({
      modes: modes(), phoneNumber: callInNumber(), inboxEmail: inboxAddress(), publicUrl: publicBaseUrl(),
      policyEngine: pe, usage: { aiRuns: await used(db, 'ai_run'), emails: await used(db, 'email'), calls: await used(db, 'voice_call') },
      limits: { aiRuns: env.AI_DAILY_RUN_LIMIT, emails: env.EMAIL_DAILY_LIMIT, calls: env.VOICE_DAILY_CALL_LIMIT },
    });
  });

  app.get('/events', (c) =>
    streamSSE(c, async (stream) => {
      const queue: StampyEvent[] = [];
      let wake: (() => void) | null = null;
      const off = subscribe((e) => { queue.push(e); wake?.(); });
      stream.onAbort(() => { off(); wake?.(); });
      await stream.writeSSE({ event: 'hello', data: '{}' });
      while (!stream.aborted) {
        while (queue.length) {
          const e = queue.shift()!;
          await stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
        }
        await Promise.race([new Promise<void>((r) => (wake = r)), stream.sleep(15_000)]);
        wake = null;
        if (!queue.length && !stream.aborted) await stream.writeSSE({ event: 'ping', data: '{}' });
      }
      off();
    }),
  );

  /* ---------------- samples ---------------- */
  app.get('/samples', (c) => c.json(listSamples().map(({ name, label, filename, contentType, kind, description, uploadByDefault }) => ({ name, label, filename, contentType, kind, description, uploadByDefault }))));
  app.get('/samples/:name', (c) => {
    const s = sampleBytes(c.req.param('name'));
    if (!s) return c.json({ error: 'no such sample' }, 404);
    return c.body(new Uint8Array(s.bytes), 200, { 'content-type': s.sample.contentType, 'cache-control': 'public, max-age=300' });
  });

  /* ---------------- cases ---------------- */
  app.get('/cases', async (c) => c.json(await listCases(db)));

  app.post('/cases', async (c) => {
    const form = await c.req.formData();
    const get = (k: string) => String(form.get(k) ?? '');
    const files = form.getAll('files').filter((f): f is File => typeof f === 'object' && 'arrayBuffer' in f && f.size > 0);
    const samples = get('samples').split(',').map((s) => s.trim()).filter(Boolean);
    if (!files.length && !samples.length) throw new HttpError(422, 'Attach at least one document.');
    const created = await createCase(db, { name: get('applicantName'), email: get('applicantEmail'), phone: get('applicantPhone'), state: get('state') || 'CA' });
    const applicant: Identity = { id: `applicant:${get('applicantEmail').trim().toLowerCase()}`, role: 'applicant' };
    const docIds: string[] = [];
    for (const name of samples) {
      const s = sampleBytes(name);
      if (!s) throw new HttpError(422, `unknown sample ${name}`);
      docIds.push(await addDocument(db, { caseId: created.id, filename: s.sample.filename, contentType: s.sample.contentType, bytes: s.bytes, source: 'upload' }, applicant));
    }
    for (const f of files) {
      docIds.push(await addDocument(db, { caseId: created.id, filename: f.name || 'upload', contentType: f.type || 'application/octet-stream', bytes: Buffer.from(await f.arrayBuffer()), source: 'upload' }, applicant));
    }
    void onCase(created.id, () => readAndDetect(db, created.id, docIds)).catch((e) => console.error('[pipeline]', e));
    return c.json(created, 201);
  });

  app.get('/cases/:id', async (c) => c.json(await getBundle(db, c.req.param('id'), { phoneNumber: callInNumber(), modes: modes() })));

  app.get('/docs/:id', async (c) => {
    const r = await db.query(`SELECT bytes, content_type, filename FROM document WHERE id=$1`, [c.req.param('id')]);
    const d = r.rows[0];
    if (!d) return c.json({ error: 'not found' }, 404);
    return c.body(new Uint8Array(d.bytes), 200, { 'content-type': d.content_type, 'content-disposition': `inline; filename="${String(d.filename).replace(/"/g, '')}"`, 'cache-control': 'private, max-age=600' });
  });

  app.post('/cases/:id/outreach/request/send', async (c) => {
    const id = c.req.param('id');
    const who = worker(await c.req.json().catch(() => ({})));
    await onCase(id, () => approveAndSendRequest(db, id, who));
    const o = (await db.query(`SELECT id, status, error FROM outreach WHERE case_id=$1 AND kind='request' ORDER BY created_at DESC LIMIT 1`, [id])).rows[0];
    return c.json({ outreach: o });
  });

  app.post('/cases/:id/decision', async (c) => {
    const id = c.req.param('id');
    const body = (await c.req.json().catch(() => ({}))) as { action?: string; note?: string; worker?: { name?: string; code?: string } };
    if (body.action !== 'approve' && body.action !== 'reject') throw new HttpError(422, 'action must be approve or reject');
    const who = worker(body);
    await onCase(id, () => decide(db, id, who, body.action as 'approve' | 'reject', body.note?.trim() || null));
    return c.json({ decision: (await db.query(`SELECT * FROM decision WHERE case_id=$1 ORDER BY at DESC LIMIT 1`, [id])).rows[0] });
  });

  app.post('/cases/:id/recompute', async (c) => {
    const id = c.req.param('id');
    await onCase(id, () => recompute(db, id));
    return c.json({ ok: true });
  });

  app.post('/cases/:id/reread', async (c) => {
    const id = c.req.param('id');
    const r = await db.query(`UPDATE document SET read_status='pending' WHERE case_id=$1 AND read_status IN ('failed','needs_person') RETURNING id`, [id]);
    const ids = r.rows.map((x) => x.id as string);
    void onCase(id, () => (ids.length ? readAndDetect(db, id, ids) : afterEvidence(db, id, 'manual'))).catch((e) => console.error('[pipeline]', e));
    return c.json({ rereading: ids.length });
  });

  /* ---------------- demo controls (fixture paths through the same code) ---------------- */
  app.post('/cases/:id/simulate/call', async (c) => c.json({ callId: await simulateCall(db, c.req.param('id')) }));

  app.post('/cases/:id/simulate/reply', async (c) => {
    const id = c.req.param('id');
    const s = sampleBytes('paystub-2026-10-photo');
    if (!s) throw new HttpError(404, 'run npm run samples first');
    const cs = (await db.query(`SELECT applicant_email, email_thread_id, ref_code FROM app_case WHERE id=$1`, [id])).rows[0];
    if (!cs) throw new HttpError(404, 'case not found');
    const m: AmMessage = {
      message_id: `sim-${Date.now()}`, thread_id: cs.email_thread_id ?? `sim-thread-${id}`, inbox_id: 'simulated', from: cs.applicant_email,
      subject: `Re: your food assistance application (ref ${cs.ref_code})`, text: 'Here is my October paystub. Thanks!',
    };
    const r = await onInboundEmail(db, m, { simulated: true, attachments: [{ filename: 'IMG_2041.jpg', contentType: s.sample.contentType, bytes: s.bytes }] });
    return c.json(r);
  });

  /* ---------------- webhooks ---------------- */
  const vapiAuthorized = (c: Context) => !env.WEBHOOK_SECRET || safeEq(c.req.header('x-stampy-secret') ?? '', env.WEBHOOK_SECRET);

  app.post('/webhooks/vapi', async (c) => {
    if (!vapiAuthorized(c)) return c.json({ error: 'unauthorized' }, 401);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { message } = (await c.req.json()) as { message: any };
    const type: string = message?.type ?? '';
    const vapiCallId: string | null = message?.call?.id ?? null;
    const from: string | null = message?.customer?.number ?? message?.call?.customer?.number ?? null;

    if (type === 'assistant-request') {
      const base = publicBaseUrl();
      if (!base) return c.json({ error: 'Sorry, the benefits line is not available right now. Please try again later.' });
      await startCall(db, vapiCallId, from);
      return c.json({ assistant: buildAssistant(base) });
    }
    if (type === 'tool-calls') {
      const callId = vapiCallId ?? '';
      await startCall(db, vapiCallId, from);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: any[] = message.toolCallList ?? (message.toolWithToolCallList ?? []).map((t: any) => t.toolCall);
      const results = [];
      for (const tc of list) {
        const name: string = tc.function?.name ?? tc.name;
        const raw = tc.function?.arguments ?? tc.arguments ?? {};
        const args = (typeof raw === 'string' ? JSON.parse(raw || '{}') : raw) as Record<string, string>;
        let result: string;
        try {
          if (name === 'verify_caller') result = await verifyCaller(db, callId, args.reference_code ?? '');
          else if (name === 'record_answer') result = await recordAnswer(db, callId, { questionId: args.question_id ?? '', answer: args.answer ?? '', quote: args.caller_quote ?? args.answer ?? '' });
          else if (name === 'request_callback') result = await requestCallback(db, callId, args.reason ?? '');
          else result = `error: unknown tool ${name}`;
        } catch (e) {
          result = `error: ${(e as Error).message.slice(0, 200)}`;
        }
        results.push({ name, toolCallId: tc.id, result: result.replace(/\n/g, ' ') });
      }
      return c.json({ results });
    }
    if (type === 'end-of-call-report') {
      const art = message.artifact ?? {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages: Turn[] = (art.messages ?? []).filter((m: any) => m.role === 'user' || m.role === 'bot' || m.role === 'assistant')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((m: any) => ({ role: m.role === 'user' ? 'user' : 'assistant', message: m.message ?? '', secondsFromStart: Number(m.secondsFromStart ?? 0) }));
      if (vapiCallId) {
        await startCall(db, vapiCallId, from);
        void endCall(db, vapiCallId, { endedReason: message.endedReason, transcript: art.transcript, messages, recordingUrl: art.recordingUrl ?? art.recording?.mono?.combinedUrl ?? null })
          .catch((e) => console.error('[voice] end-of-call', e));
      }
      return c.json({ ok: true });
    }
    return c.json({ ok: true });
  });

  app.post('/webhooks/agentmail', async (c) => {
    const raw = await c.req.text();
    if (env.AGENTMAIL_WEBHOOK_SECRET && !verifySvix(raw, c.req.raw.headers, env.AGENTMAIL_WEBHOOK_SECRET)) return c.json({ error: 'bad signature' }, 401);
    if (!env.AGENTMAIL_WEBHOOK_SECRET && !vapiAuthorized(c)) return c.json({ error: 'unauthorized' }, 401);
    const j = JSON.parse(raw) as { event_type?: string; message?: AmMessage };
    if (j.event_type === 'message.received' && j.message) void onInboundEmail(db, j.message).catch((e) => console.error('[agentmail] inbound', e));
    return c.json({ ok: true });
  });

  void SYSTEM;
  return app;
}
