/** npm run feature:list — git fetch, then read .features/*.md from every remote branch. One claim file per branch, so no conflicts. */
import { git, parseClaim } from './lib';

git('fetch', '--prune', 'origin');
const branches = git('for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin').split('\n').filter((b) => /^origin\/([ab]|infra|contract)\//.test(b));
const local = git('for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n').filter((b) => /^([ab])\//.test(b) && !branches.includes(`origin/${b}`));

const rows: string[][] = [];
for (const ref of [...branches, ...local]) {
  const slug = ref.split('/').pop()!;
  const text = git('show', `${ref}:.features/${slug}.md`);
  const c = text ? parseClaim(text) : null;
  const last = git('log', '-1', '--format=%cr', ref);
  rows.push([ref.replace(/^origin\//, ''), c?.machine?.toUpperCase() ?? '?', c?.status ?? 'no claim file', last, (c?.owns ?? []).join(' ')]);
}
if (!rows.length) {
  console.log('feature:list: no feature branches yet.');
  process.exit(0);
}
const w = [0, 1, 2, 3].map((i) => Math.max(...rows.map((r) => r[i]!.length), 6));
console.log(['branch'.padEnd(w[0]!), 'm'.padEnd(w[1]!), 'status'.padEnd(w[2]!), 'updated'.padEnd(w[3]!), 'owns'].join('  '));
for (const r of rows) console.log([r[0]!.padEnd(w[0]!), r[1]!.padEnd(w[1]!), r[2]!.padEnd(w[2]!), r[3]!.padEnd(w[3]!), r[4]].join('  '));
