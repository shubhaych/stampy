/**
 * npm run db:build [-- --reset] — build data/db/stampy.db deterministically on this machine.
 * Applies every migration. Until the USDA QC file is ingested (npm run qc:ingest, qc-data feature),
 * loads data/golden into qc_history with source='golden' and logs UNVERIFIED-LIVE: qc-file.
 * Never pads or fabricates rows.
 */
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { migrate, openDb } from '../db/migrate';
import { ROOT, envValue } from './lib';

const dbPath = resolve(ROOT, envValue('DB_PATH', 'data/db/stampy.db'));
if (process.argv.includes('--reset')) {
  for (const suffix of ['', '-wal', '-shm']) if (existsSync(dbPath + suffix)) rmSync(dbPath + suffix);
  console.log(`db:build: reset ${dbPath}`);
}
const db = openDb(dbPath);
const ran = migrate(db);
console.log(`db:build: ${ran.length} migrations applied`);

interface GoldenRow { qc_history: Record<string, unknown>; case_file: { id: string } & Record<string, unknown> }
const goldenDir = join(ROOT, 'data/golden');
const golden: GoldenRow[] = readdirSync(goldenDir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(goldenDir, f), 'utf8')));

const fromFile = (db.prepare("SELECT COUNT(*) n FROM qc_history WHERE source = 'qc_file'").get() as { n: number }).n;
db.transaction(() => {
  for (const g of golden) {
    const cols = Object.keys(g.qc_history);
    db.prepare(`INSERT OR REPLACE INTO qc_history (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...cols.map((c) => g.qc_history[c] as never));
    db.prepare("INSERT OR IGNORE INTO case_state (case_id, qc_id, case_file_json, status) VALUES (?, ?, ?, 'new')").run(g.case_file.id, g.qc_history.qc_id as string, JSON.stringify(g.case_file));
  }
})();
const total = (db.prepare('SELECT COUNT(*) n FROM qc_history').get() as { n: number }).n;
console.log(`db:build: qc_history ${total} rows (${fromFile} from the QC file, ${golden.length} golden)`);
if (!fromFile) console.log('UNVERIFIED-LIVE: qc-file: drop the USDA QC public-use file in data/qc/raw/ and run npm run qc:ingest');
db.close();
