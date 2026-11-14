/** The worker is the only process that opens cleancase.db (single writer, WAL). */
import type Database from 'better-sqlite3';
import { migrate, openDb } from '../../db/migrate';
import { env } from './env';

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!instance) {
    instance = openDb(env.DB_PATH);
    migrate(instance);
  }
  return instance;
}

/** In-memory database with every migration applied, for tests. */
export async function memoryDb(): Promise<Database.Database> {
  const { default: Sqlite } = await import('better-sqlite3');
  const db = new Sqlite(':memory:');
  migrate(db);
  return db;
}
