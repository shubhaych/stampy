/** npm run dev — worker and web together on this slot's ports. Ctrl-C stops both. */
import { spawn } from 'node:child_process';
import { ROOT, ports } from './lib';

const p = ports();
console.log(`[dev] slot ${p.slot}: web http://localhost:${p.web}  worker http://localhost:${p.worker}`);
const env = { ...process.env, SLOT: String(p.slot), WORKER_PORT: String(p.worker), NEXT_PUBLIC_WORKER_URL: process.env.NEXT_PUBLIC_WORKER_URL || `http://localhost:${p.worker}` };
const procs = [
  spawn('npm', ['run', 'dev', '-w', 'worker'], { cwd: ROOT, stdio: 'inherit', env }),
  spawn('npm', ['run', 'dev', '-w', 'web', '--', '-p', String(p.web)], { cwd: ROOT, stdio: 'inherit', env }),
];
const stop = () => procs.forEach((c) => c.kill('SIGINT'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((c) => c.on('exit', (code) => { if (code) { stop(); process.exit(code); } }));
