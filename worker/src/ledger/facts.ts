/** Evidence ledger: append-only facts. Nothing is overwritten; newer facts are added beside older ones. */
import type { BBox, Fact } from '@stampy/contracts/stampy';
import type { Q } from '../db';
import { id } from '../ids';
import { audit } from '../core/audit';
import type { Identity } from '../core/authz';
import { normalizeField } from './normalize';

export interface NewFact {
  caseId: string;
  field: string;
  value: string;
  sourceKind: Fact['sourceKind'];
  sourceRef: string | null;
  sourceLabel: string;
  page?: number | null;
  line?: string | null;
  bbox?: BBox | null;
  atSeconds?: number | null;
  confidence: number;
  questionId?: string | null;
  prov: Fact['prov'];
  createdBy: string;
}

export async function appendFact(db: Q, f: NewFact, who: Identity): Promise<Fact> {
  const fid = id('F');
  const normalized = normalizeField(f.field, f.value);
  const r = await db.query(
    `INSERT INTO fact (id, case_id, field, value, normalized, source_kind, source_ref, source_label, page, line, bbox, at_seconds, confidence, question_id, prov, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [fid, f.caseId, f.field, f.value, normalized, f.sourceKind, f.sourceRef, f.sourceLabel, f.page ?? null, f.line ?? null,
      f.bbox ? JSON.stringify(f.bbox) : null, f.atSeconds ?? null, Math.max(0, Math.min(1, f.confidence)), f.questionId ?? null, f.prov, f.createdBy],
  );
  await audit(db, { caseId: f.caseId, who, kind: 'source', action: 'fact.appended', entity: 'fact', entityId: fid, data: { field: f.field, sourceKind: f.sourceKind, questionId: f.questionId ?? null } });
  return rowToFact(r.rows[0]);
}

export async function listFacts(db: Q, caseId: string): Promise<Fact[]> {
  const r = await db.query(`SELECT * FROM fact WHERE case_id = $1 ORDER BY seq`, [caseId]);
  return r.rows.map(rowToFact);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToFact(x: any): Fact {
  return {
    id: x.id, seq: Number(x.seq), caseId: x.case_id, field: x.field, value: x.value, normalized: x.normalized,
    sourceKind: x.source_kind, sourceRef: x.source_ref, sourceLabel: x.source_label, page: x.page, line: x.line,
    bbox: x.bbox, atSeconds: x.at_seconds, confidence: Number(x.confidence), questionId: x.question_id,
    prov: x.prov, createdBy: x.created_by, observedAt: x.observed_at,
  };
}
