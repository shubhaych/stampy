/**
 * npm run check:rules — enforces AGENTS.md hard rules that can be grepped.
 *  1. Banned words in UI strings (rule 4). A hit is allowed only when it is negated in the same sentence
 *     ("We never deny", "does not detect fraud") or is a quoted source title in data/sources.json.
 *     Comments are stripped before scanning: they are not UI strings.
 *  2. Disallowed claims (section 3 "Not allowed on screen").
 *  3. Server keys never appear in web/ (rule 12).
 *  4. The footer line renders on every page (rule 10).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, walk } from './lib';

const BANNED = ['fraud', 'scam', 'deny', 'denied', 'denial', 'auto-approve', 'auto-correct', 'guarantee', 'FNA-approved', 'compliant with Pub 1075'];
const CLAIMS: [RegExp, string][] = [
  [/\$40\s?M\b/i, 'Mississippi "$40M" claim is unsupported'],
  [/\b\d+(\.\d+)?\s?% fewer errors/i, '"X% fewer errors" figures are not allowed'],
  [/reduc\w* (?:a |the |your |each )?(?:state'?s? )?error rate by/i, 'error-rate reduction claims are not allowed'],
  [/\b(FedRAMP|StateRAMP)\b/i, 'authorization claims are not allowed'],
  [/\bPub(?:lication)?\s?1075\b/i, 'Pub 1075 claims are not allowed'],
  [/\bintegrated with (CalSAWS|TIERS)/i, 'state-system integration claims are not allowed'],
];
const NEGATION = /\b(never|not|no|nor|without|don['’]t|doesn['’]t|won['’]t|cannot|can['’]t)\b/i;
const SECRETS = ['DEEPGRAM_API_KEY', 'ANTHROPIC_API_KEY', 'MOSS_PROJECT_KEY', 'MANUS_API_KEY', 'RESEND_API_KEY', 'TWILIO_AUTH_TOKEN', 'WHATSAPP_ACCESS_TOKEN', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'MEDIA_SIGNING_SECRET'];

const UI_DIRS = ['web/app', 'web/components', 'web/lib', 'packages/contracts/src', 'packages/contracts/fixtures', 'packages/snap-rules/src', 'data/states.json'];

function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
}

function sourceTitles(): string[] {
  const p = join(ROOT, 'data/sources.json');
  if (!existsSync(p)) return [];
  const j = JSON.parse(readFileSync(p, 'utf8')) as { sources?: { title?: string }[] };
  return (j.sources ?? []).map((s) => s.title ?? '').filter(Boolean);
}

const problems: string[] = [];
const titles = sourceTitles();

const files = UI_DIRS.flatMap((d) => (d.endsWith('.json') ? [d] : walk(d, (p) => /\.(tsx?|json|md)$/.test(p) && !/\.test\.tsx?$/.test(p))));
for (const f of files) {
  const raw = readFileSync(join(ROOT, f), 'utf8');
  const src = /\.tsx?$/.test(f) ? stripComments(raw) : raw;
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    for (const word of BANNED) {
      const re = new RegExp(`\\b${word.replace(/[-]/g, '\\-')}\\b`, 'gi');
      for (const hit of line.matchAll(re)) {
        if (titles.some((t) => line.includes(t))) continue;
        const before = line.slice(0, hit.index).split(/[.!?;:·]/).pop() ?? '';
        if (NEGATION.test(before)) continue;
        problems.push(`${f}:${i + 1}: banned word "${word}" in a UI string (rule 4): ${line.trim().slice(0, 120)}`);
      }
    }
    for (const [re, why] of CLAIMS) {
      const hit = line.match(re);
      if (!hit) continue;
      const before = line.slice(0, hit.index).split(/[.!?;:·]/).pop() ?? '';
      if (NEGATION.test(before)) continue;
      problems.push(`${f}:${i + 1}: ${why}: ${line.trim().slice(0, 120)}`);
    }
  });
}

for (const f of walk('web', (p) => /\.(tsx?|mjs|js|json|css|env)$/.test(p) || /\.env/.test(p))) {
  const src = readFileSync(join(ROOT, f), 'utf8');
  for (const k of SECRETS) if (src.includes(k)) problems.push(`${f}: server key name ${k} in web/ (rule 12)`);
}

const layout = join(ROOT, 'web/app/layout.tsx');
if (existsSync(layout) && !/<Footer\b/.test(readFileSync(layout, 'utf8'))) problems.push('web/app/layout.tsx does not render <Footer /> (rule 10)');
const routesTs = join(ROOT, 'packages/contracts/src/routes.ts');
const footer = 'Synthetic demo documents. No real applicants. Stampy flags and cites; a merit-staff worker decides. Not an eligibility system.';
if (existsSync(routesTs) && !readFileSync(routesTs, 'utf8').includes(footer)) problems.push('FOOTER_TEXT in packages/contracts/src/routes.ts is not the verbatim rule 10 line');

if (problems.length) {
  console.error(`check:rules FAILED (${problems.length})\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`check:rules: ${files.length} UI source files clean; no server keys in web/; footer wired.`);
