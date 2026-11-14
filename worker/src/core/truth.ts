/**
 * The ONLY reader of QC-verified values (qc_history.qc_* columns and the QC error coding).
 * Refuses before a case is certified (debrief). Never call this from a route that streams,
 * never pass its output to a Claude role, never include it in a CaseBundle.
 */
import type Database from 'better-sqlite3';

export interface CaseTruth {
  qcId: string;
  qcEarnedIncome: number | null;
  qcUnearnedIncome: number | null;
  qcShelter: number | null;
  qcNetIncome: number | null;
  qcAllotment: number | null;
  errorAmount: number | null;
  errorDirection: 'over' | 'under' | 'none' | null;
  errorElement: string | null;
  errorNature: string | null;
  errorResponsibility: 'agency' | 'client' | 'none' | null;
  discoveryMethod: string | null;
}

export class TruthLockedError extends Error {
  constructor(caseId: string) {
    super(`truth for ${caseId} is locked until the case is certified`);
    this.name = 'TruthLockedError';
  }
}

/** Keys that must never appear in a client response or SSE payload. */
export const TRUTH_KEYS = [
  'qcEarnedIncome', 'qcUnearnedIncome', 'qcShelter', 'qcNetIncome', 'qcAllotment',
  'qc_earned_income', 'qc_unearned_income', 'qc_shelter', 'qc_net_income', 'qc_allotment',
  'errorAmount', 'errorDirection', 'errorElement', 'errorNature', 'errorResponsibility',
  'error_amount', 'error_direction', 'error_element', 'error_nature', 'error_responsibility',
  'case_truth', 'caseTruth',
] as const;

export function containsTruth(value: unknown): boolean {
  const json = JSON.stringify(value ?? null);
  return TRUTH_KEYS.some((k) => json.includes(`"${k}"`));
}

export function readTruthForDebrief(db: Database.Database, caseId: string): CaseTruth {
  const cs = db.prepare('SELECT qc_id, status FROM case_state WHERE case_id = ?').get(caseId) as { qc_id: string; status: string } | undefined;
  if (!cs || cs.status !== 'certified') throw new TruthLockedError(caseId);
  const r = db.prepare('SELECT * FROM qc_history WHERE qc_id = ?').get(cs.qc_id) as Record<string, unknown> | undefined;
  if (!r) throw new Error(`qc_history row ${cs.qc_id} missing`);
  return {
    qcId: String(r.qc_id),
    qcEarnedIncome: r.qc_earned_income as number | null,
    qcUnearnedIncome: r.qc_unearned_income as number | null,
    qcShelter: r.qc_shelter as number | null,
    qcNetIncome: r.qc_net_income as number | null,
    qcAllotment: r.qc_allotment as number | null,
    errorAmount: r.error_amount as number | null,
    errorDirection: r.error_direction as CaseTruth['errorDirection'],
    errorElement: r.error_element as string | null,
    errorNature: r.error_nature as string | null,
    errorResponsibility: r.error_responsibility as CaseTruth['errorResponsibility'],
    discoveryMethod: r.discovery_method as string | null,
  };
}
