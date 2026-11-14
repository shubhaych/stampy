import { z } from 'zod';
import { BBox, Direction, IsoDate, Prov, StationId } from './common';

export const Extraction = z.object({
  id: z.string(),
  docId: z.string(),
  field: z.string(),
  value: z.string(),
  page: z.number().int().min(1),
  bbox: BBox,
  confidence: z.number().min(0).max(1),
  /** The exact text read from the document at the bbox. */
  text: z.string(),
  seatRunId: z.string(),
  prov: Prov,
});
export type Extraction = z.infer<typeof Extraction>;

export const Citation = z.object({
  id: z.string(),
  source: z.string(),
  section: z.string(),
  url: z.string().nullable(),
  /** Fetched policy text only (data/policy/). null renders "Policy text not loaded". */
  text: z.string().nullable(),
  retrievedAt: IsoDate.nullable(),
  backend: z.enum(['moss', 'local']),
  ms: z.number().nullable(),
  /** True only after the section number is checked against eCFR (data/policy/citations.json). */
  verified: z.boolean(),
});
export type Citation = z.infer<typeof Citation>;

export const Recompute = z.object({
  measure: z.enum(['gross_income', 'shelter_cost', 'net_income', 'allotment']),
  before: z.number(),
  after: z.number(),
  engine: z.enum(['snap-rules', 'policyengine']),
  arithmetic: z.string().nullable(),
});
export type Recompute = z.infer<typeof Recompute>;

export const FlagStatus = z.enum(['open', 'accepted', 'dismissed', 'questioned']);
export type FlagStatus = z.infer<typeof FlagStatus>;

export const Flag = z.object({
  id: z.string(),
  caseId: z.string(),
  station: StationId,
  ruleId: z.string(),
  title: z.string(),
  direction: Direction,
  severity: z.enum(['info', 'review', 'warn']),
  deltaMonthly: z.number().nullable(),
  extractionIds: z.array(z.string()),
  citations: z.array(Citation),
  recompute: Recompute.nullable(),
  /** A question to ask (household composition etc.); never an answer. */
  question: z.string().nullable(),
  status: FlagStatus,
  seat: z.string(),
  /** "AI and engine disagree" is surfaced, never silently resolved. */
  engineAgrees: z.boolean().nullable(),
  prov: Prov,
});
export type Flag = z.infer<typeof Flag>;

export const GateItem = z.object({
  id: z.string(),
  rule: z.string().regex(/^PG\d+$/),
  station: StationId,
  label: z.string(),
  severity: z.enum(['review', 'warn']),
  flagId: z.string().nullable(),
  resolved: z.boolean(),
  override: z.object({ reason: z.string().min(1), by: z.string() }).nullable(),
});
export type GateItem = z.infer<typeof GateItem>;

export const Override = z.object({
  id: z.string(),
  caseId: z.string(),
  gateItemId: z.string(),
  reason: z.string().min(1),
  by: z.string(),
  at: IsoDate,
});
export type Override = z.infer<typeof Override>;
