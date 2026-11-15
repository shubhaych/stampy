/**
 * npm run dev — everything for the demo on this slot's ports. Ctrl-C stops all of it.
 *   Postgres (docker compose), PolicyEngine service (:8790), worker (:8787+SLOT), web (:3000+SLOT),
 *   and an ngrok tunnel to the worker when NGROK_AUTHTOKEN is set (Vapi webhooks need a public URL).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, envValue, ports, run } from './lib';

const p = ports();
const env = { ...process.env, SLOT: String(p.slot), WORKER_PORT: String(p.worker), NEXT_PUBLIC_WORKER_URL: process.env.NEXT_PUBLIC_WORKER_URL || `http://localhost:${p.worker}` };

if (run('docker', ['compose', 'up', '-d', '--wait']) !== 0) console.warn('[dev] could not start Postgres with docker compose; is Docker running?');

const procs: ChildProcess[] = [];
const py = join(ROOT, 'services/policyengine/.venv/bin/python');
if (existsSync(py)) procs.push(spawn(py, ['-I', join(ROOT, 'services/policyengine/server.py')], { cwd: ROOT, stdio: 'inherit', env }));
else console.warn('[dev] PolicyEngine not installed: npm run pe:setup (benefits will show "not computed")');

procs.push(spawn('npm', ['run', 'dev', '-w', 'worker'], { cwd: ROOT, stdio: 'inherit', env }));
procs.push(spawn('npm', ['run', 'dev', '-w', 'web', '--', '-p', String(p.web)], { cwd: ROOT, stdio: 'inherit', env }));

const token = envValue('NGROK_AUTHTOKEN');
/** The tunnel is optional (only Vapi webhooks need it). A tunnel failure never takes the rest of the stack down. */
let tunnel: ChildProcess | null = null;
if (token && !envValue('PUBLIC_BASE_URL')) {
  const running = await fetch('http://127.0.0.1:4040/api/tunnels', { signal: AbortSignal.timeout(1000) })
    .then((r) => r.json() as Promise<{ tunnels: { public_url: string }[] }>)
    .catch(() => null);
  if (running?.tunnels.length) {
    console.log(`[dev] ngrok already running on this machine (${running.tunnels.map((t) => t.public_url).join(', ')}); not starting another`);
  } else {
    tunnel = spawn('ngrok', ['http', String(p.worker), '--log', 'stdout', '--log-level', 'warn'], { cwd: ROOT, stdio: 'inherit', env: { ...env, NGROK_AUTHTOKEN: token } });
    tunnel.on('error', (e) => console.warn(`[dev] ngrok could not start (${e.message}). Install it with: brew install ngrok`));
    tunnel.on('exit', (code) => {
      if (!code) return;
      console.warn(
        `[dev] ngrok exited (code ${code}). Everything else keeps running; only phone calls need the tunnel.\n` +
        '      Most common cause: the free ngrok plan allows one agent per account, so the same NGROK_AUTHTOKEN\n' +
        '      cannot run on two machines at once. Run the tunnel on one machine only, or use your own token.',
      );
    });
  }
}

console.log(`[dev] web http://localhost:${p.web}  worker http://localhost:${p.worker}  policyengine http://127.0.0.1:8790${token ? '  ngrok → worker' : ''}`);
const stop = () => [...procs, ...(tunnel ? [tunnel] : [])].forEach((c) => c.kill('SIGINT'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((c) => c.on('exit', (code) => { if (code) { stop(); process.exit(code); } }));
