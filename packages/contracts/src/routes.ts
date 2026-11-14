/** Worker REST routes (master prompt section 15). Web calls these through web/lib/data only. */
export const WorkerRoutes = {
  health: '/health',
  status: '/status',
  events: '/events',
  states: '/states',
  cases: '/cases',
  case: (id: string) => `/cases/${encodeURIComponent(id)}`,
  debrief: (id: string) => `/cases/${encodeURIComponent(id)}/debrief`,
  shift: '/shift',
  seatsRun: '/seats/run',
  ledger: (caseId: string) => `/ledger/${encodeURIComponent(caseId)}`,
  plannerPlan: '/planner/plan',
  outreachApprove: (id: string) => `/outreach/${encodeURIComponent(id)}/approve`,
  upload: (token: string) => `/upload/${encodeURIComponent(token)}`,
  policySearch: '/policy/search',
  recompute: '/recompute',
  doc: (id: string) => `/docs/${encodeURIComponent(id)}`,
  voiceSession: '/voice/session',
  voiceWs: (callId: string) => `/voice/ws/${encodeURIComponent(callId)}`,
  voiceAnswer: (callId: string) => `/voice/answer/${encodeURIComponent(callId)}`,
  evalRun: '/eval/run',
} as const;

export const FOOTER_TEXT =
  'Synthetic demo documents. No real applicants. Stampy flags and cites; a merit-staff worker decides. Not an eligibility system.';

export const AUTHENTICITY_CAVEAT = 'Internally consistent with the record, not proof of authenticity.';

export const REPLAY_CAVEAT =
  'Synthetic documents are generated from the QC-verified values, so a catch on a replay case demonstrates the pipeline, not a real-world detection rate.';
