import type Database from 'better-sqlite3';
import type { AuditEntry } from '@stampy/contracts';
import type { Identity } from './authz';
import { publish } from '../events';

export interface AuditInput {
  caseId: string | null;
  who: Identity;
  kind: AuditEntry['kind'];
  action: string;
  entity: string;
  entityId: string;
  data?: Record<string, unknown> | null;
}

/** Every mutation appends one row. audit_log is append-only (DB triggers). */
export function appendAudit(db: Database.Database, input: AuditInput): AuditEntry {
  const row = db
    .prepare(
      `INSERT INTO audit_log (case_id, actor, actor_role, kind, action, entity, entity_id, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, at`,
    )
    .get(input.caseId, input.who.id, input.who.role, input.kind, input.action, input.entity, input.entityId, input.data ? JSON.stringify(input.data) : null) as { id: number; at: string };
  const entry: AuditEntry = {
    id: String(row.id), at: row.at, caseId: input.caseId, actor: input.who.id, actorRole: input.who.role,
    kind: input.kind, action: input.action, entity: input.entity, entityId: input.entityId, data: input.data ?? null,
  };
  publish({ type: 'audit', entry });
  return entry;
}

export function readAudit(db: Database.Database, caseId: string): AuditEntry[] {
  const rows = db.prepare('SELECT * FROM audit_log WHERE case_id = ? ORDER BY id').all(caseId) as Array<{
    id: number; at: string; case_id: string | null; actor: string; actor_role: AuditEntry['actorRole'];
    kind: AuditEntry['kind']; action: string; entity: string; entity_id: string; data_json: string | null;
  }>;
  return rows.map((r) => ({
    id: String(r.id), at: r.at, caseId: r.case_id, actor: r.actor, actorRole: r.actor_role, kind: r.kind,
    action: r.action, entity: r.entity, entityId: r.entity_id, data: r.data_json ? JSON.parse(r.data_json) : null,
  }));
}
