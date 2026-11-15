/**
 * Conflict detector (deterministic code, not AI). Opens open questions from the ledger and closes them
 * when evidence arrives. Claude never decides whether something conflicts; it only reads documents and
 * takes the applicant's spoken answer.
 *
 *  - conflict: two sources disagree on a compared field (form says monthly, paystub says biweekly).
 *  - missing_document: no paystub dated within RECENT_PAY_DAYS before the application date (demo setting).
 *
 * Closing rules:
 *  - a conflict closes when an answer (a fact attached to the question) agrees with a document; if the
 *    answer disagrees with every document it is marked "answered" for the caseworker to weigh. Nothing is
 *    resolved against the documents automatically.
 *  - a missing_document question closes when a paystub dated inside the window is read.
 */
import type { Candidate, Fact, Question } from '@stampy/contracts/stampy';
import { FIELD_LABEL } from '@stampy/contracts/stampy';
import type { Q } from '../db';
import { id } from '../ids';
import { env } from '../env';
import { audit } from '../core/audit';
import { SYSTEM } from '../core/authz';
import { listFacts } from './facts';
import { FREQUENCY_LABEL, type PayFrequency } from './normalize';
import { applicationDate, benefitFor, filedInputs, monthlyIncome, type BenefitInputs } from '../rules/benefit';

/** Fields compared across sources, and the question to ask when they disagree. */
const COMPARED: Record<string, { ask: (c: Candidate[]) => string; why: string }> = {
  pay_frequency: {
    ask: () => 'How often are you paid: every week, every two weeks, twice a month, or once a month?',
    why: 'Pay frequency sets how a paycheck converts to monthly income, which drives the benefit.',
  },
  gross_pay_amount: {
    // Two paystubs with the same pay date and different pay: ask which one is right, by name.
    ask: (c) => {
      const stubs = c.filter((x) => x.sources.some((l) => l.startsWith('Paystub')));
      const dated = stubs.length >= 2 ? stubs[0]!.sources.find((l) => l.startsWith('Paystub') && stubs[1]!.sources.includes(l)) : undefined;
      return dated
        ? `We have two paystubs with ${dated.replace(/^Paystub, /, '')} that show different pay before taxes: ${stubs.map((x) => x.label).join(' and ')}. Which amount is correct?`
        : 'What is your usual pay before taxes on each paycheck?';
    },
    why: 'Gross pay per check is counted income.',
  },
  monthly_rent: {
    ask: () => 'How much is your rent each month?',
    why: 'Shelter costs change the excess shelter deduction.',
  },
  household_members: {
    ask: () => 'Who lives with you and buys and prepares food with you?',
    why: 'Household size changes the maximum benefit and income limits.',
  },
  employer_name: {
    ask: () => 'Who is your employer?',
    why: 'Each employer is a separate income source to verify.',
  },
};

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const pretty = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthName = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToQuestion(x: any): Question {
  return {
    id: x.id, caseId: x.case_id, kind: x.kind, field: x.field, title: x.title, ask: x.ask, why: x.why,
    factIds: x.fact_ids ?? [], candidates: x.candidates ?? [], stakeMonthly: x.stake_monthly, direction: x.direction,
    channel: x.channel, status: x.status, resolvedValue: x.resolved_value, resolutionFactId: x.resolution_fact_id,
    closedNote: x.closed_note, openedAt: x.opened_at, closedAt: x.closed_at,
  };
}

export async function listQuestions(db: Q, caseId: string): Promise<Question[]> {
  const r = await db.query(`SELECT * FROM open_question WHERE case_id = $1 ORDER BY opened_at, id`, [caseId]);
  return r.rows.map(rowToQuestion);
}

/** Facts that describe the case itself (not answers to a question). */
const evidence = (facts: Fact[]) => facts.filter((f) => !f.questionId && (f.sourceKind === 'application_form' || f.sourceKind === 'document'));

/** Benefit for a candidate value of one field, holding everything else as filed. */
async function candidateBenefit(field: string, value: string, filed: BenefitInputs | null): Promise<{ income: number | null; benefit: number | null }> {
  if (!filed) return { income: null, benefit: null };
  const i: BenefitInputs = { ...filed };
  if (field === 'pay_frequency' && value in FREQUENCY_LABEL) i.payFrequency = value as PayFrequency;
  else if (field === 'gross_pay_amount' && Number.isFinite(Number(value))) i.grossPerCheck = Number(value);
  else if (field === 'monthly_rent' && Number.isFinite(Number(value))) i.rentMonthly = Number(value);
  else if (field === 'household_members') i.householdSize = value.split(';').filter(Boolean).length || i.householdSize;
  else return { income: null, benefit: null };
  const b = await benefitFor(i, '');
  return { income: monthlyIncome(i.grossPerCheck, i.payFrequency), benefit: b.benefitMonthly };
}

function valueLabel(field: string, normalized: string, raw: string): string {
  if (field === 'pay_frequency' && normalized in FREQUENCY_LABEL) return FREQUENCY_LABEL[normalized as PayFrequency];
  return raw;
}

export interface DetectResult { opened: Question[]; closed: Question[]; answered: Question[] }

export async function detect(db: Q, caseId: string, fallback: { state: string; createdAt: string }): Promise<DetectResult> {
  const facts = await listFacts(db, caseId);
  const existing = await listQuestions(db, caseId);
  const out: DetectResult = { opened: [], closed: [], answered: [] };
  const filed = filedInputs(facts, fallback.state, fallback.createdAt.slice(0, 10));
  const ev = evidence(facts);

  /* ---- open conflicts ---- */
  for (const field of Object.keys(COMPARED)) {
    if (existing.some((q) => q.field === field && q.kind === 'conflict')) continue;
    const onField = ev.filter((f) => f.field === field);
    const groups = new Map<string, Fact[]>();
    for (const f of onField) groups.set(f.normalized, [...(groups.get(f.normalized) ?? []), f]);
    if (groups.size < 2) continue;
    const candidates: Candidate[] = [];
    for (const [norm, fs] of groups) {
      const { income, benefit } = await candidateBenefit(field, norm, filed);
      candidates.push({ value: norm, label: valueLabel(field, norm, fs[0]!.value), sources: fs.map((f) => f.sourceLabel), incomeMonthly: income, benefitMonthly: benefit });
    }
    const benefits = candidates.map((c) => c.benefitMonthly).filter((b): b is number => b !== null);
    const stake = benefits.length >= 2 ? Math.max(...benefits) - Math.min(...benefits) : null;
    // Direction: what happens if the filed value is wrong and the documents are right.
    const formNorm = onField.find((f) => f.sourceKind === 'application_form')?.normalized;
    const formC = candidates.find((c) => c.value === formNorm);
    const docC = candidates.find((c) => c.value !== formNorm);
    let direction: Question['direction'] = 'none';
    if (formC?.benefitMonthly != null && docC?.benefitMonthly != null && formC.benefitMonthly !== docC.benefitMonthly) {
      direction = formC.benefitMonthly > docC.benefitMonthly ? 'over' : 'under';
    }
    const title = FIELD_LABEL[field] ?? field;
    const why = `${COMPARED[field]!.why} ${candidates.map((c) => `${c.sources.join(', ')}: ${c.label}`).join(' vs ')}.${stake !== null ? ` About ${money(stake)} a month in benefits depends on the answer.` : ''}`;
    const qid = id('Q');
    const r = await db.query(
      `INSERT INTO open_question (id, case_id, kind, field, title, ask, why, fact_ids, candidates, stake_monthly, direction, channel)
       VALUES ($1,$2,'conflict',$3,$4,$5,$6,$7,$8,$9,$10,'phone') ON CONFLICT (case_id, field, kind) DO NOTHING RETURNING *`,
      [qid, caseId, field, title, COMPARED[field]!.ask(candidates), why, onField.map((f) => f.id), JSON.stringify(candidates), stake, direction],
    );
    if (r.rows[0]) {
      const q = rowToQuestion(r.rows[0]);
      out.opened.push(q);
      await audit(db, { caseId, who: SYSTEM, kind: 'rules', action: 'question.opened', entity: 'open_question', entityId: q.id, data: { questionId: q.id, field, kind: 'conflict', stake, direction } });
    }
  }

  /* ---- open missing recent paystub ---- */
  const appDate = applicationDate(facts) ?? fallback.createdAt.slice(0, 10);
  const windowStart = addDays(appDate, -env.RECENT_PAY_DAYS);
  const payDates = ev.filter((f) => f.field === 'pay_date' && /^\d{4}-\d{2}-\d{2}$/.test(f.normalized));
  const inWindow = payDates.filter((f) => f.normalized >= windowStart && f.normalized <= appDate);
  const reportsWork = ev.some((f) => f.field === 'employer_name' || f.field === 'gross_pay_amount');
  if (reportsWork && !inWindow.length && !existing.some((q) => q.kind === 'missing_document' && q.field === 'recent_paystub')) {
    const newest = payDates.map((f) => f.normalized).sort().pop();
    const qid = id('Q');
    const ask = `Send a photo of your ${monthName(addDays(appDate, -Math.round(env.RECENT_PAY_DAYS / 2)))} paystub (any paystub dated between ${pretty(windowStart)} and ${pretty(appDate)}).`;
    const why = newest
      ? `The newest paystub on file is dated ${pretty(newest)}, more than ${env.RECENT_PAY_DAYS} days before the application date (${pretty(appDate)}). Income is checked against recent pay (demo setting: ${env.RECENT_PAY_DAYS} days).`
      : `Earnings are reported but no paystub is on file. Income is checked against recent pay (demo setting: ${env.RECENT_PAY_DAYS} days).`;
    const r = await db.query(
      `INSERT INTO open_question (id, case_id, kind, field, title, ask, why, fact_ids, channel)
       VALUES ($1,$2,'missing_document','recent_paystub',$3,$4,$5,$6,'document') ON CONFLICT (case_id, field, kind) DO NOTHING RETURNING *`,
      [qid, caseId, `${monthName(addDays(appDate, -Math.round(env.RECENT_PAY_DAYS / 2)))} paystub`, ask, why, payDates.map((f) => f.id)],
    );
    if (r.rows[0]) {
      const q = rowToQuestion(r.rows[0]);
      out.opened.push(q);
      await audit(db, { caseId, who: SYSTEM, kind: 'rules', action: 'question.opened', entity: 'open_question', entityId: q.id, data: { questionId: q.id, field: 'recent_paystub', kind: 'missing_document' } });
    }
  }

  /* ---- close ---- */
  for (const q of await listQuestions(db, caseId)) {
    if (q.status === 'closed') continue;
    if (q.kind === 'conflict') {
      const answers = facts.filter((f) => f.questionId === q.id);
      const answer = answers[answers.length - 1];
      if (!answer) continue;
      const docValues = new Set(ev.filter((f) => f.field === q.field && f.sourceKind === 'document').map((f) => f.normalized));
      const label = valueLabel(q.field, answer.normalized, answer.value);
      if (docValues.has(answer.normalized)) {
        const cand = q.candidates.find((c) => c.value === answer.normalized);
        const note = `closed: ${label}${cand?.incomeMonthly != null && q.field === 'pay_frequency' ? `, so ${money(cand.incomeMonthly)} a month` : ''}`;
        const r = await db.query(
          `UPDATE open_question SET status='closed', resolved_value=$2, resolution_fact_id=$3, closed_note=$4, closed_at=now() WHERE id=$1 AND status <> 'closed' RETURNING *`,
          [q.id, answer.normalized, answer.id, note],
        );
        if (r.rows[0]) {
          out.closed.push(rowToQuestion(r.rows[0]));
          await audit(db, { caseId, who: SYSTEM, kind: 'rules', action: 'question.closed', entity: 'open_question', entityId: q.id, data: { questionId: q.id, field: q.field, value: answer.normalized, note, factId: answer.id } });
        }
      } else if (q.status === 'open') {
        const note = `Answer "${answer.value}" does not match the documents (${[...docValues].join(', ') || 'none'}). Caseworker to weigh it.`;
        const r = await db.query(`UPDATE open_question SET status='answered', resolution_fact_id=$2, closed_note=$3 WHERE id=$1 AND status='open' RETURNING *`, [q.id, answer.id, note]);
        if (r.rows[0]) {
          out.answered.push(rowToQuestion(r.rows[0]));
          await audit(db, { caseId, who: SYSTEM, kind: 'rules', action: 'question.answered', entity: 'open_question', entityId: q.id, data: { questionId: q.id, field: q.field, value: answer.normalized } });
        }
      }
    } else if (q.kind === 'missing_document' && q.field === 'recent_paystub') {
      const hit = facts.filter((f) => f.field === 'pay_date' && f.sourceKind === 'document' && /^\d{4}-\d{2}-\d{2}$/.test(f.normalized) && f.normalized >= windowStart && f.normalized <= appDate).pop();
      if (!hit) continue;
      const stubRef = hit.sourceRef;
      const gross = facts.find((f) => f.sourceRef === stubRef && f.field === 'gross_pay_amount');
      const freq = facts.find((f) => f.sourceRef === stubRef && f.field === 'pay_frequency');
      const note = `closed: ${hit.sourceLabel}${gross ? `, gross $${Number(gross.normalized).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}${freq ? ` ${valueLabel('pay_frequency', freq.normalized, freq.value)}` : ''}`;
      const r = await db.query(
        `UPDATE open_question SET status='closed', resolved_value=$2, resolution_fact_id=$3, closed_note=$4, closed_at=now() WHERE id=$1 AND status <> 'closed' RETURNING *`,
        [q.id, hit.normalized, hit.id, note],
      );
      if (r.rows[0]) {
        out.closed.push(rowToQuestion(r.rows[0]));
        await audit(db, { caseId, who: SYSTEM, kind: 'rules', action: 'question.closed', entity: 'open_question', entityId: q.id, data: { questionId: q.id, field: q.field, value: hit.normalized, note, factId: hit.id } });
      }
    }
  }
  return out;
}
