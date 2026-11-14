import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Manifest, PublicRecord, sha256 } from './ingest';
import { RELEASE } from './release';

export const QC_DIRECTORY = resolve(import.meta.dirname, '../../../data/qc/raw');
export interface Snapshot { release: Manifest; records: PublicRecord[] }
let cached: { key: string; snapshot: Snapshot } | null = null;

/** Read only the allowlisted projection; source CSV and QC outcomes never enter an API payload. */
export function loadSnapshot(directory = QC_DIRECTORY): Snapshot | null {
  const manifestPath = join(directory, 'manifest.json');
  const indexPath = join(directory, 'public-index.jsonl');
  let key: string;
  try { key = `${directory}:${statSync(manifestPath).mtimeMs}:${statSync(indexPath).mtimeMs}`; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  if (cached?.key === key) return cached.snapshot;
  const release = Manifest.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
  if (release.archiveSha256 !== RELEASE.archiveSha256 || release.csvSha256 !== RELEASE.csvSha256 ||
      release.sourceUrl !== RELEASE.sourceUrl || release.dictionaryUrl !== RELEASE.dictionaryUrl || release.catalogUrl !== RELEASE.catalogUrl ||
      release.fiscalYear !== RELEASE.fiscalYear || release.rowCount !== RELEASE.rowCount) throw new Error('Unrecognized QC release manifest');
  const index = readFileSync(indexPath, 'utf8');
  if (sha256(index) !== release.indexSha256) throw new Error('QC index checksum mismatch');
  const records = index.trimEnd().split('\n').map((line) => PublicRecord.parse(JSON.parse(line)));
  if (records.length !== release.rowCount || new Set(records.map((r) => r.id)).size !== records.length) throw new Error('QC index record count mismatch');
  cached = { key, snapshot: { release, records } };
  return cached.snapshot;
}
