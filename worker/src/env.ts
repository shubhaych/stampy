/**
 * Worker configuration. Every integration has a mode; the app runs end to end with zero keys (fixture).
 * Keys never leave the worker (hard rule 12).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
for (const f of ['.env.local', '.env']) {
  const p = resolve(ROOT, f);
  if (existsSync(p)) {
    try { process.loadEnvFile(p); } catch { /* ignore a malformed env file */ }
  }
}

const s = (k: string, d = '') => process.env[k]?.trim() || d;
const n = (k: string, d: number) => {
  const v = Number(process.env[k]);
  return process.env[k] !== undefined && process.env[k] !== '' && Number.isFinite(v) ? v : d;
};
const list = (k: string) => s(k).split(',').map((x) => x.trim()).filter(Boolean);
type Mode = 'fixture' | 'live';
/** Explicit mode wins; otherwise live when the key is present, fixture when it is not. */
const mode = (k: string, hasKey: boolean): Mode => {
  const v = s(k);
  if (v === 'fixture' || v === 'live') return v;
  return hasKey ? 'live' : 'fixture';
};

export const SLOT = n('SLOT', 0);

const ANTHROPIC_API_KEY = s('ANTHROPIC_API_KEY');
const AGENTMAIL_API_KEY = s('AGENTMAIL_API_KEY');
const VAPI_PRIVATE_API_KEY = s('VAPI_PRIVATE_API_KEY');

export const env = {
  ROOT,
  SLOT,
  WORKER_PORT: n('WORKER_PORT', 8787 + SLOT),
  WEB_ORIGIN: s('WEB_ORIGIN', `http://localhost:${3000 + SLOT}`),
  DATABASE_URL: s('DATABASE_URL', 'postgres://stampy:stampy@localhost:5433/stampy'),
  DEMO_WORKER_CODE: s('DEMO_WORKER_CODE', 'stampy-worker'),
  DEMO_SUPERVISOR_CODE: s('DEMO_SUPERVISOR_CODE', 'stampy-supervisor'),
  /** Shared secret Vapi and AgentMail webhooks must present (x-stampy-secret header). */
  WEBHOOK_SECRET: s('STAMPY_WEBHOOK_SECRET'),
  /** Public base URL of this worker (ngrok). Empty: discovered from the local ngrok API. */
  PUBLIC_BASE_URL: s('PUBLIC_BASE_URL'),
  NGROK_API: s('NGROK_API', 'http://127.0.0.1:4040'),

  AI_MODE: mode('AI_MODE', !!ANTHROPIC_API_KEY),
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL: s('ANTHROPIC_MODEL', 'claude-opus-5-5'),
  AI_DAILY_RUN_LIMIT: n('AI_DAILY_RUN_LIMIT', 80),

  EMAIL_MODE: mode('EMAIL_MODE', !!AGENTMAIL_API_KEY),
  AGENTMAIL_API_KEY,
  AGENTMAIL_BASE: s('AGENTMAIL_BASE', 'https://api.agentmail.to/v0'),
  AGENTMAIL_USERNAME: s('AGENTMAIL_USERNAME', 'stampy-benefits'),
  AGENTMAIL_DISPLAY_NAME: s('AGENTMAIL_DISPLAY_NAME', 'Stampy Benefits Office (demo)'),
  /** websocket (no tunnel needed) | webhook (needs PUBLIC_BASE_URL) | off */
  AGENTMAIL_EVENTS: s('AGENTMAIL_EVENTS', 'websocket') as 'websocket' | 'webhook' | 'off',
  AGENTMAIL_WEBHOOK_SECRET: s('AGENTMAIL_WEBHOOK_SECRET'),
  EMAIL_ALLOWED_RECIPIENTS: list('EMAIL_ALLOWED_RECIPIENTS'),
  EMAIL_DAILY_LIMIT: n('EMAIL_DAILY_LIMIT', 40),
  /** The checklist email is promised to the applicant on the call, so it goes out when the call ends. */
  AUTO_SEND_CHECKLIST: s('AUTO_SEND_CHECKLIST', 'true') !== 'false',

  VOICE_MODE: mode('VOICE_MODE', !!VAPI_PRIVATE_API_KEY),
  VAPI_PRIVATE_API_KEY,
  VAPI_BASE: s('VAPI_BASE', 'https://api.vapi.ai'),
  VAPI_PHONE_NUMBER_ID: s('VAPI_PHONE_NUMBER_ID'),
  VAPI_MODEL: s('VAPI_MODEL', 'claude-sonnet-5'),
  DEEPGRAM_API_KEY: s('DEEPGRAM_API_KEY'),
  ELEVENLABS_API_KEY: s('ELEVENLABS_API_KEY'),
  ELEVENLABS_VOICE_ID: s('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'),
  ELEVENLABS_MODEL: s('ELEVENLABS_MODEL', 'eleven_turbo_v2_5'),
  VOICE_DAILY_CALL_LIMIT: n('VOICE_DAILY_CALL_LIMIT', 20),
  VOICE_MAX_CALL_SECONDS: n('VOICE_MAX_CALL_SECONDS', 300),
  AGENCY_NAME: s('AGENCY_NAME', 'the Stampy County benefits office'),

  POLICYENGINE_URL: s('POLICYENGINE_URL', 'http://127.0.0.1:8790'),
  /** Recent pay must be dated within this many days before the application date (demo setting). */
  RECENT_PAY_DAYS: n('RECENT_PAY_DAYS', 30),
} as const;

export type Env = typeof env;
