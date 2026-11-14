/** npm run hello:db — open the per-machine database, apply migrations, print table and row counts. */
import { migrate, openDb } from '../db/migrate';
import { envValue } from './lib';

const db = openDb(envValue('DB_PATH', 'data/db/stampy.db'));
migrate(db);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
for (const t of tables) {
  const n = (db.prepare(`SELECT COUNT(*) n FROM "${t.name}"`).get() as { n: number }).n;
  console.log(`${t.name.padEnd(18)} ${n}`);
}
console.log(`db ok · ${tables.length} tables · journal=${db.pragma('journal_mode', { simple: true })}`);
db.close();
