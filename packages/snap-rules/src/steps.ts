/**
 * The ten stations of the SNAP certification process (master prompt section 10).
 * This table is data, used by both web (StationRail) and worker (gate, seats).
 * Citations with verify: true must be checked on eCFR before display; the UI shows
 * them as unverified until data/policy/citations.json says otherwise.
 */
import type { StationId } from '@cleancase/contracts';

export interface LegalBasis {
  cite: string;
  verify: boolean;
}

export interface Station {
  id: StationId;
  slug: string;
  name: string;
  short: string;
  workerDoes: string;
  legal: LegalBasis[];
  clock: string | null;
  seats: string[];
  evidence: string;
  gate: { rule: `PG${number}`; label: string };
}

export const STATIONS: readonly Station[] = [
  {
    id: 1, slug: 'intake', name: 'Application and filing date', short: 'Intake',
    workerDoes: 'Confirm a valid filing (name, address, signature), the filing date, and check for a duplicate application.',
    legal: [{ cite: '7 CFR 273.2(c)', verify: true }],
    clock: 'Starts the 30-day and 7-day clocks',
    seats: ['Intake checker (code)', 'Duplicate flag (fixture)'],
    evidence: 'Application image, filing vs received date',
    gate: { rule: 'PG1', label: 'Filing date unconfirmed' },
  },
  {
    id: 2, slug: 'expedited', name: 'Expedited screening', short: 'Expedited',
    workerDoes: 'Screen for very low income or resources, or shelter costs above income. Identity must be verified; other verification may be postponed.',
    legal: [{ cite: '7 CFR 273.2(i)', verify: true }],
    clock: 'Benefits by day 7',
    seats: ['Rule check (code)', 'Policy Librarian'],
    evidence: 'Income, resources and shelter figures vs thresholds',
    gate: { rule: 'PG2', label: 'Expedited-eligible with no 7-day plan' },
  },
  {
    id: 3, slug: 'interview', name: 'Interview', short: 'Interview',
    workerDoes: 'Hold or record the interview. A missed interview triggers a notice, and no adverse action before day 30.',
    legal: [{ cite: '7 CFR 273.2(e)', verify: true }],
    clock: 'Scheduled to meet 30 days',
    seats: ['Interview Prep: question plan from open flags and the household checker'],
    evidence: 'Question list, notes box, outcome',
    gate: { rule: 'PG3', label: 'Interview not recorded' },
  },
  {
    id: 4, slug: 'verification', name: 'Mandatory verification', short: 'Verification',
    workerDoes: 'Identity, gross non-exempt income, alien status, SSN, residency, disability where relevant, utility expenses or SUA eligibility, claimed medical costs, household composition when questionable.',
    legal: [{ cite: '7 CFR 273.2(f)', verify: false }],
    clock: 'At least 10 days to provide, before certification',
    seats: ['Document Reader', 'Verification Analyst'],
    evidence: 'Checklist: each requirement verified (source), missing, or questionable',
    gate: { rule: 'PG4', label: 'Mandatory item unverified and no pending-verification notice' },
  },
  {
    id: 5, slug: 'income', name: 'Income', short: 'Income',
    workerDoes: 'Budget wages: convert pay frequency (weekly × 4.3, biweekly × 2.15, semi-monthly × 2, monthly × 1), check the employer, anticipated vs past pay, stale documents.',
    legal: [{ cite: '7 CFR 273.9', verify: false }, { cite: '7 CFR 273.10(c)', verify: true }],
    clock: null,
    seats: ['Income Analyst', 'Engine cross-check'],
    evidence: 'Paystub crop with bbox, conversion arithmetic, case value vs recomputed',
    gate: { rule: 'PG5', label: 'Budget differs from recompute by more than tolerance, or document date outside the budget month' },
  },
  {
    id: 6, slug: 'deductions', name: 'Deductions and shelter', short: 'Deductions',
    workerDoes: 'Standard, 20% earned income, dependent care, medical (elderly/disabled), child support, excess shelter, SUA, homeless deduction; apply the OBBBA SUA limit.',
    legal: [{ cite: '7 CFR 273.9(d)', verify: true }],
    clock: null,
    seats: ['Shelter and Utility Checker'],
    evidence: 'Lease and bill crops, SUA applied vs heating/cooling evidence',
    gate: { rule: 'PG6', label: 'SUA applied without cost shown, or heating cost shown with no SUA' },
  },
  {
    id: 7, slug: 'household', name: 'Household composition', short: 'Household',
    workerDoes: 'Compare lease occupants and documents with household members. Write the question, never the answer.',
    legal: [{ cite: '7 CFR 273.1', verify: true }],
    clock: null,
    seats: ['Household Composition Checker'],
    evidence: 'Names on lease vs case members',
    gate: { rule: 'PG7', label: 'Unresolved household mismatch' },
  },
  {
    id: 8, slug: 'resolve', name: 'Resolve open questions', short: 'Resolve',
    workerDoes: 'Work match alerts (wage, SSA, unemployment, duplicate participation) so none ages; approve planner suggestions and outreach; call the employer or landlord for open conflicts.',
    legal: [{ cite: '7 CFR 272.8', verify: false }, { cite: '7 CFR 273.2(f)', verify: false }],
    clock: 'Alerts must be acted on',
    seats: ['Resolution Planner', 'Change-Report Triage (P1)', 'Voice Verifier'],
    evidence: 'Alert list with aging (over 10 days in conflict color), call transcript and facts',
    gate: { rule: 'PG8', label: 'Unworked match alert or open collateral request' },
  },
  {
    id: 9, slug: 'budget', name: 'Budget and determination', short: 'Budget',
    workerDoes: 'Recompute; compare to the case file in both directions; set the certification period and reporting type.',
    legal: [{ cite: '7 CFR 273.10', verify: true }],
    clock: '30-day standard',
    seats: ['Recompute engine', 'PolicyEngine-US (when on)'],
    evidence: 'Budgeted vs recomputed vs delta, tolerance line, over/under direction',
    gate: { rule: 'PG9', label: 'Unresolved delta above tolerance' },
  },
  {
    id: 10, slug: 'gate', name: 'Pre-issuance gate, second-party review, notice', short: 'Gate',
    workerDoes: 'Gate runs; supervisor second-party review (different identity); draft notice; certify (simulated, nothing leaves the app).',
    legal: [{ cite: '7 CFR 272.4', verify: false }, { cite: '7 CFR 273.10(g)', verify: true }],
    clock: 'Adverse action needs advance notice',
    seats: ['Notice Drafter (P2, draft only)'],
    evidence: 'Gate list, supervisor sign-off, stamp',
    gate: { rule: 'PG10', label: 'Override without a reason' },
  },
] as const;

export function station(id: StationId): Station {
  const s = STATIONS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown station ${id}`);
  return s;
}
