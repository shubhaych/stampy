/** Every state change appends one audit row (append-only by trigger) and pings live pages. */
import type { AuditRow } from '@stampy/contracts/stampy';
import type { Q } from '../db';
import { publishCase } from '../events';
import type { Identity } from './authz';

export type AuditKind = AuditRow['kind'];

export interface AuditInput {
  caseId: string | null;
  who: Identity;
  kind: AuditKind;
  action: string;
  entity: string;
  entityId: string;
  data?: Record<string, unknown> | null;
}

export async function audit(db: Q, a: AuditInput): Promise<void> {
  await db.query(
    `INSERT INTO audit_log (case_id, actor, actor_role, kind, action, entity, entity_id, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [a.caseId, a.who.id, a.who.role, a.kind, a.action, a.entity, a.entityId, a.data ? JSON.stringify(a.data) : null],
  );
  if (a.caseId) publishCase(a.caseId, a.action);
}

export async function readAudit(db: Q, caseId: string): Promise<AuditRow[]> {
  const r = await db.query(`SELECT id, case_id, at, actor, actor_role, kind, action, entity, entity_id, data FROM audit_log WHERE case_id = $1 ORDER BY id`, [caseId]);
  return r.rows.map((x) => ({
    id: Number(x.id), caseId: x.case_id, at: x.at, actor: x.actor, actorRole: x.actor_role, kind: x.kind,
    action: x.action, entity: x.entity, entityId: x.entity_id, data: x.data,
  }));
}
