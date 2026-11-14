/**
 * npm run check:ownership [-- --staged]
 * Fails if the branch changed a file outside its claim file's `owns` (plus the implicit allowances),
 * or touched a frozen hot file outside an infra/ or contract/ branch. Names the owning feature.
 * Not enforced before tag scaffold-v1 exists (Phase 0 may touch every path).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FROZEN, ROOT, git, matchesAny, ownerOf, parseClaim, readOwners } from './lib';

const staged = process.argv.includes('--staged');

function fail(msg: string): never {
  console.error(`check:ownership FAILED\n${msg}`);
  process.exit(1);
}

if (!git('tag', '--list', 'scaffold-v1')) {
  console.log('check:ownership: scaffold-v1 not tagged yet; ownership is not enforced during Phase 0.');
  process.exit(0);
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch === 'main' || branch === 'HEAD') {
  const changed = staged ? git('diff', '--cached', '--name-only') : '';
  const frozen = changed.split('\n').filter(Boolean).filter((f) => matchesAny(f, FROZEN));
  if (frozen.length) console.warn(`check:ownership: warning, frozen files staged on ${branch}: ${frozen.join(', ')} (use an infra/ or contract/ PR)`);
  console.log(`check:ownership: on ${branch}; feature ownership applies on <machine>/<slug> branches.`);
  process.exit(0);
}

const base = git('merge-base', 'HEAD', 'origin/main') || git('merge-base', 'HEAD', 'main');
const files = new Set<string>();
for (const f of git('diff', '--name-only', `${base}...HEAD`).split('\n')) if (f) files.add(f);
for (const f of git('diff', '--cached', '--name-only').split('\n')) if (f) files.add(f);
if (!staged) for (const f of git('diff', '--name-only').split('\n')) if (f) files.add(f);

const changedLines = Number(git('diff', '--shortstat', `${base}`).match(/(\d+) insertion/)?.[1] ?? 0) + Number(git('diff', '--shortstat', `${base}`).match(/(\d+) deletion/)?.[1] ?? 0);

if (/^(infra|contract)\//.test(branch)) {
  if (changedLines > 150) fail(`${branch}: infra/contract PRs must stay under 150 changed lines (now ${changedLines}).`);
  console.log(`check:ownership: ${branch} is an ${branch.split('/')[0]} branch (${changedLines} lines); frozen files allowed.`);
  process.exit(0);
}

const m = branch.match(/^([ab])\/([a-z0-9-]+)$/);
if (!m) fail(`branch "${branch}" is not <a|b>/<slug>, infra/<x> or contract/<x>. Start work with: npm run feature:start -- <a|b> <slug>`);
const [, machine, slug] = m;
const claimPath = join(ROOT, '.features', `${slug}.md`);
if (!existsSync(claimPath)) fail(`no claim file .features/${slug}.md. Run: npm run feature:start -- ${machine} ${slug}`);
const claim = parseClaim(readFileSync(claimPath, 'utf8'));
if (!claim || !claim.owns.length) fail(`.features/${slug}.md has no owns list`);

const owners = readOwners();
const implicit = [`.features/${slug}.md`, `status/${machine}.md`, `e2e/${slug}/**`, `env/${slug}.env`, `docs/${slug}.md`, `worker/test/${slug}/**`, 'PROGRESS.md'];
const allowed = [...claim.owns, ...implicit];
const problems: string[] = [];
for (const f of [...files].sort()) {
  if (matchesAny(f, FROZEN)) {
    problems.push(`  ${f}: frozen hot file; change it through an infra/ or contract/ PR (<150 lines)`);
    continue;
  }
  if (matchesAny(f, allowed)) continue;
  const owner = ownerOf(f, owners);
  problems.push(`  ${f}: owned by ${owner ? `\`${owner.slug}\` (machine ${owner.machine.toUpperCase()})` : 'no feature (add it to OWNERS.md via an infra/ PR)'}`);
}

// owns must sit inside this feature's OWNERS paths unless transferred.
const row = owners.find((r) => r.slug === (claim.transferredFrom ?? slug)) ?? owners.find((r) => r.slug === slug);
if (row) {
  for (const g of claim.owns) {
    const literal = g.replace(/\*.*$/, '');
    if (!row.paths.some((p) => literal.startsWith(p.replace(/\*.*$/, '')) || p === g)) problems.push(`  claim owns "${g}" outside ${row.slug}'s OWNERS paths (add transferred_from or fix the claim)`);
  }
}

if (problems.length) fail(`${branch} changed files outside its claim:\n${problems.join('\n')}\nIf you need a change there, write it under "Needs from the other machine" in .features/${slug}.md and status/${machine}.md.`);
console.log(`check:ownership: ${files.size} changed files, all inside ${slug}'s claim.`);
