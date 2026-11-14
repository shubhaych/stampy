/**
 * npm run check:badges — hard rule 8: every rendered figure has an adjacent badge.
 * Static pass over web/ TSX: a money/percent literal in JSX text, or a call to money()/pct()/signedMoney(),
 * must sit within 4 lines of <Fig>, <Badge>, a prov= prop, or data-figure. The Playwright smoke test
 * adds the runtime pass: every $ or % text node in the DOM lives inside [data-figure] with a [data-prov].
 * Escape hatch for a non-figure (for example a CSS value): put `badge-ok` in a comment on that line.
 * Section-level notes: a file that uses data-prov-scope="<id>" (pitch pages) is checked at runtime instead, where the
 * smoke test requires the referenced [data-prov-note] element to exist and be visible.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, walk } from './lib';

const FIGURE_CALL = /\{\s*(?:money|pct|signedMoney)\(/;
const FIGURE_TEXT = />[^<{]*(?:\$\s?\d|\d(?:\.\d+)?\s?%|\d(?:\.\d+)?\s?B\b)[^<{]*</;
const NEARBY = /<Fig\b|<Badge\b|\bprov=|data-figure|<Odometer\b|<Stat\b/;

const problems: string[] = [];
const files = walk('web', (p) => p.endsWith('.tsx') && !p.includes('/ui/badge') && !p.includes('/ui/fig'));
for (const f of files) {
  const src = readFileSync(join(ROOT, f), 'utf8');
  if (src.includes('data-prov-scope')) continue;
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('badge-ok')) return;
    if (!FIGURE_CALL.test(line) && !FIGURE_TEXT.test(line)) return;
    const window = lines.slice(Math.max(0, i - 4), i + 5).join('\n');
    if (!NEARBY.test(window)) problems.push(`${f}:${i + 1}: figure without an adjacent badge: ${line.trim().slice(0, 120)}`);
  });
}

if (problems.length) {
  console.error(`check:badges FAILED (${problems.length})\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`check:badges: ${files.length} TSX files, every figure has a badge nearby.`);
