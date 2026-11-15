/**
 * Browser client for the Stampy worker (REST + SSE). The worker URL is public config only; no keys here.
 * Every call throws ApiError with the worker's { error } message so pages can show it inline.
 */
import { z } from 'zod';
import { CaseBundleV2 as BundleSchema, CaseSummary as SummarySchema, StampyEvent as EventSchema } from '@stampy/contracts/stampy';
import { StampyRoutes } from '@stampy/contracts/stampy';
import type { Decision, Outreach, StampyEvent } from '@stampy/contracts/stampy';

/** Same-origin bridge (web/app/cases/api): the browser never calls the worker host directly. */
export const WORKER_URL = '/cases/api';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface WorkerStatus {
  modes: { ai: string; email: string; voice: string; rules: string };
  phoneNumber: string | null;
  inboxEmail: string | null;
  publicUrl: string | null;
}

export interface SampleDoc {
  name: string;
  label: string;
  filename: string;
  contentType: string;
  kind: string;
  description: string;
  uploadByDefault: boolean;
}

export const workerUrl = (path: string) => `${WORKER_URL}${path}`;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(workerUrl(path), { cache: 'no-store', signal: AbortSignal.timeout(90_000), ...init });
  } catch {
    throw new ApiError('Could not reach Stampy. Check that the web server is running, then retry.', 0);
  }
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    const msg = body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `${res.status} ${res.statusText || 'request failed'}`;
    throw new ApiError(msg, res.status);
  }
  if (body === null) throw new ApiError('The worker returned an empty or unreadable response. Refresh to check whether the action completed.', 502);
  return body as T;
}

async function checked<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await req<unknown>(path));
  if (!parsed.success) throw new ApiError('This worker uses an incompatible API. Connect the b/stampy-loop worker and retry.', 502);
  return parsed.data;
}

const json = (data: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

export const api = {
  status: () => req<WorkerStatus>(StampyRoutes.status),
  cases: () => checked(StampyRoutes.cases, SummarySchema.array()),
  caseBundle: (id: string) => checked(StampyRoutes.case(id), BundleSchema),
  samples: () => req<SampleDoc[]>(StampyRoutes.samples),
  sampleUrl: (name: string) => workerUrl(StampyRoutes.sample(name)),
  docUrl: (id: string) => workerUrl(StampyRoutes.doc(id)),
  createCase: (form: FormData) => req<{ id: string; refCode: string }>(StampyRoutes.cases, { method: 'POST', body: form }),
  sendRequest: (id: string) => req<{ outreach: Outreach }>(StampyRoutes.sendRequest(id), json({})),
  simulateCall: (id: string) => req<{ callId: string }>(StampyRoutes.simulateCall(id), { method: 'POST' }),
  simulateReply: (id: string) => req<{ inboundId: string }>(StampyRoutes.simulateReply(id), { method: 'POST' }),
  recompute: (id: string) => req<{ ok: boolean }>(StampyRoutes.recompute(id), { method: 'POST' }),
  reread: (id: string) => req<unknown>(StampyRoutes.reread(id), { method: 'POST' }),
  decide: (id: string, action: 'approve' | 'reject', note?: string) =>
    req<{ decision: Decision }>(StampyRoutes.decide(id), json({ action, note: note || undefined })),
};

/**
 * Subscribe to `case.updated` events. Calls onEvent for each parsed event. Returns an unsubscribe function.
 * EventSource reconnects on its own; onState reports whether the stream is open.
 */
export function subscribeEvents(onEvent: (e: StampyEvent) => void, onState?: (open: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return () => {};
  const es = new EventSource(workerUrl(StampyRoutes.events));
  const handle = (m: MessageEvent) => {
    try {
      const e = EventSchema.safeParse(JSON.parse(String(m.data)));
      if (e.success) onEvent(e.data);
    } catch {
      /* ignore keep-alives and malformed frames */
    }
  };
  es.addEventListener('case.updated', handle as EventListener);
  es.onmessage = handle;
  es.onopen = () => onState?.(true);
  es.onerror = () => onState?.(false);
  return () => es.close();
}
