/** npm run check — typecheck, unit tests, check:rules, check:badges, check:ownership. Stops at the first failure. */
import { run } from './lib';

const steps: [string, string[]][] = [
  ['npm', ['run', 'typecheck']],
  ['npm', ['test']],
  ['npm', ['run', 'check:rules']],
  ['npm', ['run', 'check:badges']],
  ['npm', ['run', 'check:ownership']],
];
for (const [cmd, args] of steps) {
  console.log(`\n[check] ${args.slice(1).join(' ')}`);
  const code = run(cmd, args);
  if (code !== 0) {
    console.error(`\n[check] FAILED at ${args.slice(1).join(' ')}`);
    process.exit(code);
  }
}
console.log('\n[check] all green');
