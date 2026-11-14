/**
 * Stampy loop contracts: applicant upload → documents read → evidence ledger → open questions →
 * email request → applicant calls in → checklist email → reply with a document → recompute → caseworker decides.
 * The worker returns these shapes; the web renders them. Nothing here carries server secrets.
 */
import { z } from 'zod';

export const Prov = z.enum(['live', 'replay', 'synthetic', 'fixture', 'sandbox']);

export const CaseStatus = z.enum(['reading', 'questions_open', 'ready_for_review', 'approved', 'rejected', 'needs_person']);
export type CaseStatus = z.infer<typeof CaseStatus>;

export const DocKind = z.enum(['application_form', 'paystub', 'lease', 'other', 'unknown']);
export type DocKind = z.infer<typeof DocKind>;

/** Fields the document reader may extract. The conflict detector compares these across sources. */
export const FACT_FIELDS = [
  'applicant_name', 'application_date', 'state', 'household_size', 'household_members',
  'employer_name', 'gross_pay_amount', 'pay_frequency', 'pay_date', 'pay_period_start', 'pay_period_end',
  'monthly_rent', 'tenant_names', 'utilities_included',
] as const;
export const FactField = z.enum(FACT_FIELDS);
export type FactField = z.infer<typeof FactField>;

export const FIELD_LABEL: Record<string, string> = {
  applicant_name: 'Applicant name', application_date: 'Application date', state: 'State',
  household_size: 'Household size', household_members: 'Household members', employer_name: 'Employer',
  gross_pay_amount: 'Gross pay per check', pay_frequency: 'Pay frequency', pay_date: 'Pay date',
  pay_period_start: 'Pay period start', pay_period_end: 'Pay period end', monthly_rent: 'Monthly rent',
  tenant_names: 'Names on the lease', utilities_included: 'Utilities included in rent',
  recent_paystub: 'Recent paystub',
};

export const BBox = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
export type BBox = z.infer<typeof BBox>;

export const SourceKind = z.enum(['application_form', 'document', 'phone_call', 'email', 'caseworker', 'rules']);
export type SourceKind = z.infer<typeof SourceKind>;

export const Fact = z.object({
  id: z.string(),
  seq: z.number(),
  caseId: z.string(),
  field: z.string(),
  value: z.string(),
  normalized: z.string(),
  sourceKind: SourceKind,
  sourceRef: z.string().nullable(),
  sourceLabel: z.string(),
  page: z.number().nullable(),
  line: z.string().nullable(),
  bbox: BBox.nullable(),
  atSeconds: z.number().nullable(),
  confidence: z.number(),
  questionId: z.string().nullable(),
  prov: Prov,
  createdBy: z.string(),
  observedAt: z.string(),
});
export type Fact = z.infer<typeof Fact>;

export const Candidate = z.object({
  value: z.string(),
  label: z.string(),
  sources: z.array(z.string()),
  incomeMonthly: z.number().nullable(),
  benefitMonthly: z.number().nullable(),
});
export type Candidate = z.infer<typeof Candidate>;

export const Question = z.object({
  id: z.string(),
  caseId: z.string(),
  kind: z.enum(['conflict', 'missing_document']),
  field: z.string(),
  title: z.string(),
  ask: z.string(),
  why: z.string(),
  factIds: z.array(z.string()),
  candidates: z.array(Candidate),
  stakeMonthly: z.number().nullable(),
  direction: z.enum(['over', 'under', 'none']),
  channel: z.enum(['phone', 'document']),
  status: z.enum(['open', 'answered', 'closed']),
  resolvedValue: z.string().nullable(),
  resolutionFactId: z.string().nullable(),
  closedNote: z.string().nullable(),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
});
export type Question = z.infer<typeof Question>;

export const DocumentMeta = z.object({
  id: z.string(),
  caseId: z.string(),
  kind: DocKind,
  filename: z.string(),
  contentType: z.string(),
  synthetic: z.boolean(),
  source: z.enum(['upload', 'email']),
  readStatus: z.enum(['pending', 'reading', 'read', 'failed', 'needs_person']),
  readError: z.string().nullable(),
  summary: z.string().nullable(),
  receivedAt: z.string(),
});
export type DocumentMeta = z.infer<typeof DocumentMeta>;

export const Outreach = z.object({
  id: z.string(),
  caseId: z.string(),
  kind: z.enum(['request', 'checklist']),
  toAddr: z.string(),
  subject: z.string(),
  bodyText: z.string(),
  status: z.enum(['draft', 'sent', 'simulated', 'failed']),
  threadId: z.string().nullable(),
  error: z.string().nullable(),
  approvedBy: z.string().nullable(),
  createdAt: z.string(),
  sentAt: z.string().nullable(),
});
export type Outreach = z.infer<typeof Outreach>;

export const InboundEmail = z.object({
  id: z.string(),
  caseId: z.string().nullable(),
  fromAddr: z.string(),
  subject: z.string().nullable(),
  bodyText: z.string().nullable(),
  attachmentCount: z.number(),
  simulated: z.boolean(),
  receivedAt: z.string(),
});
export type InboundEmail = z.infer<typeof InboundEmail>;

export const CallTurn = z.object({ role: z.enum(['assistant', 'caller']), text: z.string(), atSeconds: z.number().nullable() });
export type CallTurn = z.infer<typeof CallTurn>;

export const Call = z.object({
  id: z.string(),
  caseId: z.string().nullable(),
  fromNumber: z.string().nullable(),
  verified: z.boolean(),
  simulated: z.boolean(),
  status: z.enum(['in_progress', 'ended']),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  endedReason: z.string().nullable(),
  turns: z.array(CallTurn),
  recordingUrl: z.string().nullable(),
  callbackRequested: z.string().nullable(),
});
export type Call = z.infer<typeof Call>;

export const BenefitResult = z.object({
  incomeMonthly: z.number(),
  payFrequency: z.string(),
  grossPerCheck: z.number(),
  benefitMonthly: z.number().nullable(),
  eligible: z.boolean().nullable(),
  netIncomeMonthly: z.number().nullable(),
  maxAllotment: z.number().nullable(),
  basis: z.string(),
});
export type BenefitResult = z.infer<typeof BenefitResult>;

export const Recompute = z.object({
  id: z.string(),
  caseId: z.string(),
  engine: z.string(),
  before: BenefitResult,
  after: BenefitResult,
  ms: z.number(),
  createdAt: z.string(),
});
export type Recompute = z.infer<typeof Recompute>;

export const Decision = z.object({
  id: z.string(),
  caseId: z.string(),
  action: z.enum(['approve', 'reject']),
  recomputeId: z.string().nullable(),
  decidedBy: z.string(),
  note: z.string().nullable(),
  at: z.string(),
});
export type Decision = z.infer<typeof Decision>;

export const AuditRow = z.object({
  id: z.number(),
  caseId: z.string().nullable(),
  at: z.string(),
  actor: z.string(),
  actorRole: z.enum(['ai', 'system', 'worker', 'supervisor', 'applicant']),
  kind: z.enum(['source', 'ai', 'rules', 'human', 'outreach']),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
});
export type AuditRow = z.infer<typeof AuditRow>;

export const CaseSummary = z.object({
  id: z.string(),
  refCode: z.string(),
  applicantName: z.string(),
  applicantEmail: z.string(),
  applicantPhone: z.string(),
  state: z.string(),
  status: CaseStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
  openQuestions: z.number(),
  documents: z.number(),
});
export type CaseSummary = z.infer<typeof CaseSummary>;

export const CaseBundleV2 = z.object({
  case: CaseSummary,
  documents: z.array(DocumentMeta),
  facts: z.array(Fact),
  questions: z.array(Question),
  outreach: z.array(Outreach),
  inbound: z.array(InboundEmail),
  calls: z.array(Call),
  recompute: Recompute.nullable(),
  decision: Decision.nullable(),
  audit: z.array(AuditRow),
  phoneNumber: z.string().nullable(),
  modes: z.object({ ai: z.string(), email: z.string(), voice: z.string(), rules: z.string() }),
});
export type CaseBundleV2 = z.infer<typeof CaseBundleV2>;

export const StampyRoutes = {
  cases: '/cases',
  case: (id: string) => `/cases/${encodeURIComponent(id)}`,
  doc: (id: string) => `/docs/${encodeURIComponent(id)}`,
  samples: '/samples',
  sample: (name: string) => `/samples/${encodeURIComponent(name)}`,
  sendRequest: (id: string) => `/cases/${encodeURIComponent(id)}/outreach/request/send`,
  simulateCall: (id: string) => `/cases/${encodeURIComponent(id)}/simulate/call`,
  simulateReply: (id: string) => `/cases/${encodeURIComponent(id)}/simulate/reply`,
  recompute: (id: string) => `/cases/${encodeURIComponent(id)}/recompute`,
  decide: (id: string) => `/cases/${encodeURIComponent(id)}/decision`,
  reread: (id: string) => `/cases/${encodeURIComponent(id)}/reread`,
  status: '/status',
  events: '/events',
  vapiWebhook: '/webhooks/vapi',
  agentmailWebhook: '/webhooks/agentmail',
} as const;

/** Server-sent event for live pages. Carries ids only; pages refetch the bundle. */
export const StampyEvent = z.object({ type: z.literal('case.updated'), caseId: z.string(), action: z.string(), at: z.string() });
export type StampyEvent = z.infer<typeof StampyEvent>;
