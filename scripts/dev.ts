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
if (token && !envValue('PUBLIC_BASE_URL')) {
  procs.push(spawn('ngrok', ['http', String(p.worker), '--log', 'stdout', '--log-level', 'warn'], { cwd: ROOT, stdio: 'inherit', env: { ...env, NGROK_AUTHTOKEN: token } }));
}

console.log(`[dev] web http://localhost:${p.web}  worker http://localhost:${p.worker}  policyengine http://127.0.0.1:8790${token ? '  ngrok → worker' : ''}`);
const stop = () => procs.forEach((c) => c.kill('SIGINT'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((c) => c.on('exit', (code) => { if (code) { stop(); process.exit(code); } }));
