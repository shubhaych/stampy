/** Optional standalone read-only QC worker; the regular app mounts these same routes. */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { registerQc } from './routes';

const app = new Hono();
registerQc(app);
const port = Number(process.env.QC_PORT ?? 8791);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid QC_PORT');
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });
console.log(`Public QC data worker listening on http://127.0.0.1:${port}`);
