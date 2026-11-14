/** npm run sync — fetch, rebase on origin/main, install, migrate, env:build, check. Run before work and before every push. */
import { git, run } from './lib';

const steps: [string, string[]][] = [
  ['git', ['fetch', 'origin']],
  ['git', ['rebase', 'origin/main']],
  ['npm', ['install']],
  ['npm', ['run', 'db:migrate']],
  ['npm', ['run', 'env:build']],
  ['npm', ['run', 'check']],
];
const hasRemoteMain = Boolean(git('rev-parse', '--verify', 'origin/main'));
for (const [cmd, args] of steps) {
  if (cmd === 'git' && !hasRemoteMain && args[0] === 'rebase') {
    console.log('[sync] no origin/main yet; skipping rebase');
    continue;
  }
  console.log(`\n[sync] ${cmd} ${args.join(' ')}`);
  const code = run(cmd, args);
  if (code !== 0) {
    console.error(`[sync] stopped: ${cmd} ${args.join(' ')} exited ${code}`);
    process.exit(code);
  }
}
console.log('\n[sync] done');
