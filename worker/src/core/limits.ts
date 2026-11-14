/** Daily caps (AI runs, emails, calls), enforced in the service layer (hard rule 14). */
import type { Q } from '../db';

export class LimitError extends Error {
  constructor(public key: string, public limit: number) {
    super(`daily limit reached for ${key} (${limit})`);
    this.name = 'LimitError';
  }
}

export async function consume(db: Q, key: string, limit: number): Promise<number> {
  const r = await db.query<{ count: number }>(
    `INSERT INTO usage_limit (key, day, count) VALUES ($1, current_date, 1)
     ON CONFLICT (key, day) DO UPDATE SET count = usage_limit.count + 1
     WHERE usage_limit.count < $2
     RETURNING count`,
    [key, limit],
  );
  if (!r.rows[0]) throw new LimitError(key, limit);
  return r.rows[0].count;
}

export async function used(db: Q, key: string): Promise<number> {
  const r = await db.query<{ count: number }>(`SELECT count FROM usage_limit WHERE key = $1 AND day = current_date`, [key]);
  return r.rows[0]?.count ?? 0;
}
