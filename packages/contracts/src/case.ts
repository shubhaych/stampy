import { z } from 'zod';
import { IsoDate, PayFrequency, Prov, StationId } from './common';

export const HouseholdMember = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().int().nullable(),
  relationship: z.string(),
  elderlyOrDisabled: z.boolean(),
});
export type HouseholdMember = z.infer<typeof HouseholdMember>;

/** The budget as recorded in the case file (state-certified values). */
export const CaseBudget = z.object({
  earnedIncomeMonthly: z.number(),
  unearnedIncomeMonthly: z.number(),
  payFrequency: PayFrequency.nullable(),
  grossPerPeriod: z.number().nullable(),
  rentMonthly: z.number(),
  suaApplied: z.boolean(),
  suaType: z.enum(['heating_cooling', 'limited', 'telephone', 'none']).nullable(),
  dependentCareMonthly: z.number(),
  medicalMonthly: z.number(),
  childSupportMonthly: z.number(),
  allotmentMonthly: z.number().nullable(),
});
export type CaseBudget = z.infer<typeof CaseBudget>;

export const DocKind = z.enum([
  'application', 'paystub', 'lease', 'utility_bill', 'interview_note',
  'match_alert', 'employer_statement', 'household_upload',
]);
export type DocKind = z.infer<typeof DocKind>;

export const DocRef = z.object({
  id: z.string(),
  caseId: z.string(),
  kind: DocKind,
  title: z.string(),
  pages: z.number().int().min(1),
  /** Signed worker URL in live mode; a static path or null in fixture mode. */
  mediaUrl: z.string().nullable(),
  receivedAt: IsoDate,
  prov: Prov,
});
export type DocRef = z.infer<typeof DocRef>;

/**
 * CaseFile = what is in the case file (state-certified values only).
 * It never contains QC-verified truth; that lives only in worker/src/core/truth.ts.
 */
export const CaseFile = z.object({
  id: z.string(),
  qcId: z.string(),
  state: z.string().length(2),
  fiscalYear: z.number().int(),
  householdSize: z.number().int().min(1),
  members: z.array(HouseholdMember),
  filedAt: IsoDate,
  receivedAt: IsoDate,
  expedited: z.object({ screened: z.boolean(), eligible: z.boolean().nullable() }),
  interviewRecorded: z.boolean(),
  budget: CaseBudget,
  employerAlias: z.string().nullable(),
  landlordAlias: z.string().nullable(),
  prov: Prov,
  /** Short label for the queue, e.g. "Pay frequency". Never reveals truth. */
  story: z.string().nullable(),
});
export type CaseFile = z.infer<typeof CaseFile>;

export const StepStatus = z.enum(['pending', 'in_progress', 'done', 'skipped', 'flagged']);
export type StepStatus = z.infer<typeof StepStatus>;

export const StepState = z.object({
  caseId: z.string(),
  station: StationId,
  status: StepStatus,
  updatedAt: IsoDate.nullable(),
});
export type StepState = z.infer<typeof StepState>;

export const QueueItem = z.object({
  caseId: z.string(),
  qcId: z.string(),
  state: z.string().length(2),
  householdSize: z.number().int(),
  filedAt: IsoDate,
  dayOfThirty: z.number().int(),
  expeditedDaysLeft: z.number().int().nullable(),
  docsReady: z.number().int(),
  openFlags: z.number().int(),
  status: z.enum(['new', 'in_progress', 'certified']),
  prov: Prov,
});
export type QueueItem = z.infer<typeof QueueItem>;

export const Shift = z.object({
  id: z.string(),
  state: z.string().length(2),
  seed: z.number().int(),
  caseIds: z.array(z.string()),
  createdAt: IsoDate,
  prov: Prov,
});
export type Shift = z.infer<typeof Shift>;

export const StateProfile = z.object({
  code: z.string().length(2),
  name: z.string(),
  /** Tile cartogram coordinates (11 x 8 grid). */
  col: z.number().int(),
  row: z.number().int(),
  /** FY2025 PER, null when not sourced (renders "n/a"). */
  perFy2025: z.number().nullable(),
  overFy2025: z.number().nullable(),
  underFy2025: z.number().nullable(),
  adminType: z.enum(['state', 'county']).nullable(),
  reportingSystem: z.string().nullable(),
  manual: z.string().nullable(),
  prov: Prov,
});
export type StateProfile = z.infer<typeof StateProfile>;
