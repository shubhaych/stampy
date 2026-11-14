/**
 * Dev fixture: one full CaseBundleV2 (STP-1001), used only when the URL carries ?fixture=1.
 * Every figure rendered from this bundle is badged Fixture by the page, never Live.
 */
import type { AuditRow, CaseBundleV2, CaseSummary, Fact } from '@stampy/contracts/stampy';

const ID = 'STP-1001';
const T = (min: number) => new Date(Date.UTC(2026, 10, 12, 16, 0, 0) + min * 60_000).toISOString();

const DOC_FORM = 'DOC-1001-1';
const DOC_STUB_SEPT = 'DOC-1001-2';
const DOC_STUB_OCT = 'DOC-1001-3';
const CALL = 'CALL-1001-1';
const Q_FREQ = 'Q-1001-1';
const Q_STUB = 'Q-1001-2';

let seq = 0;
function fact(p: Partial<Fact> & Pick<Fact, 'field' | 'value' | 'normalized' | 'sourceKind' | 'sourceLabel' | 'observedAt'>): Fact {
  seq += 1;
  return {
    id: `F-1001-${seq}`,
    seq,
    caseId: ID,
    sourceRef: null,
    page: null,
    line: null,
    bbox: null,
    atSeconds: null,
    confidence: 0.95,
    questionId: null,
    prov: 'synthetic',
    createdBy: 'reader',
    ...p,
  };
}

const facts: Fact[] = [
  fact({ field: 'applicant_name', value: 'Lena Torres', normalized: 'lena torres', sourceKind: 'application_form', sourceRef: DOC_FORM, sourceLabel: 'Application form', page: 1, line: 'Name: Lena Torres', bbox: { x: 0.08, y: 0.16, w: 0.42, h: 0.04 }, observedAt: T(1) }),
  fact({ field: 'household_size', value: '3', normalized: '3', sourceKind: 'application_form', sourceRef: DOC_FORM, sourceLabel: 'Application form', page: 1, line: 'People in your household: 3', bbox: { x: 0.08, y: 0.27, w: 0.38, h: 0.04 }, observedAt: T(1) }),
  fact({ field: 'employer_name', value: 'Valley Fresh Grocers', normalized: 'valley fresh grocers', sourceKind: 'application_form', sourceRef: DOC_FORM, sourceLabel: 'Application form', page: 1, line: 'Employer: Valley Fresh Grocers', bbox: { x: 0.08, y: 0.41, w: 0.5, h: 0.04 }, observedAt: T(1) }),
  fact({ field: 'gross_pay_amount', value: '$1,240.00', normalized: '1240.00', sourceKind: 'application_form', sourceRef: DOC_FORM, sourceLabel: 'Application form', page: 1, line: 'Monthly income before taxes: $1,240', bbox: { x: 0.08, y: 0.47, w: 0.56, h: 0.04 }, observedAt: T(1) }),
  fact({ field: 'pay_frequency', value: 'Monthly', normalized: 'monthly', sourceKind: 'application_form', sourceRef: DOC_FORM, sourceLabel: 'Application form', page: 1, line: 'How often are you paid? Monthly', bbox: { x: 0.08, y: 0.52, w: 0.48, h: 0.04 }, confidence: 0.9, observedAt: T(1) }),
  fact({ field: 'monthly_rent', value: '$1,450.00', normalized: '1450.00', sourceKind: 'application_form', sourceRef: DOC_FORM, sourceLabel: 'Application form', page: 1, line: 'Rent per month: $1,450', bbox: { x: 0.08, y: 0.63, w: 0.4, h: 0.04 }, observedAt: T(1) }),
  fact({ field: 'employer_name', value: 'Valley Fresh Grocers', normalized: 'valley fresh grocers', sourceKind: 'document', sourceRef: DOC_STUB_SEPT, sourceLabel: 'Paystub, Sep 26', page: 1, line: 'VALLEY FRESH GROCERS INC.', bbox: { x: 0.06, y: 0.05, w: 0.5, h: 0.05 }, observedAt: T(2) }),
  fact({ field: 'gross_pay_amount', value: '$1,240.00', normalized: '1240.00', sourceKind: 'document', sourceRef: DOC_STUB_SEPT, sourceLabel: 'Paystub, Sep 26', page: 1, line: 'Gross pay this period $1,240.00', bbox: { x: 0.52, y: 0.44, w: 0.4, h: 0.05 }, observedAt: T(2) }),
  fact({ field: 'pay_frequency', value: 'Biweekly', normalized: 'biweekly', sourceKind: 'document', sourceRef: DOC_STUB_SEPT, sourceLabel: 'Paystub, Sep 26', page: 1, line: 'Pay period 09/13/2026 to 09/26/2026 (Biweekly)', bbox: { x: 0.06, y: 0.22, w: 0.62, h: 0.05 }, observedAt: T(2) }),
  fact({ field: 'pay_date', value: '2026-09-26', normalized: '2026-09-26', sourceKind: 'document', sourceRef: DOC_STUB_SEPT, sourceLabel: 'Paystub, Sep 26', page: 1, line: 'Pay date 09/26/2026', bbox: { x: 0.62, y: 0.14, w: 0.3, h: 0.05 }, observedAt: T(2) }),
  fact({ field: 'pay_frequency', value: 'Every two weeks', normalized: 'biweekly', sourceKind: 'phone_call', sourceRef: CALL, sourceLabel: 'Phone call', line: 'Every other Friday, so every two weeks.', atSeconds: 42, confidence: 0.92, questionId: Q_FREQ, prov: 'synthetic', createdBy: 'voice', observedAt: T(33) }),
  fact({ field: 'gross_pay_amount', value: '$1,230.46', normalized: '1230.46', sourceKind: 'email', sourceRef: DOC_STUB_OCT, sourceLabel: 'Emailed paystub, Oct 24', page: 1, line: 'Gross pay this period $1,230.46', bbox: { x: 0.5, y: 0.46, w: 0.42, h: 0.05 }, questionId: Q_STUB, observedAt: T(61) }),
  fact({ field: 'pay_frequency', value: 'Biweekly', normalized: 'biweekly', sourceKind: 'email', sourceRef: DOC_STUB_OCT, sourceLabel: 'Emailed paystub, Oct 24', page: 1, line: 'Pay period 10/11/2026 to 10/24/2026 (Biweekly)', bbox: { x: 0.06, y: 0.23, w: 0.6, h: 0.05 }, observedAt: T(61) }),
  fact({ field: 'pay_date', value: '2026-10-24', normalized: '2026-10-24', sourceKind: 'email', sourceRef: DOC_STUB_OCT, sourceLabel: 'Emailed paystub, Oct 24', page: 1, line: 'Pay date 10/24/2026', bbox: { x: 0.62, y: 0.15, w: 0.3, h: 0.05 }, questionId: Q_STUB, observedAt: T(61) }),
];

let auditId = 0;
function audit(min: number, kind: AuditRow['kind'], action: string, actorRole: AuditRow['actorRole'], entity: string, entityId: string, data: AuditRow['data'] = null, actor = actorRole === 'ai' ? 'claude' : actorRole === 'worker' ? 'M. Alvarez' : 'system'): AuditRow {
  auditId += 1;
  return { id: auditId, caseId: ID, at: T(min), actor, actorRole, kind, action, entity, entityId, data };
}

const auditRows: AuditRow[] = [
  audit(0, 'source', 'case.created', 'applicant', 'case', ID, null, 'applicant'),
  audit(0, 'source', 'document.received', 'applicant', 'document', DOC_FORM, { source: 'upload' }, 'applicant'),
  audit(0, 'source', 'document.received', 'applicant', 'document', DOC_STUB_SEPT, { source: 'upload' }, 'applicant'),
  audit(1, 'ai', 'document.read', 'ai', 'document', DOC_FORM, { docId: DOC_FORM, kind: 'application_form', source: 'upload', facts: 6 }),
  audit(2, 'ai', 'document.read', 'ai', 'document', DOC_STUB_SEPT, { docId: DOC_STUB_SEPT, kind: 'paystub', source: 'upload', facts: 4 }),
  audit(2, 'rules', 'question.opened', 'system', 'question', Q_FREQ, { questionId: Q_FREQ, field: 'pay_frequency' }),
  audit(2, 'rules', 'question.opened', 'system', 'question', Q_STUB, { questionId: Q_STUB, field: 'recent_paystub' }),
  audit(3, 'ai', 'email.drafted', 'ai', 'outreach', 'OUT-1001-1', { kind: 'request' }),
  audit(9, 'human', 'email.approved', 'worker', 'outreach', 'OUT-1001-1', { kind: 'request' }),
  audit(9, 'outreach', 'email.sent', 'system', 'outreach', 'OUT-1001-1', { kind: 'request', simulated: true }),
  audit(32, 'outreach', 'call.started', 'system', 'call', CALL, { simulated: true }),
  audit(32, 'outreach', 'call.verified', 'system', 'call', CALL, { method: 'reference code and date of birth' }),
  audit(33, 'ai', 'call.answer_recorded', 'ai', 'question', Q_FREQ, { questionId: Q_FREQ, value: 'biweekly', atSeconds: 42 }),
  audit(33, 'rules', 'question.answered', 'system', 'question', Q_FREQ, { questionId: Q_FREQ, field: 'pay_frequency' }),
  audit(34, 'outreach', 'call.ended', 'system', 'call', CALL, { reason: 'caller hung up' }),
  audit(34, 'ai', 'email.drafted', 'ai', 'outreach', 'OUT-1001-2', { kind: 'checklist' }),
  audit(34, 'outreach', 'email.sent', 'system', 'outreach', 'OUT-1001-2', { kind: 'checklist', simulated: true }),
  audit(60, 'outreach', 'email.received', 'applicant', 'inbound', 'IN-1001-1', { attachments: 1 }, 'applicant'),
  audit(60, 'source', 'document.received', 'applicant', 'document', DOC_STUB_OCT, { source: 'email' }, 'applicant'),
  audit(61, 'ai', 'document.read', 'ai', 'document', DOC_STUB_OCT, { docId: DOC_STUB_OCT, kind: 'paystub', source: 'email', facts: 3 }),
  audit(61, 'rules', 'question.closed', 'system', 'question', Q_STUB, { questionId: Q_STUB, field: 'recent_paystub' }),
  audit(61, 'rules', 'question.closed', 'system', 'question', Q_FREQ, { questionId: Q_FREQ, field: 'pay_frequency' }),
  audit(62, 'rules', 'recompute.done', 'system', 'recompute', 'RC-1001-1', { before: 744, after: 233 }),
];

const summary: CaseSummary = {
  id: ID,
  refCode: '482913',
  applicantName: 'Lena Torres',
  applicantEmail: 'lena.torres@example.com',
  applicantPhone: '+14155550123',
  state: 'CA',
  status: 'ready_for_review',
  createdAt: T(0),
  updatedAt: T(62),
  openQuestions: 0,
  documents: 3,
};

export const FIXTURE_CASE_ID = ID;

export const FIXTURE_BUNDLE: CaseBundleV2 = {
  case: summary,
  documents: [
    { id: DOC_FORM, caseId: ID, kind: 'application_form', filename: 'application-form.png', contentType: 'image/png', synthetic: true, source: 'upload', readStatus: 'read', readError: null, summary: 'CalFresh application for a household of 3. Lists one job at Valley Fresh Grocers, monthly income before taxes of $1,240, paid monthly, rent of $1,450.', receivedAt: T(0) },
    { id: DOC_STUB_SEPT, caseId: ID, kind: 'paystub', filename: 'paystub-sep.png', contentType: 'image/png', synthetic: true, source: 'upload', readStatus: 'read', readError: null, summary: 'Paystub from Valley Fresh Grocers for 09/13 to 09/26/2026, paid biweekly, gross pay of $1,240.00.', receivedAt: T(0) },
    { id: DOC_STUB_OCT, caseId: ID, kind: 'paystub', filename: 'paystub-photo.jpg', contentType: 'image/jpeg', synthetic: true, source: 'email', readStatus: 'read', readError: null, summary: 'Photo of a paystub for 10/11 to 10/24/2026, paid biweekly, gross pay of $1,230.46.', receivedAt: T(60) },
  ],
  facts,
  questions: [
    {
      id: Q_FREQ, caseId: ID, kind: 'conflict', field: 'pay_frequency', title: 'Pay frequency',
      ask: 'How often do you get paid: once a month, or every two weeks?',
      why: 'The application says $1,240 a month. The September paystub shows $1,240 for a two-week period. Paid every two weeks, monthly income is about twice as high.',
      factIds: ['F-1001-5', 'F-1001-9'],
      candidates: [
        { value: 'monthly', label: 'Monthly (application form)', sources: ['F-1001-5'], incomeMonthly: 1240, benefitMonthly: 744 },
        { value: 'biweekly', label: 'Every two weeks (paystub)', sources: ['F-1001-9'], incomeMonthly: 2687, benefitMonthly: 227 },
      ],
      stakeMonthly: 517, direction: 'over', channel: 'phone', status: 'closed', resolvedValue: 'biweekly', resolutionFactId: 'F-1001-11',
      closedNote: 'Applicant confirmed on the call that she is paid every two weeks; the emailed October paystub shows the same period.',
      openedAt: T(2), closedAt: T(61),
    },
    {
      id: Q_STUB, caseId: ID, kind: 'missing_document', field: 'recent_paystub', title: 'Recent paystub',
      ask: 'Please send a photo of your most recent paystub.',
      why: 'The only paystub on file is from September 26, more than 30 days before the application date.',
      factIds: ['F-1001-10'], candidates: [], stakeMonthly: null, direction: 'none', channel: 'document', status: 'closed',
      resolvedValue: '2026-10-24', resolutionFactId: 'F-1001-14',
      closedNote: 'Paystub dated October 24 received by email and read.', openedAt: T(2), closedAt: T(61),
    },
  ],
  outreach: [
    {
      id: 'OUT-1001-1', caseId: ID, kind: 'request', toAddr: 'lena.torres@example.com', subject: 'Your food assistance application: two quick things',
      bodyText: 'Hi Lena,\n\nThanks for applying. We need two things to finish checking your application:\n\n1. How often you are paid. Please call us at the number below, it takes about two minutes.\n2. A photo of your most recent paystub.\n\nYour reference code is 482 913. Have it ready when you call.\n\nA caseworker reviews everything before anything changes.',
      status: 'simulated', threadId: 'THR-1001', error: null, approvedBy: 'M. Alvarez', createdAt: T(3), sentAt: T(9),
    },
    {
      id: 'OUT-1001-2', caseId: ID, kind: 'checklist', toAddr: 'lena.torres@example.com', subject: 'What to send next',
      bodyText: 'Hi Lena,\n\nThanks for calling. As promised, here is what we still need:\n\n[ ] A photo of your most recent paystub (the whole page)\n\nJust reply to this email with the photo attached.',
      status: 'simulated', threadId: 'THR-1001', error: null, approvedBy: null, createdAt: T(34), sentAt: T(34),
    },
  ],
  inbound: [
    { id: 'IN-1001-1', caseId: ID, fromAddr: 'lena.torres@example.com', subject: 'Re: What to send next', bodyText: 'Here is my latest paystub. Thanks!', attachmentCount: 1, simulated: true, receivedAt: T(60) },
  ],
  calls: [
    {
      id: CALL, caseId: ID, fromNumber: '+14155550123', verified: true, simulated: true, status: 'ended', startedAt: T(32), endedAt: T(34), endedReason: 'caller hung up',
      turns: [
        { role: 'assistant', text: 'Hi, this is Stampy, an AI assistant for the benefits office. I can help with your food assistance application. You can ask for a person to call you back at any time. What is your reference code?', atSeconds: 0 },
        { role: 'caller', text: 'It is 482 913.', atSeconds: 14 },
        { role: 'assistant', text: 'Thanks, Lena. One question about your pay. How often do you get paid?', atSeconds: 30 },
        { role: 'caller', text: 'Every other Friday, so every two weeks.', atSeconds: 42 },
        { role: 'assistant', text: 'Got it. I will email you a short checklist. Please reply with a photo of your most recent paystub. A caseworker reviews everything.', atSeconds: 55 },
      ],
      recordingUrl: null, callbackRequested: null,
    },
  ],
  recompute: {
    id: 'RC-1001-1', caseId: ID, engine: 'policyengine-us 2.124.5',
    before: { incomeMonthly: 1240, payFrequency: 'monthly', grossPerCheck: 1240, benefitMonthly: 744, eligible: true, netIncomeMonthly: 267, maxAllotment: 768, basis: 'As filed: $1,240 paid monthly, household of 3, rent $1,450, CA.' },
    after: { incomeMonthly: 2666, payFrequency: 'biweekly', grossPerCheck: 1230.46, benefitMonthly: 233, eligible: true, netIncomeMonthly: 1418, maxAllotment: 768, basis: 'From accepted evidence: $1,230.46 every two weeks (x 26 / 12), household of 3, rent $1,450, CA.' },
    ms: 412, createdAt: T(62),
  },
  decision: null,
  audit: auditRows,
  phoneNumber: '+14155550199',
  modes: { ai: 'fixture', email: 'fixture', voice: 'fixture', rules: 'fixture' },
};

export const FIXTURE_SUMMARIES: CaseSummary[] = [summary];
