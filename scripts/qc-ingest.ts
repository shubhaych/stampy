/** Import the pinned public-use CSV archive. Run after qc-download.ts. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { migrate, openDb } from '../db/migrate';
import { ROOT, envValue } from './lib';

const release = JSON.parse(readFileSync(join(ROOT, 'data/qc/fy2024-release.json'), 'utf8')) as {
  fiscalYear: number; revision: string; sha256: string; member: string; documentedRows: number;
};
const archive = join(ROOT, 'data/qc/raw', `qcfy${release.fiscalYear}_${release.revision}.zip`);
if (!existsSync(archive)) throw new Error(`Public archive not loaded. Run node --import tsx scripts/qc-download.ts or place the verified ZIP at ${archive}`);
const hash = createHash('sha256').update(readFileSync(archive)).digest('hex');
if (hash !== release.sha256) throw new Error('QC archive SHA-256 differs from the pinned release');

// Python's standard csv module handles quoted commas and embedded newlines. It never opens SQLite.
const parser = `import csv,json,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    names=archive.namelist()
    if names != [sys.argv[2]]: raise ValueError('unexpected ZIP members: '+str(names))
    with archive.open(names[0]) as source:
        import io
        reader=csv.DictReader(io.TextIOWrapper(source,encoding='utf-8-sig',newline=''))
        print(json.dumps({'_header':reader.fieldnames}),flush=True)
        for row in reader: print(json.dumps(row,separators=(',',':')),flush=True)
`;
const child = spawn('python3', ['-c', parser, archive, release.member], { stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', (part: string) => { stderr += part.slice(0, 3000); });
const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
const db = openDb(resolve(ROOT, envValue('DB_PATH', 'data/db/cleancase.db')));
migrate(db);
const insert = db.prepare(`INSERT OR REPLACE INTO qc_history (
  qc_id, source, fiscal_year, state, household_size, cert_earned_income, qc_earned_income,
  cert_unearned_income, qc_unearned_income, cert_shelter, qc_shelter,
  cert_net_income, qc_net_income, cert_allotment, qc_allotment,
  error_amount, error_direction, raw_json
) VALUES (?, 'qc_file', ?, ?, ?, NULL, ?, NULL, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?)`);
const numeric = (v: unknown): number | null => {
  if (typeof v !== 'string' || !v.trim() || v.trim().startsWith('.')) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const required = ['STATE', 'CERTHHSZ', 'YRMONTH', 'FSEARN', 'FSUNEARN', 'RENT', 'FSNETINC', 'RAWBEN', 'FSBEN', 'STATUS', 'AMTERR'];
let count = 0;
let headerSeen = false;
try {
  db.exec('BEGIN IMMEDIATE');
  for await (const line of lines) {
    const row = JSON.parse(line) as Record<string, string | string[]>;
    if (!headerSeen) {
      const header = row._header;
      if (!Array.isArray(header) || header.length !== 1177 || required.some((name) => !header.includes(name))) throw new Error('CSV header does not match the reviewed FY2024 release');
      headerSeen = true;
      continue;
    }
    count++;
    const state = numeric(row.STATE);
    const size = numeric(row.CERTHHSZ);
    const yearMonth = numeric(row.YRMONTH);
    if (state === null || size === null || size < 1 || yearMonth === null) throw new Error(`invalid required fields at public row ${count}`);
    const status = numeric(row.STATUS);
    const direction = status === 2 ? 'over' : status === 3 ? 'under' : 'none';
    // The public release omits the source review number. This internal ID is its stable row position in the pinned file.
    insert.run(`PUF-${release.fiscalYear}-${String(count).padStart(5, '0')}`, release.fiscalYear,
      state === 6 ? 'CA' : String(state).padStart(2, '0'), size,
      numeric(row.FSEARN), numeric(row.FSUNEARN), numeric(row.RENT), numeric(row.FSNETINC),
      numeric(row.RAWBEN), numeric(row.FSBEN), numeric(row.AMTERR), direction, JSON.stringify(row));
  }
  if (!headerSeen || count !== release.documentedRows) throw new Error(`row count ${count} differs from documented ${release.documentedRows}`);
  const exit = await new Promise<number | null>((done) => child.on('close', done));
  if (exit !== 0) throw new Error(`CSV parser failed: ${stderr.trim()}`);
  db.exec('COMMIT');
  console.log(`qc:ingest: imported ${count} FY${release.fiscalYear} public-use rows; California rows: ${(db.prepare("SELECT COUNT(*) n FROM qc_history WHERE source='qc_file' AND state='CA'").get() as { n: number }).n}`);
} catch (error) {
  child.kill();
  db.exec('ROLLBACK');
  throw error;
} finally { db.close(); }
