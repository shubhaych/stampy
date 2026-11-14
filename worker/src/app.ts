import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import type { IntegrationStatus, ServerEvent, SystemStatus } from '@cleancase/contracts';
import { WorkerRoutes } from '@cleancase/contracts';
import { FEATURES, type FeatureContext } from './features/index';
import { subscribe } from './events';
import { getControl } from './core/control';
import { containsTruth } from './core/truth';

export function createApp(ctx: FeatureContext): Hono {
  const app = new Hono();
  app.use('*', cors({ origin: (o) => o ?? '*', credentials: true }));

  // Last line of defence for hard rule 15: no JSON response may carry truth keys,
  // except the debrief route, which only serves after certification.
  app.use('*', async (c, next) => {
    await next();
    if (c.req.path.endsWith('/debrief')) return;
    const type = c.res.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) return;
    const body = await c.res.clone().json().catch(() => null);
    if (containsTruth(body)) {
      console.error(`[truth-guard] blocked a response on ${c.req.path}`);
      c.res = c.json({ error: 'response blocked: contained server-only values' }, 500);
    }
  });

  app.get(WorkerRoutes.health, (c) => c.json({ ok: true, machine: ctx.env.MACHINE, slot: ctx.env.SLOT, mode: ctx.env.APP_MODE }));

  app.get(WorkerRoutes.status, (c) => {
    const integrations: IntegrationStatus[] = [];
    for (const f of FEATURES) {
      const s = f.status(ctx);
      if (Array.isArray(s)) integrations.push(...s);
      else if (s) integrations.push(s);
    }
    const unverifiedLive = integrations.filter((i) => i.mode !== 'live').map((i) => i.name);
    const status: SystemStatus = { integrations, control: getControl(ctx.db), unverifiedLive, recomputeMatchRate: null };
    return c.json(status);
  });

  app.get(WorkerRoutes.events, (c) =>
    streamSSE(c, async (stream) => {
      const queue: ServerEvent[] = [{ type: 'hello', at: new Date().toISOString() }];
      let wake: (() => void) | null = null;
      const off = subscribe((e) => {
        queue.push(e);
        wake?.();
      });
      stream.onAbort(() => {
        off();
        wake?.();
      });
      while (!stream.aborted) {
        while (queue.length) {
          const e = queue.shift()!;
          await stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
        }
        await Promise.race([new Promise<void>((r) => (wake = r)), stream.sleep(15000)]);
        wake = null;
        if (!queue.length && !stream.aborted) await stream.writeSSE({ event: 'ping', data: '{}' });
      }
      off();
    }),
  );

  for (const f of FEATURES) f.register(app, ctx);
  return app;
}
