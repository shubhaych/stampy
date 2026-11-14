/**
 * npm run env:check — per integration: ok | fixture | missing-key | UNVERIFIED-LIVE.
 * Exits 0 in every case except a secret name found in web/ (rule 12).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, envValue, walk } from './lib';

interface Row { service: string; mode: string; key: string | null; verify: string }
const rows: Row[] = [
  { service: 'anthropic', mode: envValue('AI_MODE', 'fixture'), key: 'ANTHROPIC_API_KEY', verify: 'npm run hello:claude' },
  { service: 'moss', mode: envValue('MOSS_MODE', 'local'), key: 'MOSS_PROJECT_KEY', verify: 'npm run hello:moss' },
  { service: 'deepgram', mode: envValue('VOICE_MODE', 'fixture'), key: 'DEEPGRAM_API_KEY', verify: 'npm run hello:deepgram' },
  { service: 'policyengine', mode: envValue('POLICYENGINE_MODE', 'off'), key: null, verify: 'npm run hello:policyengine' },
  { service: 'messaging', mode: envValue('MESSAGING_PROVIDER', 'fixture'), key: envValue('MESSAGING_PROVIDER') === 'whatsapp_cloud' ? 'WHATSAPP_ACCESS_TOKEN' : 'TWILIO_AUTH_TOKEN', verify: '<fill in: send a test message to SMS_ALLOWED_NUMBERS>' },
  { service: 'email', mode: envValue('EMAIL_PROVIDER', 'fixture'), key: envValue('EMAIL_PROVIDER') === 'resend' ? 'RESEND_API_KEY' : 'GMAIL_REFRESH_TOKEN', verify: '<fill in: send a test email to EMAIL_ALLOWED_RECIPIENTS>' },
  { service: 'manus', mode: envValue('MANUS_MODE', 'off'), key: 'MANUS_API_KEY', verify: 'confirm the product with the human first' },
  { service: 'qc-file', mode: envValue('QC_FILE_PATH').includes('<fill in') || !envValue('QC_FILE_PATH') ? 'fixture' : 'live', key: null, verify: 'npm run qc:ingest' },
];

for (const r of rows) {
  const live = !['fixture', 'local', 'off'].includes(r.mode);
  const hasKey = r.key ? Boolean(envValue(r.key)) : true;
  const state = !live ? 'fixture' : !hasKey ? 'missing-key' : 'UNVERIFIED-LIVE';
  console.log(`${r.service.padEnd(13)} ${r.mode.padEnd(15)} ${state}${state !== 'fixture' ? `   UNVERIFIED-LIVE: ${r.service}: ${r.verify}` : ''}`);
}

const SECRETS = ['DEEPGRAM_API_KEY', 'ANTHROPIC_API_KEY', 'MOSS_PROJECT_KEY', 'MANUS_API_KEY'];
const leaks = walk('web', (p) => /\.(tsx?|mjs|js|json)$/.test(p)).filter((f) => SECRETS.some((k) => readFileSync(join(ROOT, f), 'utf8').includes(k)));
if (leaks.length) {
  console.error(`secret names found in web/: ${leaks.join(', ')}`);
  process.exit(1);
}
