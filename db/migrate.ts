/**
 * FROZEN after scaffold-v1. Applies db/migrations/<feature>/NNN_name.sql in (feature, number) order.
 * Each feature owns its own folder, so two machines never edit the same migration file.
 * Usage: npm run db:migrate   (DB_PATH, default data/db/cleancase.db)
 */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(HERE, 'migrations');
export const DEFAULT_DB_PATH = 'data/db/cleancase.db';

export interface MigrationFile { feature: string; number: number; name: string; path: string }

export function listMigrations(dir = MIGRATIONS_DIR): MigrationFile[] {
  const out: MigrationFile[] = [];
  for (const feature of readdirSync(dir).sort()) {
    const fdir = join(dir, feature);
    if (!statSync(fdir).isDirectory()) continue;
    for (const file of readdirSync(fdir).sort()) {
      const m = /^(\d{3,4})_([a-z0-9_]+)\.sql$/.exec(file);
      if (!m) continue;
      out.push({ feature, number: Number(m[1]), name: m[2]!, path: join(fdir, file) });
    }
  }
  return out.sort((a, b) => (a.feature === b.feature ? a.number - b.number : a.feature < b.feature ? -1 : 1));
}

export function migrate(db: Database.Database, dir = MIGRATIONS_DIR): MigrationFile[] {
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    feature TEXT NOT NULL, number INTEGER NOT NULL, name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (feature, number))`);
  const applied = new Set(
    (db.prepare('SELECT feature, number FROM _migrations').all() as { feature: string; number: number }[]).map((r) => `${r.feature}/${r.number}`),
  );
  const ran: MigrationFile[] = [];
  for (const m of listMigrations(dir)) {
    if (applied.has(`${m.feature}/${m.number}`)) continue;
    const sql = readFileSync(m.path, 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (feature, number, name) VALUES (?, ?, ?)').run(m.feature, m.number, m.name);
    })();
    ran.push(m);
  }
  return ran;
}

export function openDb(path = process.env.DB_PATH ?? DEFAULT_DB_PATH): Database.Database {
  const abs = resolve(path);
  if (!existsSync(dirname(abs))) mkdirSync(dirname(abs), { recursive: true });
  const db = new Database(abs);
  db.pragma('journal_mode = WAL');
  return db;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = openDb();
  const ran = migrate(db);
  console.log(ran.length ? ran.map((m) => `applied ${m.feature}/${m.number}_${m.name}`).join('\n') : 'db:migrate: up to date');
  db.close();
}
