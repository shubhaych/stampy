/** Postgres pool. The worker is the only process that talks to the database. */
import pg from 'pg';
import { migrate } from '../../db/migrate';
import { env } from './env';

// numeric → number, timestamptz/date → ISO string (pages render strings).
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).toISOString()));
pg.types.setTypeParser(1082, (v) => v);

export type Db = pg.Pool;
export type Tx = pg.PoolClient;
export type Q = Pick<pg.Pool, 'query'>;

let pool: pg.Pool | null = null;

export async function getDb(url = env.DATABASE_URL): Promise<pg.Pool> {
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: 10 });
    await migrate(pool);
  }
  return pool;
}

export async function tx<T>(db: pg.Pool, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

export async function one<T extends pg.QueryResultRow>(db: Q, sql: string, params: unknown[] = []): Promise<T | null> {
  const r = await db.query<T>(sql, params);
  return r.rows[0] ?? null;
}

export async function many<T extends pg.QueryResultRow>(db: Q, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
