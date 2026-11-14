import { serve } from '@hono/node-server';
import { createApp } from './app';
import { getDb } from './db';
import { env } from './env';

const app = createApp({ db: getDb(), env });

serve({ fetch: app.fetch, port: env.WORKER_PORT }, (info) => {
  console.log(`[worker] machine=${env.MACHINE} slot=${env.SLOT} mode=${env.APP_MODE} listening on http://localhost:${info.port}`);
});
