/** Shared helpers for repo scripts (ops). No dependencies beyond Node. */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..');

export function sh(cmd: string, args: string[], opts: { cwd?: string; allowFail?: boolean } = {}): string {
  try {
    return execFileSync(cmd, args, { cwd: opts.cwd ?? ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    if (opts.allowFail) return '';
    throw e;
  }
}

export function git(...args: string[]): string {
  return sh('git', args, { allowFail: true });
}

/** Run a command with inherited stdio; returns the exit code. */
export function run(cmd: string, args: string[], cwd = ROOT): number {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  return r.status ?? 1;
}

export function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of ['.env.local', '.env']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*([^#\n]*?)\s*(?:#.*)?$/);
      if (m && !(m[1]! in out)) out[m[1]!] = m[2]!;
    }
  }
  return out;
}

export function envValue(key: string, fallback = ''): string {
  return process.env[key] || loadEnvLocal()[key] || fallback;
}

/** Minimal glob → RegExp: supports **, *, ?, and {a,b}. Paths are repo-relative with forward slashes. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/';
        re += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      re += `(?:${glob.slice(i + 1, end).split(',').map((s) => s.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')).join('|')})`;
      i = end;
    } else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(path: string, globs: string[]): string | null {
  for (const g of globs) if (globToRegExp(g).test(path)) return g;
  return null;
}

export interface OwnerRow { slug: string; machine: 'a' | 'b'; paths: string[] }

/** Parse the ownership table in OWNERS.md. */
export function readOwners(): OwnerRow[] {
  const md = readFileSync(join(ROOT, 'OWNERS.md'), 'utf8');
  const rows: OwnerRow[] = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*`([a-z0-9-]+)`\s*\|\s*([AB])\s*\|\s*(.+?)\s*\|\s*$/);
    if (!m) continue;
    const paths = [...m[3]!.matchAll(/`([^`]+)`/g)].map((x) => x[1]!);
    rows.push({ slug: m[1]!, machine: m[2]!.toLowerCase() as 'a' | 'b', paths });
  }
  return rows;
}

/** The owning feature for a path: the most specific (longest literal prefix) matching row. */
export function ownerOf(path: string, owners = readOwners()): OwnerRow | null {
  let best: { row: OwnerRow; score: number } | null = null;
  for (const row of owners) {
    for (const g of row.paths) {
      if (!globToRegExp(g).test(path)) continue;
      const score = g.replace(/\*.*$/, '').length + (g.includes('*') ? 0 : 1000);
      if (!best || score > best.score) best = { row, score };
    }
  }
  return best?.row ?? null;
}

export const FROZEN = [
  'packages/contracts/**', 'db/migrate.ts', 'worker/src/features/index.ts', 'web/app/layout.tsx',
  'web/styles/tokens.css', '**/package.json', 'package-lock.json', '.env.example', '.npmrc',
];

export interface Claim { slug: string; machine: string; owns: string[]; reads: string[]; status: string; transferredFrom?: string; rebuild?: boolean }

/** Parse a .features/<slug>.md claim file (YAML-ish front matter, one-line arrays). */
export function parseClaim(text: string): Claim | null {
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const get = (k: string) => fm[1]!.match(new RegExp(`^${k}:\\s*(.*?)\\s*(?:#.*)?$`, 'm'))?.[1] ?? '';
  const arr = (k: string) => {
    const v = get(k);
    return v.startsWith('[') ? [...v.matchAll(/"([^"]+)"|'([^']+)'/g)].map((m) => m[1] ?? m[2]!) : [];
  };
  return { slug: get('slug'), machine: get('machine'), owns: arr('owns'), reads: arr('reads'), status: get('status'), transferredFrom: get('transferred_from') || undefined, rebuild: get('rebuild') === 'true' };
}

export function walk(dir: string, filter: (p: string) => boolean, skip = /(^|\/)(node_modules|\.next|\.git|test-results|playwright-report)(\/|$)/): string[] {
  const out: string[] = [];
  const abs = resolve(ROOT, dir);
  if (!existsSync(abs)) return out;
  const visit = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const rel = relative(ROOT, p).split('\\').join('/');
      if (skip.test(rel)) continue;
      if (statSync(p).isDirectory()) visit(p);
      else if (filter(rel)) out.push(rel);
    }
  };
  visit(abs);
  return out;
}

export function slot(): number {
  const n = Number(envValue('SLOT', '0'));
  return Number.isFinite(n) ? n : 0;
}

export function ports() {
  const s = slot();
  return { slot: s, web: 3000 + s, worker: Number(envValue('WORKER_PORT')) || 8787 + s };
}
