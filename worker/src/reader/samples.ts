/** The generated demo documents in data/samples (images + sidecar JSON with exact field text and boxes). */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BBox } from '@stampy/contracts/stampy';
import { env } from '../env';

export interface SampleField { field: string; value: string; page: number; line: string; bbox: BBox; confidence: number }
export interface Sample {
  name: string; label: string; filename: string; contentType: string; kind: string;
  description: string; uploadByDefault: boolean; synthetic: boolean; summary: string; fields: SampleField[];
}

const DIR = join(env.ROOT, 'data/samples');
let cache: { list: Sample[]; bySha: Map<string, Sample> } | null = null;

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function load() {
  if (cache) return cache;
  const list: Sample[] = [];
  const bySha = new Map<string, Sample>();
  const index = join(DIR, 'index.json');
  if (existsSync(index)) {
    for (const entry of JSON.parse(readFileSync(index, 'utf8')) as { name: string }[]) {
      const side = join(DIR, `${entry.name}.json`);
      if (!existsSync(side)) continue;
      const s = JSON.parse(readFileSync(side, 'utf8')) as Sample;
      const file = join(DIR, s.filename);
      if (!existsSync(file)) continue;
      list.push(s);
      bySha.set(sha256(readFileSync(file)), s);
    }
  }
  cache = { list, bySha };
  return cache;
}

export function listSamples(): Sample[] {
  return load().list;
}

export function sampleBytes(name: string): { sample: Sample; bytes: Buffer } | null {
  const s = load().list.find((x) => x.name === name);
  if (!s) return null;
  return { sample: s, bytes: readFileSync(join(DIR, s.filename)) };
}

export function sampleBySha(sha: string): Sample | null {
  return load().bySha.get(sha) ?? null;
}
