import { serve } from '@hono/node-server';
import { createApp } from './app';
import { getDb } from './db';
import { env } from './env';
import { discoverTunnel } from './tunnel';
import { ensureInbox, listenWebSocket } from './email/agentmail';
import { onInboundEmail } from './pipeline';
import { findPhoneNumber, pointNumberAt } from './voice/vapi';
import { policyEngineHealth } from './rules/benefit';

process.on('unhandledRejection', (e) => console.error('[worker] unhandled rejection', e));

const db = await getDb();
const app = createApp(db);

serve({ fetch: app.fetch, port: env.WORKER_PORT }, (info) => {
  console.log(`[worker] listening on http://localhost:${info.port}  ai=${env.AI_MODE} email=${env.EMAIL_MODE} voice=${env.VOICE_MODE}`);
});

/** Live wiring. Each step logs and carries on if it fails; the app still runs in fixture mode. */
async function wireLive() {
  const pe = await policyEngineHealth();
  console.log(pe.ok ? `[rules] policyengine-us ${pe.version} at ${env.POLICYENGINE_URL}` : `[rules] PolicyEngine not reachable at ${env.POLICYENGINE_URL} (npm run pe:serve); benefits will show "not computed"`);

  if (env.EMAIL_MODE === 'live') {
    try {
      const ib = await ensureInbox(false);
      if (!ib) console.log('[agentmail] no Stampy inbox yet: run npm run live:setup');
      else {
        console.log(`[agentmail] sending from ${ib.email ?? ib.inbox_id}`);
        if (env.AGENTMAIL_EVENTS === 'websocket') listenWebSocket((m) => void onInboundEmail(db, m).catch((e) => console.error('[agentmail] inbound', e)));
      }
    } catch (e) {
      console.log(`[agentmail] ${(e as Error).message}`);
    }
  }

  if (env.VOICE_MODE === 'live') {
    let base: string | null = null;
    for (let i = 0; i < 15 && !base; i++) {
      base = await discoverTunnel();
      if (!base) await new Promise((r) => setTimeout(r, 1000));
    }
    try {
      const phone = await findPhoneNumber();
      if (!phone) console.log('[vapi] no phone number yet: run npm run live:setup');
      else if (!base) console.log(`[vapi] ${phone.number ?? phone.id}: no public URL (start ngrok or set PUBLIC_BASE_URL); calls cannot reach this worker`);
      else {
        const url = `${base}/webhooks/vapi`;
        if (phone.server?.url !== url || phone.assistantId) {
          await pointNumberAt(phone.id, url, env.WEBHOOK_SECRET ? { 'x-stampy-secret': env.WEBHOOK_SECRET } : {});
        }
        console.log(`[vapi] ${phone.number ?? phone.id} (${phone.status ?? 'unknown'}) → ${url}`);
      }
    } catch (e) {
      console.log(`[vapi] ${(e as Error).message}`);
    }
  }
}
void wireLive();
