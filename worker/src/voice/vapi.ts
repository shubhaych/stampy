/**
 * Vapi REST client (https://docs.vapi.ai). Inbound calls to the free Vapi number send `assistant-request`
 * to our server (phone number `server.url`, no saved assistant), and we answer with a transient assistant.
 */
import { env } from '../env';

export interface VapiPhoneNumber { id: string; number?: string; provider?: string; status?: string; server?: { url?: string; headers?: Record<string, string> }; assistantId?: string | null }

async function vapi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${env.VAPI_BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${env.VAPI_PRIVATE_API_KEY}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Vapi ${init.method ?? 'GET'} ${path} → ${r.status}: ${text.slice(0, 400)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

let cached: VapiPhoneNumber | null = null;

export async function listPhoneNumbers(): Promise<VapiPhoneNumber[]> {
  return vapi<VapiPhoneNumber[]>('/phone-number');
}

/** The number applicants call: VAPI_PHONE_NUMBER_ID if set, else the first number on the account. */
export async function findPhoneNumber(): Promise<VapiPhoneNumber | null> {
  if (cached) return cached;
  const all = await listPhoneNumbers();
  cached = (env.VAPI_PHONE_NUMBER_ID ? all.find((p) => p.id === env.VAPI_PHONE_NUMBER_ID) : all[0]) ?? null;
  return cached;
}

export async function createFreeNumber(areaCode: string, serverUrl: string, headers: Record<string, string>): Promise<VapiPhoneNumber> {
  cached = await vapi<VapiPhoneNumber>('/phone-number', {
    method: 'POST',
    body: JSON.stringify({ provider: 'vapi', numberDesiredAreaCode: areaCode, name: 'Stampy benefits line', server: { url: serverUrl, headers } }),
  });
  return cached;
}

/** Point the number at our webhook. Clearing assistantId makes Vapi ask our server for the assistant per call. */
export async function pointNumberAt(phoneId: string, serverUrl: string, headers: Record<string, string>): Promise<VapiPhoneNumber> {
  cached = await vapi<VapiPhoneNumber>(`/phone-number/${encodeURIComponent(phoneId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ assistantId: null, server: { url: serverUrl, headers, timeoutSeconds: 20 } }),
  });
  return cached;
}

export function callInNumber(): string | null {
  return cached?.number ?? null;
}
