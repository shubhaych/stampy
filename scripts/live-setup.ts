/**
 * npm run live:setup — one-time live wiring (safe to re-run; it finds before it creates).
 *  1. AgentMail: find or create the Stampy inbox (stampy-benefits@agentmail.to).
 *  2. Vapi: find the phone number, or create one free Vapi number (inbound only), and point it at
 *     <public url>/webhooks/vapi with the shared-secret header. The worker re-points it on every start.
 * Needs the worker's public URL: PUBLIC_BASE_URL, or a running ngrok tunnel (npm run dev starts one).
 */
import { env } from '../worker/src/env';
import { ensureInbox } from '../worker/src/email/agentmail';
import { createFreeNumber, findPhoneNumber, pointNumberAt } from '../worker/src/voice/vapi';
import { discoverTunnel } from '../worker/src/tunnel';

const areaCode = process.argv.find((a) => /^--area=\d{3}$/.test(a))?.slice(7) ?? '415';
const headers: Record<string, string> = env.WEBHOOK_SECRET ? { 'x-stampy-secret': env.WEBHOOK_SECRET } : {};

if (env.EMAIL_MODE === 'live') {
  const ib = await ensureInbox(true);
  console.log(`AgentMail inbox: ${ib?.email ?? ib?.inbox_id}`);
} else console.log('AgentMail: fixture mode (no AGENTMAIL_API_KEY); skipped');

if (env.VOICE_MODE === 'live') {
  const base = await discoverTunnel();
  if (!base) {
    console.error('No public URL. Start the tunnel first (npm run dev, or ngrok http 8787) or set PUBLIC_BASE_URL.');
    process.exit(1);
  }
  const url = `${base}/webhooks/vapi`;
  let phone = await findPhoneNumber();
  if (!phone) {
    phone = await createFreeNumber(areaCode, url, headers);
    console.log(`Vapi: created a free number in area code ${areaCode} (activation can take a few minutes)`);
  } else {
    phone = await pointNumberAt(phone.id, url, headers);
  }
  console.log(`Vapi number: ${phone.number ?? '(number pending)'}  id=${phone.id}  status=${phone.status ?? '?'}  → ${url}`);
  if (!env.WEBHOOK_SECRET) console.log('Warning: STAMPY_WEBHOOK_SECRET is empty, so the webhook accepts unauthenticated calls.');
} else console.log('Vapi: fixture mode (no VAPI_PRIVATE_API_KEY); skipped');
