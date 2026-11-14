/**
 * npm run feature:start -- <a|b> <slug> [--no-worktree] [--no-push]
 * Creates branch <machine>/<slug>, a worktree at ../cleancase-wt/<machine>-<slug>, and the claim file
 * .features/<slug>.md with `owns` copied from OWNERS.md. Commits and pushes immediately so
 * `npm run feature:list` shows the claim on the other machine.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, git, readOwners, sh } from './lib';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const [machine, slug] = args;
if (!machine || !/^[ab]$/.test(machine) || !slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('usage: npm run feature:start -- <a|b> <slug> [--no-worktree] [--no-push]');
  process.exit(1);
}

const owners = readOwners();
const row = owners.find((r) => r.slug === slug);
if (!row) console.warn(`warning: ${slug} is not a row in OWNERS.md; fill owns by hand (must sit inside an owner's paths or set transferred_from).`);
if (row && row.machine !== machine) console.warn(`warning: ${slug} belongs to machine ${row.machine.toUpperCase()}. Claiming it from machine ${machine.toUpperCase()} is a transfer: set transferred_from and tell the other machine in status/${machine}.md.`);

const branch = `${machine}/${slug}`;
git('fetch', 'origin', 'main');
const base = git('rev-parse', '--verify', 'origin/main') ? 'origin/main' : 'main';
const useWorktree = !flags.has('--no-worktree');
const wt = resolve(ROOT, '..', 'cleancase-wt', `${machine}-${slug}`);
let cwd = ROOT;
if (useWorktree) {
  mkdirSync(resolve(wt, '..'), { recursive: true });
  if (existsSync(wt)) {
    console.error(`worktree ${wt} already exists`);
    process.exit(1);
  }
  sh('git', ['worktree', 'add', '-b', branch, wt, base]);
  cwd = wt;
} else {
  sh('git', ['checkout', '-b', branch, base]);
}

const owns = row?.paths ?? [];
const claim = `---
slug: ${slug}
machine: ${machine}
owns: [${owns.map((p) => `"${p}"`).join(', ')}]
reads: ["packages/contracts/**"]
touches_module: false
needs_deps: []
status: claimed        # claimed | in-review | merged
---
## Needs from the other machine
## Notes
`;
mkdirSync(join(cwd, '.features'), { recursive: true });
writeFileSync(join(cwd, '.features', `${slug}.md`), claim);
sh('git', ['add', `.features/${slug}.md`], { cwd });
sh('git', ['commit', '-m', `Claim ${slug} (machine ${machine})`, '--no-verify'], { cwd });
if (!flags.has('--no-push')) {
  const pushed = sh('git', ['push', '-u', 'origin', branch], { cwd, allowFail: true });
  console.log(pushed || `note: push failed; run \`git push -u origin ${branch}\` when online.`);
}
console.log(`\nfeature:start: ${branch} ready${useWorktree ? ` in ${wt}` : ''}.\nNext: cd there, create .env.local (MACHINE=${machine}, SLOT=<0-9>), npm i, npm run sync.`);
