import type Database from 'better-sqlite3';
import type { Control } from '@cleancase/contracts';
import { assertCan, type Identity } from './authz';
import { appendAudit } from './audit';

export function getControl(db: Database.Database): Control {
  const r = db.prepare('SELECT ai_enabled, moss_enabled, voice_enabled FROM control WHERE id = 1').get() as
    | { ai_enabled: number; moss_enabled: number; voice_enabled: number }
    | undefined;
  return { aiEnabled: !!r?.ai_enabled, mossEnabled: !!r?.moss_enabled, voiceEnabled: !!r?.voice_enabled };
}

/** Kill switches. Supervisor only. */
export function setControl(db: Database.Database, who: Identity, patch: Partial<Control>): Control {
  assertCan(who, 'control.set');
  const cur = { ...getControl(db), ...patch };
  db.prepare('UPDATE control SET ai_enabled = ?, moss_enabled = ?, voice_enabled = ? WHERE id = 1').run(+cur.aiEnabled, +cur.mossEnabled, +cur.voiceEnabled);
  appendAudit(db, { caseId: null, who, kind: 'human', action: 'control.set', entity: 'control', entityId: '1', data: patch });
  return cur;
}

export class LimitError extends Error {
  constructor(public key: string, public limit: number) {
    super(`daily limit reached for ${key} (${limit})`);
    this.name = 'LimitError';
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/** Daily counters (AI runs, calls, outreach), enforced server-side. Throws LimitError at the cap. */
export function consume(db: Database.Database, key: string, limit: number): number {
  return db.transaction(() => {
    const day = today();
    const cur = (db.prepare('SELECT count FROM limits WHERE key = ? AND day = ?').get(key, day) as { count: number } | undefined)?.count ?? 0;
    if (cur >= limit) throw new LimitError(key, limit);
    db.prepare('INSERT INTO limits (key, day, count) VALUES (?, ?, 1) ON CONFLICT (key, day) DO UPDATE SET count = count + 1').run(key, day);
    return cur + 1;
  })();
}

export function used(db: Database.Database, key: string): number {
  return (db.prepare('SELECT count FROM limits WHERE key = ? AND day = ?').get(key, today()) as { count: number } | undefined)?.count ?? 0;
}
