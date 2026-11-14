/** Mode flags and limits. Every integration defaults to fixture; the app runs with zero keys (hard rule 13). */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
for (const f of ['.env.local', '.env']) {
  const p = resolve(ROOT, f);
  if (existsSync(p)) {
    try { process.loadEnvFile(p); } catch { /* ignore malformed env file */ }
  }
}

const s = (k: string, d = '') => process.env[k] || d;
const n = (k: string, d: number) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && process.env[k] !== '' && process.env[k] !== undefined ? v : d;
};
const oneOf = <T extends string>(k: string, allowed: readonly T[], d: T): T => {
  const v = process.env[k] as T | undefined;
  return v && allowed.includes(v) ? v : d;
};

export const SLOT = n('SLOT', 0);

export const env = {
  ROOT,
  MACHINE: oneOf('MACHINE', ['a', 'b'] as const, 'a'),
  SLOT,
  APP_MODE: oneOf('APP_MODE', ['fixture', 'live'] as const, 'fixture'),
  DB_PATH: resolve(ROOT, s('DB_PATH', 'data/db/stampy.db')),
  WORKER_PORT: n('WORKER_PORT', 8787) + (process.env.WORKER_PORT ? 0 : SLOT),
  WEB_ORIGIN: s('WEB_ORIGIN', `http://localhost:${3000 + SLOT}`),
  MEDIA_SIGNING_SECRET: s('MEDIA_SIGNING_SECRET'),
  DEMO_WORKER_CODE: s('DEMO_WORKER_CODE', 'stampy-worker'),
  DEMO_SUPERVISOR_CODE: s('DEMO_SUPERVISOR_CODE', 'stampy-supervisor'),

  AI_MODE: oneOf('AI_MODE', ['fixture', 'live'] as const, 'fixture'),
  AI_DAILY_RUN_LIMIT: n('AI_DAILY_RUN_LIMIT', 60),
  ANTHROPIC_API_KEY: s('ANTHROPIC_API_KEY'),
  ANTHROPIC_MODEL_REASONING: s('ANTHROPIC_MODEL_REASONING', 'claude-sonnet-5-5'),
  ANTHROPIC_MODEL_FAST: s('ANTHROPIC_MODEL_FAST', 'claude-haiku-5-5'),
  DOC_READER_MODE: oneOf('DOC_READER_MODE', ['fixture', 'vision'] as const, 'fixture'),

  MOSS_MODE: oneOf('MOSS_MODE', ['local', 'live'] as const, 'local'),
  MOSS_PROJECT_ID: s('MOSS_PROJECT_ID'),
  MOSS_PROJECT_KEY: s('MOSS_PROJECT_KEY'),
  MOSS_INDEX: s('MOSS_INDEX', 'stampy-policy'),

  VOICE_MODE: oneOf('VOICE_MODE', ['fixture', 'live'] as const, 'fixture'),
  VOICE_COUNTERPART: oneOf('VOICE_COUNTERPART', ['sim', 'human', 'pstn'] as const, 'sim'),
  DEEPGRAM_API_KEY: s('DEEPGRAM_API_KEY'),
  DEEPGRAM_AGENT_URL: s('DEEPGRAM_AGENT_URL', 'wss://agent.deepgram.com/v1/agent/converse'),
  DEEPGRAM_LISTEN_MODEL: s('DEEPGRAM_LISTEN_MODEL', 'nova-3'),
  DEEPGRAM_SPEAK_MODEL: s('DEEPGRAM_SPEAK_MODEL', 'aura-2-thalia-en'),
  VOICE_THINK_PROVIDER: s('VOICE_THINK_PROVIDER', 'anthropic'),
  VOICE_THINK_MODEL: s('VOICE_THINK_MODEL', 'claude-haiku-4-5'),
  VOICE_DAILY_CALL_LIMIT: n('VOICE_DAILY_CALL_LIMIT', 6),
  VOICE_MAX_CALL_SECONDS: n('VOICE_MAX_CALL_SECONDS', 240),
  VOICE_ALLOWED_NUMBERS: s('VOICE_ALLOWED_NUMBERS').split(',').map((x) => x.trim()).filter(Boolean),

  MESSAGING_PROVIDER: oneOf('MESSAGING_PROVIDER', ['fixture', 'twilio', 'whatsapp_cloud'] as const, 'fixture'),
  SMS_ALLOWED_NUMBERS: s('SMS_ALLOWED_NUMBERS').split(',').map((x) => x.trim()).filter(Boolean),
  EMAIL_PROVIDER: oneOf('EMAIL_PROVIDER', ['fixture', 'gmail', 'resend'] as const, 'fixture'),
  EMAIL_ALLOWED_RECIPIENTS: s('EMAIL_ALLOWED_RECIPIENTS').split(',').map((x) => x.trim()).filter(Boolean),
  HOUSEHOLD_UPLOAD_BASE_URL: s('HOUSEHOLD_UPLOAD_BASE_URL', `http://localhost:${3000 + SLOT}`),
  OUTREACH_DAILY_LIMIT: n('OUTREACH_DAILY_LIMIT', 20),

  MANUS_MODE: oneOf('MANUS_MODE', ['off', 'live'] as const, 'off'),

  POLICYENGINE_MODE: oneOf('POLICYENGINE_MODE', ['off', 'api'] as const, 'off'),
  POLICYENGINE_API_URL: s('POLICYENGINE_API_URL', 'https://api.policyengine.org'),

  QC_FILE_PATH: s('QC_FILE_PATH'),
  QC_FISCAL_YEAR: n('QC_FISCAL_YEAR', 2024),
  QC_SAMPLE_SEED: n('QC_SAMPLE_SEED', 7),
} as const;

export type Env = typeof env;
