import { z } from 'zod';
import { ActorRole, IsoDate, Mode, Prov } from './common';
import { CaseFile, DocRef, StepState } from './case';
import { Extraction, Flag, GateItem, Override } from './flags';
import { Consent, Fact, HouseholdUpload, OpenQuestion, Outreach, ResolutionPlan } from './ledger';
import { Call, CallFact, CallTurn } from './voice';
import { AgentRun } from './seats';

export const AuditEntry = z.object({
  id: z.string(),
  at: IsoDate,
  caseId: z.string().nullable(),
  actor: z.string(),
  actorRole: ActorRole,
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  /** Which kind of step this was, for the Decision Pipeline glyphs. */
  kind: z.enum(['source', 'rules', 'ai', 'human']),
  data: z.record(z.string(), z.unknown()).nullable(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const IntegrationStatus = z.object({
  name: z.string(),
  mode: z.union([Mode, z.literal('off'), z.literal('local')]),
  available: z.boolean(),
  lastRunAt: IsoDate.nullable(),
  lastMs: z.number().nullable(),
  runCount: z.number().int(),
  dailyLimit: z.number().int().nullable(),
  badge: Prov,
  note: z.string().nullable(),
});
export type IntegrationStatus = z.infer<typeof IntegrationStatus>;

export const Control = z.object({
  aiEnabled: z.boolean(),
  mossEnabled: z.boolean(),
  voiceEnabled: z.boolean(),
});
export type Control = z.infer<typeof Control>;

export const SystemStatus = z.object({
  integrations: z.array(IntegrationStatus),
  control: Control,
  unverifiedLive: z.array(z.string()),
  recomputeMatchRate: z.object({ rate: z.number().nullable(), sample: z.number().int(), prov: Prov }).nullable(),
});
export type SystemStatus = z.infer<typeof SystemStatus>;

/** Everything the case workspace needs. Never includes CaseTruth. */
export const CaseBundle = z.object({
  case: CaseFile,
  docs: z.array(DocRef),
  extractions: z.array(Extraction),
  flags: z.array(Flag),
  facts: z.array(Fact),
  questions: z.array(OpenQuestion),
  plans: z.array(ResolutionPlan),
  outreach: z.array(Outreach),
  uploads: z.array(HouseholdUpload),
  consents: z.array(Consent),
  calls: z.array(Call),
  callTurns: z.array(CallTurn),
  callFacts: z.array(CallFact),
  steps: z.array(StepState),
  gate: z.array(GateItem),
  overrides: z.array(Override),
  agentRuns: z.array(AgentRun),
  audit: z.array(AuditEntry),
});
export type CaseBundle = z.infer<typeof CaseBundle>;

/**
 * Post-certification debrief. Served only after the case is certified, by truth.ts.
 * Synthetic documents come from these same QC values, so matches demonstrate the pipeline, not detection rates.
 */
export const Debrief = z.object({
  caseId: z.string(),
  certified: z.object({ grossIncomeMonthly: z.number(), shelterMonthly: z.number(), allotmentMonthly: z.number().nullable() }),
  qcVerified: z.object({ grossIncomeMonthly: z.number(), shelterMonthly: z.number(), allotmentMonthly: z.number().nullable() }),
  qcFinding: z.object({ element: z.string().nullable(), direction: z.enum(['over', 'under', 'none']), amount: z.number().nullable(), responsibility: z.enum(['agency', 'client', 'none']).nullable() }),
  flagsMatched: z.array(z.string()),
  flagsMissed: z.array(z.string()),
  falseFlags: z.array(z.string()),
  overrides: z.array(z.string()),
  caveat: z.string(),
  prov: Prov,
});
export type Debrief = z.infer<typeof Debrief>;

/** SSE events from GET /events. Payloads are app rows only, never truth. */
export const ServerEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), at: IsoDate }),
  z.object({ type: z.literal('audit'), entry: AuditEntry }),
  z.object({ type: z.literal('fact'), fact: Fact }),
  z.object({ type: z.literal('question'), question: OpenQuestion }),
  z.object({ type: z.literal('flag'), flag: Flag }),
  z.object({ type: z.literal('plan'), plan: ResolutionPlan }),
  z.object({ type: z.literal('outreach'), outreach: Outreach }),
  z.object({ type: z.literal('call_turn'), turn: CallTurn }),
  z.object({ type: z.literal('call_fact'), fact: CallFact }),
  z.object({ type: z.literal('status'), status: IntegrationStatus }),
]);
export type ServerEvent = z.infer<typeof ServerEvent>;
