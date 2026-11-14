/**
 * Adapter template (master prompt section 15). Copy for every integration.
 * fixtureRun() reads worker/fixtures/<name>/*.json; liveRun() calls the vendor;
 * parse() fails closed to { status: 'needs_human' }, never to a decision.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { z } from 'zod';
import type { Prov, NeedsHuman } from '@stampy/contracts';

export type Mode = 'fixture' | 'live';

export interface AdapterResult<O> {
  output: O | NeedsHuman;
  prov: Prov;
  ms: number;
  costNote?: string;
}

export interface Adapter<I, O> {
  name: string;
  mode(): Mode;
  available(): boolean;
  run(input: I): Promise<AdapterResult<O>>;
}

export const FIXTURES_DIR = resolve(import.meta.dirname, '../../../fixtures');

export function readFixture<T = unknown>(adapter: string, file: string): T | null {
  const p = join(FIXTURES_DIR, adapter, file);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as T;
}

/** Validate untrusted output. One repair attempt is the caller's job; this never throws and never decides. */
export function parseFailClosed<S extends z.ZodTypeAny>(schema: S, raw: unknown): z.infer<S> | NeedsHuman {
  const r = schema.safeParse(raw);
  if (r.success) return r.data;
  return { status: 'needs_human', reason: `unreadable output: ${r.error.issues[0]?.message ?? 'schema mismatch'}` };
}

export async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t0) };
}

/** Example adapter. Copy this file, rename, and fill liveRun. */
export function exampleAdapter<I, O>(name: string, schema: z.ZodType<O>, opts: { mode: Mode; hasKey: boolean; fixtureFile: (input: I) => string; liveRun?: (input: I) => Promise<unknown> }): Adapter<I, O> {
  return {
    name,
    mode: () => (opts.mode === 'live' && opts.hasKey ? 'live' : 'fixture'),
    available: () => true,
    async run(input) {
      const live = opts.mode === 'live' && opts.hasKey && opts.liveRun;
      const { value, ms } = await timed(async () => (live ? opts.liveRun!(input) : readFixture(name, opts.fixtureFile(input))));
      return { output: parseFailClosed(schema, value) as O | NeedsHuman, prov: live ? 'live' : 'fixture', ms };
    },
  };
}
