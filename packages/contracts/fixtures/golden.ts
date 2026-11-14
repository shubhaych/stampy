/**
 * Four hand-authored golden cases (master prompt section 11). Badge: Fixture.
 * Every figure here is hand-written test data. Policy text is null on purpose: real text
 * must come from data/policy/ (fetched), never from memory (hard rule 7).
 */
import type {
  AuditEntry, CaseBundle, CaseFile, Citation, DocRef, Extraction, Fact, Flag, GateItem,
  OpenQuestion, ResolutionPlan, StepState, StationId, Call, CallTurn, CallFact, Debrief, AgentRun,
} from '../src/index';
import { REPLAY_CAVEAT } from '../src/routes';

const P = 'fixture' as const;

function steps(caseId: string, done: number[] = [], skipped: number[] = [], flagged: number[] = []): StepState[] {
  return ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as StationId[]).map((station) => ({
    caseId,
    station,
    status: done.includes(station) ? 'done' : skipped.includes(station) ? 'skipped' : flagged.includes(station) ? 'flagged' : 'pending',
    updatedAt: done.includes(station) ? '2026-10-14T09:00:00Z' : null,
  }));
}

function cite(id: string, section: string): Citation {
  return { id, source: 'eCFR 7 CFR Part 273', section, url: null, text: null, retrievedAt: null, backend: 'local', ms: null, verified: false };
}

function doc(caseId: string, id: string, kind: DocRef['kind'], title: string, receivedAt: string): DocRef {
  return { id, caseId, kind, title, pages: 1, mediaUrl: null, receivedAt, prov: P };
}

function run(id: string, caseId: string, seat: AgentRun['seat'], ms: number): AgentRun {
  return { id, caseId, seat, mode: 'fixture', status: 'ok', model: null, tokensIn: null, tokensOut: null, ms, at: '2026-10-14T09:01:00Z' };
}

let auditSeq = 0;
function audit(caseId: string, at: string, actor: string, actorRole: AuditEntry['actorRole'], kind: AuditEntry['kind'], action: string, entity: string, entityId: string, data: AuditEntry['data'] = null): AuditEntry {
  auditSeq += 1;
  return { id: `AU-${caseId}-${String(auditSeq).padStart(3, '0')}`, at, caseId, actor, actorRole, kind, action, entity, entityId, data };
}

function empty(c: CaseFile): CaseBundle {
  return {
    case: c, docs: [], extractions: [], flags: [], facts: [], questions: [], plans: [], outreach: [],
    uploads: [], consents: [], calls: [], callTurns: [], callFacts: [], steps: steps(c.id), gate: [],
    overrides: [], agentRuns: [], audit: [],
  };
}

const baseBudget = {
  unearnedIncomeMonthly: 0, dependentCareMonthly: 0, medicalMonthly: 0, childSupportMonthly: 0, allotmentMonthly: null,
} as const;

/* ------------------------------------------------------------------ GC-1: pay frequency */

const GC1: CaseFile = {
  id: 'GC-1', qcId: 'GC-1', state: 'CA', fiscalYear: 2027, householdSize: 1,
  members: [{ id: 'M1', name: 'Lena T.', age: 34, relationship: 'head', elderlyOrDisabled: false }],
  filedAt: '2026-10-03', receivedAt: '2026-10-03',
  expedited: { screened: true, eligible: false }, interviewRecorded: false,
  budget: { ...baseBudget, earnedIncomeMonthly: 1240, payFrequency: 'monthly', grossPerPeriod: 1240, rentMonthly: 950, suaApplied: true, suaType: 'heating_cooling' },
  employerAlias: 'Employer A (synthetic)', landlordAlias: null, prov: P, story: 'Pay frequency',
};

const gc1Extractions: Extraction[] = [
  { id: 'EX-GC1-1', docId: 'D-GC1-PAY', field: 'gross_per_period', value: '1240.00', page: 1, bbox: { x: 0.58, y: 0.41, w: 0.3, h: 0.045 }, confidence: 0.97, text: 'Gross $1,240.00', seatRunId: 'RUN-GC1-1', prov: P },
  { id: 'EX-GC1-2', docId: 'D-GC1-PAY', field: 'pay_frequency', value: 'biweekly', page: 1, bbox: { x: 0.08, y: 0.24, w: 0.26, h: 0.04 }, confidence: 0.95, text: 'Pay frequency: Biweekly', seatRunId: 'RUN-GC1-1', prov: P },
  { id: 'EX-GC1-3', docId: 'D-GC1-PAY', field: 'pay_period', value: '2026-10-01/2026-10-14', page: 1, bbox: { x: 0.08, y: 0.19, w: 0.44, h: 0.04 }, confidence: 0.96, text: 'Pay period 10/01/2026 to 10/14/2026', seatRunId: 'RUN-GC1-1', prov: P },
  { id: 'EX-GC1-4', docId: 'D-GC1-EMP', field: 'pay_frequency', value: 'weekly', page: 1, bbox: { x: 0.1, y: 0.52, w: 0.4, h: 0.045 }, confidence: 0.88, text: 'Employee is paid: weekly', seatRunId: 'RUN-GC1-2', prov: P },
];

const gc1Flag: Flag = {
  id: 'F-GC1-1', caseId: 'GC-1', station: 5, ruleId: 'INC-FREQ-01', title: 'Biweekly pay budgeted as monthly',
  direction: 'over', severity: 'review', deltaMonthly: 1426, extractionIds: ['EX-GC1-1', 'EX-GC1-2', 'EX-GC1-3'],
  citations: [cite('C-GC1-1', '7 CFR 273.10(c)')],
  recompute: { measure: 'gross_income', before: 1240, after: 2666, engine: 'snap-rules', arithmetic: '$1,240.00 × 2.15 = $2,666.00' },
  question: null, status: 'open', seat: 'income_analyst', engineAgrees: true, prov: P,
};

const gc1Facts: Fact[] = [
  { id: 'FA-GC1-1', caseId: 'GC-1', field: 'pay_frequency', value: 'Biweekly', normalized: 'biweekly', sourceKind: 'document', sourceRef: 'D-GC1-PAY', page: 1, bbox: gc1Extractions[1]!.bbox, observedAt: '2026-10-14T09:01:00Z', confidence: 0.95, prov: P, questionId: null, supersedes: null, status: 'pending', acceptedBy: null },
  { id: 'FA-GC1-2', caseId: 'GC-1', field: 'pay_frequency', value: 'monthly', normalized: 'monthly', sourceKind: 'case_budget', sourceRef: 'GC-1.budget.payFrequency', page: null, bbox: null, observedAt: '2026-10-03T00:00:00Z', confidence: 1, prov: P, questionId: null, supersedes: null, status: 'accepted', acceptedBy: 'case-file' },
  { id: 'FA-GC1-3', caseId: 'GC-1', field: 'pay_frequency', value: 'weekly', normalized: 'weekly', sourceKind: 'document', sourceRef: 'D-GC1-EMP', page: 1, bbox: gc1Extractions[3]!.bbox, observedAt: '2026-10-14T09:01:00Z', confidence: 0.88, prov: P, questionId: null, supersedes: null, status: 'pending', acceptedBy: null },
  { id: 'FA-GC1-4', caseId: 'GC-1', field: 'gross_per_period', value: '$1,240.00', normalized: '1240.00', sourceKind: 'document', sourceRef: 'D-GC1-PAY', page: 1, bbox: gc1Extractions[0]!.bbox, observedAt: '2026-10-14T09:01:00Z', confidence: 0.97, prov: P, questionId: null, supersedes: null, status: 'pending', acceptedBy: null },
];

const gc1Question: OpenQuestion = {
  id: 'Q-GC1-1', caseId: 'GC-1', field: 'pay_frequency', text: 'How often is Lena paid?',
  factIds: ['FA-GC1-1', 'FA-GC1-2', 'FA-GC1-3'], kind: 'conflict',
  stake: { measure: 'gross_income', amountMonthly: 1426, candidates: [
    { value: 'monthly', monthly: 1240 }, { value: 'biweekly', monthly: 2666 }, { value: 'weekly', monthly: 5332 },
  ] },
  direction: 'over', status: 'open', closedNote: null, openedAt: '2026-10-14T09:02:00Z', prov: P,
};

const gc1Plan: ResolutionPlan = {
  id: 'PL-GC1-1', caseId: 'GC-1', questionId: 'Q-GC1-1', chosenIndex: null, agentRunId: 'RUN-GC1-3', createdAt: '2026-10-14T09:02:30Z', prov: P,
  options: [
    { channel: 'employer_call', why: 'Paystub and employer statement disagree with each other and with the case file; only the employer can settle the pay schedule.', estCost: '1 call, about 2 min', estTime: 'minutes', draft: null, requiresConsent: true },
    { channel: 'employer_email', why: 'Same question in writing if a call is not possible.', estCost: '1 email', estTime: '1 to 3 days', draft: 'Could you confirm how often this employee is paid (weekly, every two weeks, twice a month, or monthly)?', requiresConsent: true },
    { channel: 'interview', why: 'Ask the household at the interview as a fallback.', estCost: '1 question', estTime: 'at interview', draft: 'How often do you get paid at your job?', requiresConsent: false },
  ],
};

const gc1Call: Call = {
  id: 'CALL-GC1-1', caseId: 'GC-1', questionId: 'Q-GC1-1', counterpart: 'employer', contactAlias: 'Employer A (synthetic)',
  mode: 'fixture', status: 'briefing', outcome: null, consentBy: null, startedAt: null, durationS: null,
  brief: {
    who: 'Payroll contact at Employer A (synthetic)',
    why: 'Paystub, employer statement and case file disagree on pay frequency',
    questions: ['Is this person currently employed with you?', 'How often are they paid?', 'What is the gross pay per pay period?', 'When was the last pay date?'],
    doNotDisclose: ['Benefit amount or program status', 'Household members or address', 'Any other income'],
  },
  prov: P,
};

const gc1Turns: CallTurn[] = [
  { id: 'T1', callId: 'CALL-GC1-1', speaker: 'agent', text: "Hello, this is an AI assistant calling on behalf of the county benefits office, a public benefits office. I'm calling to verify employment for an application. Is now a good time? You can ask for a person to call you back at any time.", tStart: 0, tEnd: 11.5 },
  { id: 'T2', callId: 'CALL-GC1-1', speaker: 'counterpart', text: 'Sure, this is payroll. Go ahead.', tStart: 12, tEnd: 14 },
  { id: 'T3', callId: 'CALL-GC1-1', speaker: 'agent', text: 'Thank you. Is Lena T. currently employed with you?', tStart: 14.5, tEnd: 17.5 },
  { id: 'T4', callId: 'CALL-GC1-1', speaker: 'counterpart', text: 'Yes, since March.', tStart: 18, tEnd: 19.5 },
  { id: 'T5', callId: 'CALL-GC1-1', speaker: 'agent', text: 'How often is she paid?', tStart: 20, tEnd: 21.5 },
  { id: 'T6', callId: 'CALL-GC1-1', speaker: 'counterpart', text: "Every other Friday. Biweekly. The weekly box on that old form was a mistake on our end.", tStart: 22, tEnd: 27 },
  { id: 'T7', callId: 'CALL-GC1-1', speaker: 'agent', text: 'Thank you. What is the gross pay per pay period, before deductions?', tStart: 28, tEnd: 32 },
  { id: 'T8', callId: 'CALL-GC1-1', speaker: 'counterpart', text: 'Twelve forty, so one thousand two hundred forty dollars, most periods.', tStart: 33, tEnd: 38 },
  { id: 'T9', callId: 'CALL-GC1-1', speaker: 'agent', text: "That's everything I needed. Thank you for your time. Goodbye.", tStart: 39, tEnd: 42 },
];

const gc1CallFacts: CallFact[] = [
  { id: 'CF-GC1-1', callId: 'CALL-GC1-1', field: 'pay_frequency', value: 'biweekly', quote: 'Every other Friday. Biweekly.', turnIds: ['T6'], tStart: 22, tEnd: 24.5, confidence: 0.94, status: 'pending' },
  { id: 'CF-GC1-2', callId: 'CALL-GC1-1', field: 'gross_per_period', value: '1240.00', quote: 'one thousand two hundred forty dollars, most periods', turnIds: ['T8'], tStart: 33, tEnd: 38, confidence: 0.9, status: 'pending' },
];

const gc1Gate: GateItem[] = [
  { id: 'G-GC1-PG3', rule: 'PG3', station: 3, label: 'Interview not recorded', severity: 'review', flagId: null, resolved: false, override: null },
  { id: 'G-GC1-PG5', rule: 'PG5', station: 5, label: 'Budgeted income differs from recompute by more than tolerance', severity: 'review', flagId: 'F-GC1-1', resolved: false, override: null },
  { id: 'G-GC1-PG8', rule: 'PG8', station: 8, label: 'Open question: pay frequency', severity: 'warn', flagId: null, resolved: false, override: null },
];

export const GC1_BUNDLE: CaseBundle = (() => {
  auditSeq = 0;
  const b = empty(GC1);
  b.docs = [
    doc('GC-1', 'D-GC1-APP', 'application', 'Application', '2026-10-03'),
    doc('GC-1', 'D-GC1-PAY', 'paystub', 'Paystub 10/01 to 10/14', '2026-10-14'),
    doc('GC-1', 'D-GC1-EMP', 'employer_statement', 'Employer statement', '2026-10-09'),
  ];
  b.extractions = gc1Extractions;
  b.flags = [gc1Flag];
  b.facts = gc1Facts;
  b.questions = [gc1Question];
  b.plans = [gc1Plan];
  b.calls = [gc1Call];
  b.callTurns = gc1Turns;
  b.callFacts = gc1CallFacts;
  b.steps = steps('GC-1', [1, 2]);
  b.gate = gc1Gate;
  b.agentRuns = [run('RUN-GC1-1', 'GC-1', 'document_reader', 2140), run('RUN-GC1-2', 'GC-1', 'document_reader', 1880), run('RUN-GC1-3', 'GC-1', 'resolution_planner', 3020), run('RUN-GC1-4', 'GC-1', 'income_analyst', 2410)];
  b.audit = [
    audit('GC-1', '2026-10-14T09:00:00Z', 'system', 'system', 'source', 'doc.received', 'doc', 'D-GC1-PAY'),
    audit('GC-1', '2026-10-14T09:00:05Z', 'system', 'system', 'source', 'doc.received', 'doc', 'D-GC1-EMP'),
    audit('GC-1', '2026-10-14T09:01:00Z', 'ai', 'ai', 'ai', 'seat.run', 'agent_run', 'RUN-GC1-1', { seat: 'document_reader' }),
    audit('GC-1', '2026-10-14T09:01:00Z', 'ai', 'ai', 'source', 'fact.append', 'fact', 'FA-GC1-1'),
    audit('GC-1', '2026-10-14T09:01:00Z', 'system', 'system', 'source', 'fact.append', 'fact', 'FA-GC1-2'),
    audit('GC-1', '2026-10-14T09:01:00Z', 'ai', 'ai', 'source', 'fact.append', 'fact', 'FA-GC1-3'),
    audit('GC-1', '2026-10-14T09:01:30Z', 'ai', 'ai', 'ai', 'flag.raise', 'flag', 'F-GC1-1', { seat: 'income_analyst' }),
    audit('GC-1', '2026-10-14T09:02:00Z', 'system', 'system', 'rules', 'question.open', 'open_question', 'Q-GC1-1', { detector: 'conflict' }),
    audit('GC-1', '2026-10-14T09:02:30Z', 'ai', 'ai', 'ai', 'plan.propose', 'resolution_plan', 'PL-GC1-1'),
  ];
  return b;
})();

/** GC-1 after the full loop: approve → call → fact on the question → accept → recompute → approve → certify. */
export const GC1_WORKED_BUNDLE: CaseBundle = (() => {
  const b: CaseBundle = structuredClone(GC1_BUNDLE);
  const id = 'GC-1';
  b.plans = [{ ...gc1Plan, chosenIndex: 0 }];
  b.consents = [{ id: 'CON-GC1-1', caseId: id, scope: 'employer', recordedBy: 'worker:demo', at: '2026-10-14T09:05:00Z' }];
  b.outreach = [{ id: 'OUT-GC1-1', caseId: id, questionId: 'Q-GC1-1', planId: 'PL-GC1-1', channel: 'employer_call', status: 'replied', toAlias: 'Employer A (synthetic)', body: null, consentId: 'CON-GC1-1', approvedBy: 'worker:demo', simulated: true, createdAt: '2026-10-14T09:05:10Z', prov: P }];
  b.calls = [{ ...gc1Call, status: 'ended', outcome: 'verified', consentBy: 'worker:demo', startedAt: '2026-10-14T09:05:20Z', durationS: 42 }];
  b.callFacts = gc1CallFacts.map((f) => ({ ...f, status: 'accepted' as const }));
  b.facts = [
    ...gc1Facts,
    { id: 'FA-GC1-5', caseId: id, field: 'pay_frequency', value: 'biweekly', normalized: 'biweekly', sourceKind: 'employer_call', sourceRef: 'CALL-GC1-1#T6', page: null, bbox: null, observedAt: '2026-10-14T09:05:44Z', confidence: 0.94, prov: P, questionId: 'Q-GC1-1', supersedes: null, status: 'accepted', acceptedBy: 'worker:demo' },
  ];
  b.questions = [{ ...gc1Question, status: 'closed', closedNote: 'closed: biweekly, so $2,666 a month' }];
  b.flags = [{ ...gc1Flag, status: 'accepted' }];
  b.steps = steps(id, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  b.gate = gc1Gate.map((g) => ({ ...g, resolved: true }));
  const more = [
    audit(id, '2026-10-14T09:05:00Z', 'worker:demo', 'worker', 'human', 'consent.record', 'consent', 'CON-GC1-1'),
    audit(id, '2026-10-14T09:05:10Z', 'worker:demo', 'worker', 'human', 'outreach.approve', 'outreach', 'OUT-GC1-1', { channel: 'employer_call' }),
    audit(id, '2026-10-14T09:05:20Z', 'ai', 'ai', 'ai', 'call.start', 'call', 'CALL-GC1-1'),
    audit(id, '2026-10-14T09:05:44Z', 'ai', 'ai', 'source', 'fact.append', 'fact', 'FA-GC1-5', { questionId: 'Q-GC1-1' }),
    audit(id, '2026-10-14T09:06:30Z', 'worker:demo', 'worker', 'human', 'fact.accept', 'fact', 'FA-GC1-5'),
    audit(id, '2026-10-14T09:06:31Z', 'system', 'system', 'rules', 'question.close', 'open_question', 'Q-GC1-1', { note: 'closed: biweekly, so $2,666 a month' }),
    audit(id, '2026-10-14T09:06:32Z', 'system', 'system', 'rules', 'recompute', 'case_state', id, { measure: 'gross_income', before: 1240, after: 2666 }),
    audit(id, '2026-10-14T09:07:00Z', 'worker:demo', 'worker', 'human', 'change.approve', 'case_state', id),
    audit(id, '2026-10-14T09:09:00Z', 'worker:demo', 'worker', 'human', 'case.certify', 'decision', 'DEC-GC1-1'),
  ];
  b.audit = [...b.audit, ...more];
  return b;
})();

/* ------------------------------------------------------------------ GC-2: lease rent and occupants */

const GC2: CaseFile = {
  id: 'GC-2', qcId: 'GC-2', state: 'TX', fiscalYear: 2027, householdSize: 1,
  members: [{ id: 'M1', name: 'Maria R.', age: 41, relationship: 'head', elderlyOrDisabled: false }],
  filedAt: '2026-10-06', receivedAt: '2026-10-06',
  expedited: { screened: true, eligible: false }, interviewRecorded: true,
  budget: { ...baseBudget, earnedIncomeMonthly: 1890, payFrequency: 'semimonthly', grossPerPeriod: 945, rentMonthly: 1050, suaApplied: true, suaType: 'heating_cooling' },
  employerAlias: null, landlordAlias: 'Landlord B (synthetic)', prov: P, story: 'Lease rent and occupants',
};

export const GC2_BUNDLE: CaseBundle = (() => {
  auditSeq = 0;
  const id = 'GC-2';
  const b = empty(GC2);
  b.docs = [doc(id, 'D-GC2-APP', 'application', 'Application', '2026-10-06'), doc(id, 'D-GC2-LEASE', 'lease', 'Lease', '2026-10-08')];
  b.extractions = [
    { id: 'EX-GC2-1', docId: 'D-GC2-LEASE', field: 'rent_monthly', value: '1350.00', page: 1, bbox: { x: 0.12, y: 0.36, w: 0.36, h: 0.045 }, confidence: 0.96, text: 'Monthly rent: $1,350.00', seatRunId: 'RUN-GC2-1', prov: P },
    { id: 'EX-GC2-2', docId: 'D-GC2-LEASE', field: 'occupants', value: 'Maria R.; Daniel R.', page: 1, bbox: { x: 0.12, y: 0.5, w: 0.5, h: 0.06 }, confidence: 0.93, text: 'Occupants: Maria R., Daniel R.', seatRunId: 'RUN-GC2-1', prov: P },
  ];
  b.flags = [
    { id: 'F-GC2-1', caseId: id, station: 6, ruleId: 'SHL-RENT-01', title: 'Lease rent higher than budgeted shelter cost', direction: 'under', severity: 'review', deltaMonthly: 300, extractionIds: ['EX-GC2-1'], citations: [cite('C-GC2-1', '7 CFR 273.9(d)')], recompute: { measure: 'shelter_cost', before: 1050, after: 1350, engine: 'snap-rules', arithmetic: '$1,350.00 lease rent vs $1,050.00 budgeted' }, question: null, status: 'open', seat: 'shelter_utility_checker', engineAgrees: true, prov: P },
    { id: 'F-GC2-2', caseId: id, station: 7, ruleId: 'HH-COMP-01', title: 'Lease lists an occupant not in the household', direction: 'none', severity: 'review', deltaMonthly: null, extractionIds: ['EX-GC2-2'], citations: [cite('C-GC2-2', '7 CFR 273.1')], recompute: null, question: 'The lease lists Daniel R. as an occupant. Who is Daniel R., and does he buy and prepare meals with you?', status: 'open', seat: 'household_composition_checker', engineAgrees: null, prov: P },
  ];
  b.facts = [
    { id: 'FA-GC2-1', caseId: id, field: 'rent_monthly', value: '$1,350.00', normalized: '1350.00', sourceKind: 'document', sourceRef: 'D-GC2-LEASE', page: 1, bbox: b.extractions[0]!.bbox, observedAt: '2026-10-14T10:00:00Z', confidence: 0.96, prov: P, questionId: null, supersedes: null, status: 'pending', acceptedBy: null },
    { id: 'FA-GC2-2', caseId: id, field: 'rent_monthly', value: '$1,050.00', normalized: '1050.00', sourceKind: 'case_budget', sourceRef: 'GC-2.budget.rentMonthly', page: null, bbox: null, observedAt: '2026-10-06T00:00:00Z', confidence: 1, prov: P, questionId: null, supersedes: null, status: 'accepted', acceptedBy: 'case-file' },
    { id: 'FA-GC2-3', caseId: id, field: 'occupants', value: 'Maria R., Daniel R.', normalized: 'maria r.|daniel r.', sourceKind: 'document', sourceRef: 'D-GC2-LEASE', page: 1, bbox: b.extractions[1]!.bbox, observedAt: '2026-10-14T10:00:00Z', confidence: 0.93, prov: P, questionId: null, supersedes: null, status: 'pending', acceptedBy: null },
    { id: 'FA-GC2-4', caseId: id, field: 'occupants', value: 'Maria R.', normalized: 'maria r.', sourceKind: 'case_budget', sourceRef: 'GC-2.members', page: null, bbox: null, observedAt: '2026-10-06T00:00:00Z', confidence: 1, prov: P, questionId: null, supersedes: null, status: 'accepted', acceptedBy: 'case-file' },
  ];
  b.questions = [
    { id: 'Q-GC2-1', caseId: id, field: 'rent_monthly', text: 'What is the monthly rent?', factIds: ['FA-GC2-1', 'FA-GC2-2'], kind: 'conflict', stake: { measure: 'shelter_cost', amountMonthly: 300, candidates: [{ value: '1050.00', monthly: 1050 }, { value: '1350.00', monthly: 1350 }] }, direction: 'under', status: 'open', closedNote: null, openedAt: '2026-10-14T10:01:00Z', prov: P },
    { id: 'Q-GC2-2', caseId: id, field: 'occupants', text: 'Who is Daniel R.?', factIds: ['FA-GC2-3', 'FA-GC2-4'], kind: 'conflict', stake: { measure: 'allotment', amountMonthly: null, candidates: [] }, direction: 'none', status: 'open', closedNote: null, openedAt: '2026-10-14T10:01:00Z', prov: P },
  ];
  b.plans = [
    { id: 'PL-GC2-1', caseId: id, questionId: 'Q-GC2-1', chosenIndex: null, agentRunId: 'RUN-GC2-3', createdAt: '2026-10-14T10:02:00Z', prov: P, options: [
      { channel: 'landlord_call', why: 'The landlord can confirm the current rent and lease dates.', estCost: '1 call, about 2 min', estTime: 'minutes', draft: null, requiresConsent: true },
      { channel: 'text_household', why: 'Ask the household for a current rent receipt.', estCost: '1 text', estTime: 'hours', draft: 'Hi, this is your benefits office. Please photograph your latest rent receipt here: {upload_link}', requiresConsent: false },
    ] },
    { id: 'PL-GC2-2', caseId: id, questionId: 'Q-GC2-2', chosenIndex: null, agentRunId: 'RUN-GC2-3', createdAt: '2026-10-14T10:02:00Z', prov: P, options: [
      { channel: 'interview', why: 'Household composition is a question for the household, asked by the worker.', estCost: '1 question', estTime: 'at interview', draft: 'The lease lists Daniel R. Who is he, and does he buy and prepare meals with you?', requiresConsent: false },
    ] },
  ];
  b.calls = [{ id: 'CALL-GC2-1', caseId: id, questionId: 'Q-GC2-1', counterpart: 'landlord', contactAlias: 'Landlord B (synthetic)', mode: 'fixture', status: 'briefing', outcome: null, consentBy: null, startedAt: null, durationS: null, brief: { who: 'Property manager, Landlord B (synthetic)', why: 'Lease rent differs from the budgeted shelter cost', questions: ['What is the current monthly rent?', 'What are the lease dates?', 'Which utilities does the tenant pay?'], doNotDisclose: ['Benefit amount or program status', 'Other household details'] }, prov: P }];
  b.steps = steps(id, [1, 2, 3]);
  b.gate = [
    { id: 'G-GC2-PG6', rule: 'PG6', station: 6, label: 'Shelter cost on lease differs from budget', severity: 'review', flagId: 'F-GC2-1', resolved: false, override: null },
    { id: 'G-GC2-PG7', rule: 'PG7', station: 7, label: 'Unresolved household composition question', severity: 'review', flagId: 'F-GC2-2', resolved: false, override: null },
  ];
  b.agentRuns = [run('RUN-GC2-1', id, 'document_reader', 1960), run('RUN-GC2-2', id, 'shelter_utility_checker', 2210), run('RUN-GC2-3', id, 'resolution_planner', 2880)];
  b.audit = [
    audit(id, '2026-10-14T10:00:00Z', 'system', 'system', 'source', 'doc.received', 'doc', 'D-GC2-LEASE'),
    audit(id, '2026-10-14T10:00:10Z', 'ai', 'ai', 'ai', 'seat.run', 'agent_run', 'RUN-GC2-1', { seat: 'document_reader' }),
    audit(id, '2026-10-14T10:00:20Z', 'ai', 'ai', 'source', 'fact.append', 'fact', 'FA-GC2-1'),
    audit(id, '2026-10-14T10:00:20Z', 'ai', 'ai', 'source', 'fact.append', 'fact', 'FA-GC2-3'),
    audit(id, '2026-10-14T10:01:00Z', 'system', 'system', 'rules', 'question.open', 'open_question', 'Q-GC2-1'),
    audit(id, '2026-10-14T10:01:00Z', 'system', 'system', 'rules', 'question.open', 'open_question', 'Q-GC2-2'),
    audit(id, '2026-10-14T10:02:00Z', 'ai', 'ai', 'ai', 'plan.propose', 'resolution_plan', 'PL-GC2-1'),
    audit(id, '2026-10-14T10:02:00Z', 'ai', 'ai', 'ai', 'plan.propose', 'resolution_plan', 'PL-GC2-2'),
  ];
  return b;
})();

/* ------------------------------------------------------------------ GC-3: heating bill, no SUA */

const GC3: CaseFile = {
  id: 'GC-3', qcId: 'GC-3', state: 'NY', fiscalYear: 2027, householdSize: 2,
  members: [
    { id: 'M1', name: 'Grace O.', age: 67, relationship: 'head', elderlyOrDisabled: true },
    { id: 'M2', name: 'Samuel O.', age: 70, relationship: 'spouse', elderlyOrDisabled: true },
  ],
  filedAt: '2026-10-01', receivedAt: '2026-10-02',
  expedited: { screened: true, eligible: false }, interviewRecorded: true,
  budget: { ...baseBudget, earnedIncomeMonthly: 0, unearnedIncomeMonthly: 1610, payFrequency: null, grossPerPeriod: null, rentMonthly: 880, suaApplied: false, suaType: 'none' },
  employerAlias: null, landlordAlias: null, prov: P, story: 'Heating bill, SUA not applied',
};

export const GC3_BUNDLE: CaseBundle = (() => {
  auditSeq = 0;
  const id = 'GC-3';
  const b = empty(GC3);
  b.docs = [doc(id, 'D-GC3-APP', 'application', 'Application', '2026-10-01'), doc(id, 'D-GC3-BILL', 'utility_bill', 'Gas bill, September', '2026-10-05')];
  b.extractions = [
    { id: 'EX-GC3-1', docId: 'D-GC3-BILL', field: 'heating_charge', value: 'present', page: 1, bbox: { x: 0.1, y: 0.44, w: 0.52, h: 0.05 }, confidence: 0.92, text: 'Gas heating service', seatRunId: 'RUN-GC3-1', prov: P },
    { id: 'EX-GC3-2', docId: 'D-GC3-BILL', field: 'account_holder', value: 'Grace O.', page: 1, bbox: { x: 0.1, y: 0.16, w: 0.3, h: 0.04 }, confidence: 0.95, text: 'Account holder: Grace O.', seatRunId: 'RUN-GC3-1', prov: P },
  ];
  b.flags = [
    { id: 'F-GC3-1', caseId: id, station: 6, ruleId: 'SUA-HEAT-01', title: 'Heating cost shown, SUA not applied', direction: 'under', severity: 'review', deltaMonthly: null, extractionIds: ['EX-GC3-1', 'EX-GC3-2'], citations: [cite('C-GC3-1', '7 CFR 273.9(d)(6)')], recompute: null, question: null, status: 'open', seat: 'shelter_utility_checker', engineAgrees: true, prov: P },
  ];
  b.facts = [
    { id: 'FA-GC3-1', caseId: id, field: 'heating_cost_incurred', value: 'yes', normalized: 'true', sourceKind: 'document', sourceRef: 'D-GC3-BILL', page: 1, bbox: b.extractions[0]!.bbox, observedAt: '2026-10-14T11:00:00Z', confidence: 0.92, prov: P, questionId: null, supersedes: null, status: 'pending', acceptedBy: null },
    { id: 'FA-GC3-2', caseId: id, field: 'heating_cost_incurred', value: 'no SUA', normalized: 'false', sourceKind: 'case_budget', sourceRef: 'GC-3.budget.suaApplied', page: null, bbox: null, observedAt: '2026-10-01T00:00:00Z', confidence: 1, prov: P, questionId: null, supersedes: null, status: 'accepted', acceptedBy: 'case-file' },
  ];
  b.questions = [
    { id: 'Q-GC3-1', caseId: id, field: 'heating_cost_incurred', text: 'Does the household pay for heating?', factIds: ['FA-GC3-1', 'FA-GC3-2'], kind: 'conflict', stake: { measure: 'allotment', amountMonthly: null, candidates: [] }, direction: 'under', status: 'open', closedNote: null, openedAt: '2026-10-14T11:01:00Z', prov: P },
  ];
  b.plans = [
    { id: 'PL-GC3-1', caseId: id, questionId: 'Q-GC3-1', chosenIndex: null, agentRunId: 'RUN-GC3-2', createdAt: '2026-10-14T11:02:00Z', prov: P, options: [
      { channel: 'recheck_file', why: 'The gas bill already on file names the household as the account holder for heating service.', estCost: 'none', estTime: 'now', draft: null, requiresConsent: false },
    ] },
  ];
  b.steps = steps(id, [1, 2, 3, 4]);
  b.gate = [{ id: 'G-GC3-PG6', rule: 'PG6', station: 6, label: 'Heating cost shown with no SUA', severity: 'review', flagId: 'F-GC3-1', resolved: false, override: null }];
  b.agentRuns = [run('RUN-GC3-1', id, 'document_reader', 1720), run('RUN-GC3-2', id, 'resolution_planner', 2440)];
  b.audit = [
    audit(id, '2026-10-14T11:00:00Z', 'system', 'system', 'source', 'doc.received', 'doc', 'D-GC3-BILL'),
    audit(id, '2026-10-14T11:00:10Z', 'ai', 'ai', 'ai', 'seat.run', 'agent_run', 'RUN-GC3-1', { seat: 'document_reader' }),
    audit(id, '2026-10-14T11:00:20Z', 'ai', 'ai', 'source', 'fact.append', 'fact', 'FA-GC3-1'),
    audit(id, '2026-10-14T11:01:00Z', 'system', 'system', 'rules', 'question.open', 'open_question', 'Q-GC3-1'),
    audit(id, '2026-10-14T11:02:00Z', 'ai', 'ai', 'ai', 'plan.propose', 'resolution_plan', 'PL-GC3-1'),
  ];
  return b;
})();

/* ------------------------------------------------------------------ GC-4: clean case */

const GC4: CaseFile = {
  id: 'GC-4', qcId: 'GC-4', state: 'CA', fiscalYear: 2027, householdSize: 3,
  members: [
    { id: 'M1', name: 'Priya K.', age: 29, relationship: 'head', elderlyOrDisabled: false },
    { id: 'M2', name: 'Dev K.', age: 6, relationship: 'child', elderlyOrDisabled: false },
    { id: 'M3', name: 'Asha K.', age: 3, relationship: 'child', elderlyOrDisabled: false },
  ],
  filedAt: '2026-10-08', receivedAt: '2026-10-08',
  expedited: { screened: true, eligible: false }, interviewRecorded: true,
  budget: { ...baseBudget, earnedIncomeMonthly: 2150, payFrequency: 'semimonthly', grossPerPeriod: 1075, rentMonthly: 1200, suaApplied: true, suaType: 'heating_cooling', dependentCareMonthly: 300 },
  employerAlias: 'Employer D (synthetic)', landlordAlias: 'Landlord D (synthetic)', prov: P, story: 'Clean case',
};

export const GC4_BUNDLE: CaseBundle = (() => {
  auditSeq = 0;
  const id = 'GC-4';
  const b = empty(GC4);
  b.docs = [doc(id, 'D-GC4-APP', 'application', 'Application', '2026-10-08'), doc(id, 'D-GC4-PAY', 'paystub', 'Paystub 10/01 to 10/15', '2026-10-16'), doc(id, 'D-GC4-LEASE', 'lease', 'Lease', '2026-10-08')];
  b.extractions = [
    { id: 'EX-GC4-1', docId: 'D-GC4-PAY', field: 'gross_per_period', value: '1075.00', page: 1, bbox: { x: 0.58, y: 0.41, w: 0.3, h: 0.045 }, confidence: 0.97, text: 'Gross $1,075.00', seatRunId: 'RUN-GC4-1', prov: P },
    { id: 'EX-GC4-2', docId: 'D-GC4-PAY', field: 'pay_frequency', value: 'semimonthly', page: 1, bbox: { x: 0.08, y: 0.24, w: 0.3, h: 0.04 }, confidence: 0.95, text: 'Pay frequency: Semi-monthly', seatRunId: 'RUN-GC4-1', prov: P },
    { id: 'EX-GC4-3', docId: 'D-GC4-LEASE', field: 'rent_monthly', value: '1200.00', page: 1, bbox: { x: 0.12, y: 0.36, w: 0.36, h: 0.045 }, confidence: 0.96, text: 'Monthly rent: $1,200.00', seatRunId: 'RUN-GC4-2', prov: P },
  ];
  b.steps = steps(id, [1, 2, 3]);
  b.agentRuns = [run('RUN-GC4-1', id, 'document_reader', 1810), run('RUN-GC4-2', id, 'document_reader', 1690), run('RUN-GC4-3', id, 'income_analyst', 2050)];
  b.audit = [
    audit(id, '2026-10-16T09:00:00Z', 'system', 'system', 'source', 'doc.received', 'doc', 'D-GC4-PAY'),
    audit(id, '2026-10-16T09:00:10Z', 'ai', 'ai', 'ai', 'seat.run', 'agent_run', 'RUN-GC4-1', { seat: 'document_reader' }),
    audit(id, '2026-10-16T09:00:30Z', 'ai', 'ai', 'ai', 'seat.run', 'agent_run', 'RUN-GC4-3', { seat: 'income_analyst', result: 'no findings' }),
  ];
  return b;
})();

export const GOLDEN_BUNDLES: CaseBundle[] = [GC1_BUNDLE, GC2_BUNDLE, GC3_BUNDLE, GC4_BUNDLE];

export const GOLDEN_DEBRIEFS: Debrief[] = [
  { caseId: 'GC-1', certified: { grossIncomeMonthly: 1240, shelterMonthly: 950, allotmentMonthly: null }, qcVerified: { grossIncomeMonthly: 2666, shelterMonthly: 950, allotmentMonthly: null }, qcFinding: { element: 'Wages and salaries', direction: 'over', amount: null, responsibility: 'agency' }, flagsMatched: ['F-GC1-1'], flagsMissed: [], falseFlags: [], overrides: [], caveat: REPLAY_CAVEAT, prov: P },
  { caseId: 'GC-2', certified: { grossIncomeMonthly: 1890, shelterMonthly: 1050, allotmentMonthly: null }, qcVerified: { grossIncomeMonthly: 1890, shelterMonthly: 1350, allotmentMonthly: null }, qcFinding: { element: 'Shelter deduction', direction: 'under', amount: null, responsibility: 'agency' }, flagsMatched: ['F-GC2-1'], flagsMissed: [], falseFlags: [], overrides: [], caveat: REPLAY_CAVEAT, prov: P },
  { caseId: 'GC-3', certified: { grossIncomeMonthly: 1610, shelterMonthly: 880, allotmentMonthly: null }, qcVerified: { grossIncomeMonthly: 1610, shelterMonthly: 880, allotmentMonthly: null }, qcFinding: { element: 'Standard utility allowance', direction: 'under', amount: null, responsibility: 'agency' }, flagsMatched: ['F-GC3-1'], flagsMissed: [], falseFlags: [], overrides: [], caveat: REPLAY_CAVEAT, prov: P },
  { caseId: 'GC-4', certified: { grossIncomeMonthly: 2150, shelterMonthly: 1200, allotmentMonthly: null }, qcVerified: { grossIncomeMonthly: 2150, shelterMonthly: 1200, allotmentMonthly: null }, qcFinding: { element: null, direction: 'none', amount: null, responsibility: 'none' }, flagsMatched: [], flagsMissed: [], falseFlags: [], overrides: [], caveat: REPLAY_CAVEAT, prov: P },
];
