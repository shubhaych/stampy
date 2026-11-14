/** npm run dev-ports — WEB_PORT=3000+SLOT, WORKER_PORT=8787+SLOT so several worktrees can run at once. */
import { envValue, ports } from './lib';

const p = ports();
console.log(`MACHINE=${envValue('MACHINE', 'a')} SLOT=${p.slot} WEB_PORT=${p.web} WORKER_PORT=${p.worker}`);
