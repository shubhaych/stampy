/**
 * AgentMail REST client (https://docs.agentmail.to). Bearer auth; base https://api.agentmail.to/v0.
 * Inbound mail arrives over the AgentMail WebSocket (no tunnel needed) or a Svix-signed webhook.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../env';

export interface Inbox { inbox_id: string; email?: string; display_name?: string }
export interface SentMessage { message_id: string; thread_id: string }
export interface AmAttachment { attachment_id: string; filename?: string; content_type?: string; size?: number }
export interface AmMessage {
  message_id: string; thread_id: string; inbox_id: string; from: string; to?: string[] | string; subject?: string;
  text?: string; extracted_text?: string; html?: string; attachments?: AmAttachment[]; timestamp?: string;
}

async function am<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${env.AGENTMAIL_BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${env.AGENTMAIL_API_KEY}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`AgentMail ${init.method ?? 'GET'} ${path} → ${r.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

let inbox: Inbox | null = null;

/** Find the Stampy inbox by username, creating it once if it does not exist. */
export async function ensureInbox(create = true): Promise<Inbox | null> {
  if (inbox) return inbox;
  const want = `${env.AGENTMAIL_USERNAME}@`;
  const list = await am<{ inboxes: Inbox[] }>('/inboxes?limit=50');
  inbox = list.inboxes.find((i) => (i.email ?? i.inbox_id).startsWith(want)) ?? null;
  if (!inbox && create) {
    inbox = await am<Inbox>('/inboxes', { method: 'POST', body: JSON.stringify({ username: env.AGENTMAIL_USERNAME, display_name: env.AGENTMAIL_DISPLAY_NAME }) });
  }
  return inbox;
}

export function inboxAddress(): string | null {
  return inbox ? inbox.email ?? inbox.inbox_id : null;
}

export async function sendMessage(to: string, subject: string, text: string): Promise<SentMessage> {
  const ib = await ensureInbox();
  return am<SentMessage>(`/inboxes/${encodeURIComponent(ib!.inbox_id)}/messages/send`, { method: 'POST', body: JSON.stringify({ to: [to], subject, text }) });
}

/** Reply in the same thread. `to` is explicit: replying to our own sent message would otherwise address it to us. */
export async function replyTo(messageId: string, text: string, to: string): Promise<SentMessage> {
  const ib = await ensureInbox();
  return am<SentMessage>(`/inboxes/${encodeURIComponent(ib!.inbox_id)}/messages/${encodeURIComponent(messageId)}/reply`, { method: 'POST', body: JSON.stringify({ text, to: [to] }) });
}

export async function getMessage(inboxId: string, messageId: string): Promise<AmMessage> {
  return am<AmMessage>(`/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}`);
}

/** Attachment download links expire (about an hour), so fetch the bytes immediately and keep them. */
export async function downloadAttachment(inboxId: string, messageId: string, attachmentId: string): Promise<{ bytes: Buffer; filename: string; contentType: string }> {
  const meta = await am<{ download_url: string; filename?: string; content_type?: string }>(
    `/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  const r = await fetch(meta.download_url, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`attachment download ${r.status}`);
  return { bytes: Buffer.from(await r.arrayBuffer()), filename: meta.filename ?? 'attachment', contentType: (meta.content_type ?? r.headers.get('content-type') ?? 'application/octet-stream').split(';')[0]!.trim() };
}

/** Svix signature check for AgentMail webhooks (headers svix-id, svix-timestamp, svix-signature). */
export function verifySvix(rawBody: string, headers: Headers, secret: string): boolean {
  const msgId = headers.get('svix-id');
  const ts = headers.get('svix-timestamp');
  const sigs = headers.get('svix-signature');
  if (!msgId || !ts || !sigs || !secret) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${msgId}.${ts}.${rawBody}`).digest();
  return sigs.split(' ').some((s) => {
    const [, b64] = s.split(',');
    if (!b64) return false;
    const got = Buffer.from(b64, 'base64');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** Subscribe to message.received over the AgentMail WebSocket; reconnects with backoff. Returns a stop function. */
export function listenWebSocket(onMessage: (m: AmMessage, eventId: string | null) => void, log = console.log): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let delay = 1000;
  const connect = async () => {
    if (stopped) return;
    const ib = await ensureInbox().catch((e) => { log(`[agentmail] inbox lookup failed: ${(e as Error).message}`); return null; });
    if (!ib) { setTimeout(connect, (delay = Math.min(delay * 2, 30_000))); return; }
    ws = new WebSocket(`wss://ws.agentmail.to/v0?api_key=${encodeURIComponent(env.AGENTMAIL_API_KEY)}`);
    ws.onopen = () => {
      delay = 1000;
      ws!.send(JSON.stringify({ type: 'subscribe', inbox_ids: [ib.inbox_id], event_types: ['message.received'] }));
      log(`[agentmail] listening for replies to ${ib.email ?? ib.inbox_id} (websocket)`);
    };
    ws.onmessage = (ev) => {
      try {
        const j = JSON.parse(String(ev.data)) as { type?: string; event_type?: string; event_id?: string; message?: AmMessage };
        if (j.type === 'event' && j.event_type === 'message.received' && j.message) onMessage(j.message, j.event_id ?? null);
      } catch { /* ignore non-JSON frames */ }
    };
    ws.onclose = () => { if (!stopped) setTimeout(connect, (delay = Math.min(delay * 2, 30_000))); };
    ws.onerror = () => { /* onclose follows */ };
  };
  void connect();
  return () => { stopped = true; ws?.close(); };
}
