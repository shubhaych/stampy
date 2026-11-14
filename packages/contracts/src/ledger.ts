import { z } from 'zod';
import { BBox, Direction, IsoDate, Prov } from './common';

export const FactSourceKind = z.enum([
  'document', 'data_match', 'case_budget', 'household_reply',
  'employer_call', 'employer_email', 'interview',
]);
export type FactSourceKind = z.infer<typeof FactSourceKind>;

/** Evidence ledger row. Append-only: a newer fact supersedes by reference, nothing is overwritten. */
export const Fact = z.object({
  id: z.string(),
  caseId: z.string(),
  field: z.string(),
  value: z.string(),
  normalized: z.string(),
  sourceKind: FactSourceKind,
  sourceRef: z.string(),
  page: z.number().int().nullable(),
  bbox: BBox.nullable(),
  observedAt: IsoDate,
  confidence: z.number().min(0).max(1),
  prov: Prov,
  questionId: z.string().nullable(),
  supersedes: z.string().nullable(),
  /** Human acceptance; only accepted facts feed the recompute. */
  status: z.enum(['pending', 'accepted', 'rejected']),
  acceptedBy: z.string().nullable(),
});
export type Fact = z.infer<typeof Fact>;

export const OpenQuestion = z.object({
  id: z.string(),
  caseId: z.string(),
  field: z.string(),
  /** Plain-language wording (question_writer role). The detector itself is deterministic. */
  text: z.string(),
  factIds: z.array(z.string()),
  kind: z.enum(['conflict', 'missing_evidence']),
  stake: z.object({
    measure: z.enum(['gross_income', 'shelter_cost', 'net_income', 'allotment']),
    amountMonthly: z.number().nullable(),
    candidates: z.array(z.object({ value: z.string(), monthly: z.number().nullable() })),
  }),
  direction: Direction,
  status: z.enum(['open', 'answered', 'closed', 'waived']),
  closedNote: z.string().nullable(),
  openedAt: IsoDate,
  prov: Prov,
});
export type OpenQuestion = z.infer<typeof OpenQuestion>;

export const Channel = z.enum([
  'recheck_file', 'text_household', 'employer_email', 'employer_call',
  'landlord_call', 'interview',
]);
export type Channel = z.infer<typeof Channel>;

export const PlanOption = z.object({
  channel: Channel,
  why: z.string(),
  estCost: z.string(),
  estTime: z.string(),
  draft: z.string().nullable(),
  requiresConsent: z.boolean(),
});
export type PlanOption = z.infer<typeof PlanOption>;

/** Resolution planner output. It proposes; the worker approves each outreach. */
export const ResolutionPlan = z.object({
  id: z.string(),
  caseId: z.string(),
  questionId: z.string(),
  options: z.array(PlanOption).min(1),
  chosenIndex: z.number().int().nullable(),
  agentRunId: z.string().nullable(),
  createdAt: IsoDate,
  prov: Prov,
});
export type ResolutionPlan = z.infer<typeof ResolutionPlan>;

export const Outreach = z.object({
  id: z.string(),
  caseId: z.string(),
  questionId: z.string(),
  planId: z.string().nullable(),
  channel: Channel,
  status: z.enum(['draft', 'approved', 'sent', 'replied', 'cancelled']),
  toAlias: z.string(),
  body: z.string().nullable(),
  consentId: z.string().nullable(),
  approvedBy: z.string().nullable(),
  /** fixture mode records "sent-simulated". */
  simulated: z.boolean(),
  createdAt: IsoDate,
  prov: Prov,
});
export type Outreach = z.infer<typeof Outreach>;

export const HouseholdUpload = z.object({
  id: z.string(),
  caseId: z.string(),
  outreachId: z.string(),
  token: z.string(),
  status: z.enum(['waiting', 'received', 'expired']),
  docId: z.string().nullable(),
  expiresAt: IsoDate,
});
export type HouseholdUpload = z.infer<typeof HouseholdUpload>;

export const Consent = z.object({
  id: z.string(),
  caseId: z.string(),
  scope: z.enum(['employer', 'landlord', 'other_collateral']),
  recordedBy: z.string(),
  at: IsoDate,
});
export type Consent = z.infer<typeof Consent>;
