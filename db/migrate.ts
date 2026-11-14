/**
 * Applies db/migrations/NNNN_name.sql to Postgres in order, once each, inside a transaction.
 * Usage: npm run db:migrate   (DATABASE_URL, default postgres://stampy:stampy@localhost:5433/stampy)
 *        npm run db:reset     (drops every table first; local demo data only)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(HERE, 'migrations');
export const DEFAULT_DATABASE_URL = 'postgres://stampy:stampy@localhost:5433/stampy';

export interface MigrationFile { number: number; name: string; path: string }

export function listMigrations(dir = MIGRATIONS_DIR): MigrationFile[] {
  return readdirSync(dir)
    .map((file) => ({ file, m: /^(\d{4})_([a-z0-9_]+)\.sql$/.exec(file) }))
    .filter((x): x is { file: string; m: RegExpExecArray } => !!x.m)
    .map(({ file, m }) => ({ number: Number(m[1]), name: m[2]!, path: join(dir, file) }))
    .sort((a, b) => a.number - b.number);
}

type Queryable = Pick<pg.Pool, 'query'> | pg.PoolClient;

export async function migrate(db: pg.Pool, dir = MIGRATIONS_DIR): Promise<MigrationFile[]> {
  await db.query(`CREATE TABLE IF NOT EXISTS _migrations (number int PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  const applied = new Set((await db.query<{ number: number }>('SELECT number FROM _migrations')).rows.map((r) => r.number));
  const ran: MigrationFile[] = [];
  for (const m of listMigrations(dir)) {
    if (applied.has(m.number)) continue;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(readFileSync(m.path, 'utf8'));
      await client.query('INSERT INTO _migrations (number, name) VALUES ($1, $2)', [m.number, m.name]);
      await client.query('COMMIT');
      ran.push(m);
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`migration ${m.number}_${m.name} failed: ${(e as Error).message}`);
    } finally {
      client.release();
    }
  }
  return ran;
}

/** Drop everything in the public schema. Local demo databases only. */
export async function resetSchema(db: Queryable): Promise<void> {
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(HERE, '..');
  for (const f of ['.env.local', '.env']) {
    try { process.loadEnvFile(join(root, f)); } catch { /* optional */ }
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });
  try {
    if (process.argv.includes('--reset')) {
      await resetSchema(pool);
      console.log('db: schema reset');
    }
    const ran = await migrate(pool);
    console.log(ran.length ? ran.map((m) => `db: applied ${m.number}_${m.name}`).join('\n') : 'db: up to date');
  } finally {
    await pool.end();
  }
}
