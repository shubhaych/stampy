import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { RELEASE, STATE_CODES } from './release';

/** Explicit allowlist. No income, error coding or constructed QC benefit leaves this boundary. */
export const PublicRecord = z.object({
  id: z.string(), householdId: z.string(), state: z.string(), stateName: z.string(), stateFips: z.string(),
  sampleMonth: z.string(), householdSize: z.number().int().nullable(), benefitMonthly: z.number().nullable(),
  sourceRecord: z.number().int().positive(), prov: z.literal('replay'),
});
export type PublicRecord = z.infer<typeof PublicRecord>;
export const StateCount = z.object({ code: z.string(), name: z.string(), count: z.number().int() });
export const Manifest = z.object({
  fiscalYear: z.number().int(), catalogUrl: z.string().url(), sourceUrl: z.string().url(), dictionaryUrl: z.string().url(),
  archiveSha256: z.string(), csvSha256: z.string(), indexSha256: z.string(), archiveMember: z.string(),
  retrievedAt: z.string(), rowCount: z.number().int(), columnCount: z.number().int(), bytes: z.number().int(),
  states: StateCount.array(),
});
export type Manifest = z.infer<typeof Manifest>;
export const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

/** RFC-style CSV handling, including escaped quotes, CRLF and quoted newlines. */
export function* csvRows(text: string): Generator<string[]> {
  let row: string[] = [], field = '', quoted = false, closed = false;
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += ch;
    } else if (ch === ',') { row.push(field); field = ''; closed = false; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); yield row; row = []; field = ''; closed = false;
    } else if (ch === '"' && !field && !closed) quoted = true;
    else {
      if (closed || ch === '"') throw new Error('Malformed CSV quote');
      field += ch;
    }
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (field.length || row.length || closed) { row.push(field); yield row; }
}

const missingNumber = (value: string, label: string, max: number): number | null => {
  if (value === '' || value === '.') return null;
  if (!/^\d+$/.test(value) || Number(value) > max) throw new Error(`Invalid ${label}`);
  return Number(value);
};

/** R means QC Review Schedule reported, NOT original state-budget income. Only certified fields below are surfaced. */
export function projectCsv(csv: string, expected?: { rowCount: number; columnCount: number }): PublicRecord[] {
  const iterator = csvRows(csv);
  const header = iterator.next().value as string[] | undefined;
  if (!header || new Set(header).size !== header.length) throw new Error('Missing or duplicate CSV columns');
  const fields = ['HHLDNO', 'STATE', 'STATENAME', 'YRMONTH', 'CERTHHSZ', 'RAWBEN'];
  if (fields.some((f) => !header.includes(f))) throw new Error('Required QC columns are missing');
  if (expected && header.length !== expected.columnCount) throw new Error('QC column count changed');
  const columns = Object.fromEntries(fields.map((f) => [f, header.indexOf(f)]));
  const records: PublicRecord[] = [], ids = new Set<string>();
  for (const values of iterator) {
    if (values.length !== header.length) throw new Error(`CSV record ${records.length + 1} has the wrong column count`);
    const value = (f: string) => values[columns[f]!]!.trim();
    const householdId = value('HHLDNO'), stateFips = value('STATE').padStart(2, '0'), month = value('YRMONTH');
    if (!/^\d+$/.test(householdId) || ids.has(householdId)) throw new Error('Invalid or duplicate public household ID');
    if (!STATE_CODES[stateFips] || !value('STATENAME')) throw new Error('Unknown state');
    if (!/^2023(10|11|12)$|^2024(0[1-9])$/.test(month)) throw new Error('Sample month is outside fiscal year 2024');
    const householdSize = missingNumber(value('CERTHHSZ'), 'certified household size', 15);
    if (householdSize === 0) throw new Error('Certified household size cannot be zero');
    ids.add(householdId);
    records.push(PublicRecord.parse({
      id: `qc-2024-${householdId}`, householdId, state: STATE_CODES[stateFips], stateFips, stateName: value('STATENAME'),
      sampleMonth: `${month.slice(0, 4)}-${month.slice(4)}`, householdSize,
      benefitMonthly: missingNumber(value('RAWBEN'), 'certified benefit', 7075), sourceRecord: records.length + 1, prov: 'replay',
    }));
  }
  if (expected && records.length !== expected.rowCount) throw new Error(`Row count mismatch: ${records.length} instead of ${expected.rowCount}`);
  return records;
}

export function ingestArchive(archive: Buffer, directory: string, retrievedAt = new Date().toISOString()): Manifest {
  if (archive.length !== RELEASE.bytes || sha256(archive) !== RELEASE.archiveSha256) throw new Error('Archive does not match the pinned public release');
  mkdirSync(directory, { recursive: true });
  const archivePath = join(directory, 'qcfy2024_csv.zip');
  writeFileSync(`${archivePath}.part`, archive);
  const csv = execFileSync('unzip', ['-p', `${archivePath}.part`, RELEASE.archiveMember], { maxBuffer: 110_000_000 });
  if (sha256(csv) !== RELEASE.csvSha256) throw new Error('CSV checksum mismatch');
  const records = projectCsv(csv.toString('utf8'), RELEASE);
  const states = new Map<string, z.infer<typeof StateCount>>();
  for (const record of records) {
    const state = states.get(record.state) ?? { code: record.state, name: record.stateName, count: 0 };
    if (state.name !== record.stateName) throw new Error('Inconsistent state name');
    state.count++; states.set(record.state, state);
  }
  const index = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  const manifest: Manifest = { ...RELEASE, indexSha256: sha256(index), retrievedAt, states: [...states.values()].sort((a, b) => a.name.localeCompare(b.name)) };
  // Promotion only follows checksum, schema, unique-ID and exact source-count validation.
  writeFileSync(join(directory, 'qc_pub_fy2024.csv.part'), csv);
  writeFileSync(join(directory, 'public-index.jsonl.part'), index);
  writeFileSync(join(directory, 'manifest.json.part'), JSON.stringify(manifest, null, 2) + '\n');
  renameSync(`${archivePath}.part`, archivePath);
  renameSync(join(directory, 'qc_pub_fy2024.csv.part'), join(directory, 'qc_pub_fy2024.csv'));
  renameSync(join(directory, 'public-index.jsonl.part'), join(directory, 'public-index.jsonl'));
  renameSync(join(directory, 'manifest.json.part'), join(directory, 'manifest.json'));
  return manifest;
}

export async function downloadArchive(): Promise<Buffer> {
  // The public host's edge rejects curl's default UA (403); browser-compatible UA succeeds without credentials/cookies.
  const response = await fetch(RELEASE.sourceUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StampyPublicQCImporter/1.0)', Accept: 'application/zip' },
    signal: AbortSignal.timeout(60_000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`QC download HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.includes('application/zip')) throw new Error('QC download is not a ZIP');
  if (Number(response.headers.get('content-length')) > 10_000_000) throw new Error('QC archive exceeds download limit');
  const chunks: Uint8Array[] = []; let length = 0;
  if (!response.body) throw new Error('Empty download');
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 10_000_000) { await reader.cancel(); throw new Error('QC archive exceeds download limit'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
