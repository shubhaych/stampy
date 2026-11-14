import { z } from 'zod';
import { BBox, Direction, IsoDate, Mode, NeedsHuman } from './common';
import { Channel, PlanOption } from './ledger';

/** Every named Claude role (master prompt section 12). The Desk Lead orchestrator is code, not a role. */
export const SeatName = z.enum([
  'document_reader', 'income_analyst', 'shelter_utility_checker',
  'household_composition_checker', 'policy_librarian', 'verification_analyst',
  'change_report_triage', 'qc_projection', 'resolution_planner',
  'question_writer', 'interview_copilot',
]);
export type SeatName = z.infer<typeof SeatName>;

export const DocumentReaderOutput = z.object({
  status: z.literal('ok'),
  fields: z.array(z.object({
    name: z.string(), value: z.string(), page: z.number().int().min(1),
    bbox: BBox, confidence: z.number().min(0).max(1), text: z.string(),
  })),
  unableToRead: z.array(z.string()),
});

export const IncomeAnalystOutput = z.object({
  status: z.literal('ok'),
  documents: z.array(z.object({
    docId: z.string(), payFrequency: z.string(), grossPerPeriod: z.number(),
    monthly: z.number(), arithmetic: z.string(),
  })),
  caseMonthly: z.number(), recomputedMonthly: z.number(),
  direction: Direction, deltaMonthly: z.number(), ruleId: z.string(),
});

export const ShelterUtilityOutput = z.object({
  status: z.literal('ok'),
  findings: z.array(z.object({
    item: z.string(), caseValue: z.string(), documentValue: z.string(),
    direction: Direction, deltaMonthly: z.number().nullable(), ruleId: z.string(),
  })),
  suaStatus: z.enum(['applied_supported', 'applied_unsupported', 'not_applied_supported', 'not_applied_unsupported']),
});

export const HouseholdCompositionOutput = z.object({
  status: z.literal('ok'),
  /** Questions only; this role never proposes a correction. */
  questions: z.array(z.object({ question: z.string(), basis: z.string() })),
});

export const PolicyLibrarianOutput = z.object({
  status: z.literal('ok'),
  explanation: z.string(),
  passages: z.array(z.object({ source: z.string(), section: z.string(), url: z.string().nullable() })).min(1),
});

export const VerificationAnalystOutput = z.object({
  status: z.literal('ok'),
  facts: z.array(z.object({
    field: z.string(), verdict: z.enum(['supports', 'contradicts', 'inconclusive']), turnIds: z.array(z.string()),
  })),
  questionPlan: z.array(z.string()).max(7),
});

export const ResolutionPlannerOutput = z.object({
  status: z.literal('ok'),
  options: z.array(PlanOption).min(1),
});

export const QuestionWriterOutput = z.object({ status: z.literal('ok'), question: z.string() });

export const InterviewCopilotOutput = z.object({
  status: z.literal('ok'),
  next: z.string(),
  followUps: z.array(z.string()),
});

export const SeatOutputs = {
  document_reader: DocumentReaderOutput,
  income_analyst: IncomeAnalystOutput,
  shelter_utility_checker: ShelterUtilityOutput,
  household_composition_checker: HouseholdCompositionOutput,
  policy_librarian: PolicyLibrarianOutput,
  verification_analyst: VerificationAnalystOutput,
  change_report_triage: z.object({ status: z.literal('ok'), order: z.array(z.string()), drafts: z.array(z.string()) }),
  qc_projection: z.object({ status: z.literal('ok'), narrative: z.string() }),
  resolution_planner: ResolutionPlannerOutput,
  question_writer: QuestionWriterOutput,
  interview_copilot: InterviewCopilotOutput,
} as const;

/** Every seat result is either its schema or a fail-closed needs_human. */
export function seatResultSchema<N extends SeatName>(name: N) {
  return z.union([SeatOutputs[name], NeedsHuman]);
}

export const AgentRun = z.object({
  id: z.string(),
  caseId: z.string().nullable(),
  seat: SeatName,
  mode: Mode,
  status: z.enum(['ok', 'needs_human', 'error', 'skipped_limit', 'skipped_kill_switch']),
  model: z.string().nullable(),
  tokensIn: z.number().int().nullable(),
  tokensOut: z.number().int().nullable(),
  ms: z.number(),
  at: IsoDate,
});
export type AgentRun = z.infer<typeof AgentRun>;

export const PlannerRequest = z.object({
  caseId: z.string(),
  questionId: z.string(),
  channelsAvailable: z.array(Channel),
  consents: z.array(z.string()),
});
export type PlannerRequest = z.infer<typeof PlannerRequest>;
