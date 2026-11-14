/**
 * Rules engine (deterministic). Monthly income uses the SNAP conversion factors in packages/snap-rules
 * (weekly × 4.3, biweekly × 2.15, semimonthly × 2); the benefit comes from PolicyEngine-US, run locally.
 * Two input sets: as the application was filed, and as the resolved evidence says.
 */
import type { BenefitResult, Fact, Question } from '@stampy/contracts/stampy';
import { FREQUENCY_FACTOR } from '@stampy/snap-rules';
import { env } from '../env';
import { FREQUENCY_LABEL, type PayFrequency } from '../ledger/normalize';

export interface BenefitInputs {
  state: string;
  householdSize: number;
  grossPerCheck: number;
  payFrequency: PayFrequency;
  rentMonthly: number;
  month: string; // YYYY-MM, the application month
}

export interface PeResult { snap: number; eligible: boolean; netIncome: number; grossIncome: number; maxAllotment: number; version: string; ms: number }

const isFreq = (v: string): v is PayFrequency => v in FREQUENCY_FACTOR;

export function monthlyIncome(grossPerCheck: number, freq: PayFrequency): number {
  return Math.round(grossPerCheck * FREQUENCY_FACTOR[freq] * 100) / 100;
}

let peVersion: string | null = null;

export async function policyEngineHealth(): Promise<{ ok: boolean; version: string | null }> {
  try {
    const r = await fetch(`${env.POLICYENGINE_URL}/health`, { signal: AbortSignal.timeout(1500) });
    const j = (await r.json()) as { ok: boolean; version: string };
    peVersion = j.version;
    return { ok: !!j.ok, version: j.version };
  } catch {
    return { ok: false, version: null };
  }
}

export async function snapBenefit(i: BenefitInputs): Promise<PeResult | null> {
  try {
    const r = await fetch(`${env.POLICYENGINE_URL}/snap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        state: i.state, householdSize: i.householdSize, month: i.month,
        earnedIncomeMonthly: monthlyIncome(i.grossPerCheck, i.payFrequency), rentMonthly: i.rentMonthly,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as PeResult;
    peVersion = j.version;
    return j;
  } catch {
    return null;
  }
}

export function engineName(): string {
  return `policyengine-us ${peVersion ?? '(not running)'}`;
}

export async function benefitFor(i: BenefitInputs, basis: string): Promise<BenefitResult> {
  const pe = await snapBenefit(i);
  return {
    incomeMonthly: monthlyIncome(i.grossPerCheck, i.payFrequency),
    payFrequency: i.payFrequency,
    grossPerCheck: i.grossPerCheck,
    benefitMonthly: pe ? pe.snap : null,
    eligible: pe ? pe.eligible : null,
    netIncomeMonthly: pe ? pe.netIncome : null,
    maxAllotment: pe ? pe.maxAllotment : null,
    basis,
  };
}

/* ---------------- choosing inputs from the ledger ---------------- */

const money = (v: string | undefined) => (v ? Number(v) : NaN);

function latest(facts: Fact[], field: string, pred: (f: Fact) => boolean = () => true): Fact | undefined {
  const xs = facts.filter((f) => f.field === field && pred(f));
  return xs[xs.length - 1];
}

/** The application date (filing date) from the form, else null. */
export function applicationDate(facts: Fact[]): string | null {
  const f = latest(facts, 'application_date', (x) => x.sourceKind === 'application_form');
  return f && /^\d{4}-\d{2}-\d{2}$/.test(f.normalized) ? f.normalized : null;
}

/** Inputs exactly as the applicant filed them (application form only). Null if the form lacks what is needed. */
export function filedInputs(facts: Fact[], fallbackState: string, fallbackDate: string): BenefitInputs | null {
  const form = (field: string) => latest(facts, field, (x) => x.sourceKind === 'application_form');
  const freq = form('pay_frequency')?.normalized;
  const gross = money(form('gross_pay_amount')?.normalized);
  if (!freq || !isFreq(freq) || !Number.isFinite(gross)) return null;
  return {
    state: form('state')?.normalized || fallbackState,
    householdSize: Number(form('household_size')?.normalized) || 1,
    grossPerCheck: gross,
    payFrequency: freq,
    rentMonthly: money(form('monthly_rent')?.normalized) || 0,
    month: (applicationDate(facts) ?? fallbackDate).slice(0, 7),
  };
}

/**
 * Inputs from the resolved evidence: a closed question's resolved value wins; otherwise the most recent
 * paystub (by pay date) for pay facts, the lease for rent, and the form for everything else.
 */
export function resolvedInputs(facts: Fact[], questions: Question[], filed: BenefitInputs): BenefitInputs {
  const resolved = (field: string) => questions.find((q) => q.field === field && q.status === 'closed' && q.resolvedValue)?.resolvedValue ?? null;
  const docs = facts.filter((f) => f.sourceKind === 'document');
  const payDocs = new Map<string, string>(); // sourceRef → pay date
  for (const f of docs) if (f.field === 'pay_date' && f.sourceRef) payDocs.set(f.sourceRef, f.normalized);
  const newestStub = [...payDocs.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1))[0]?.[0];
  const fromStub = (field: string) => latest(docs, field, (x) => x.sourceRef === newestStub)?.normalized;

  const freqRaw = resolved('pay_frequency') ?? fromStub('pay_frequency') ?? filed.payFrequency;
  const gross = money(resolved('gross_pay_amount') ?? fromStub('gross_pay_amount') ?? String(filed.grossPerCheck));
  const rent = money(resolved('monthly_rent') ?? latest(docs, 'monthly_rent')?.normalized ?? String(filed.rentMonthly));
  const size = Number(resolved('household_size') ?? '') || filed.householdSize;
  return {
    ...filed,
    payFrequency: isFreq(freqRaw) ? freqRaw : filed.payFrequency,
    grossPerCheck: Number.isFinite(gross) ? gross : filed.grossPerCheck,
    rentMonthly: Number.isFinite(rent) ? rent : filed.rentMonthly,
    householdSize: size,
  };
}

export function describe(i: BenefitInputs): string {
  const m = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${m(i.grossPerCheck)} paid ${FREQUENCY_LABEL[i.payFrequency]} × ${FREQUENCY_FACTOR[i.payFrequency]} = ${m(monthlyIncome(i.grossPerCheck, i.payFrequency))}/mo; household of ${i.householdSize}; rent ${m(i.rentMonthly)}/mo; ${i.state}, ${i.month}`;
}
