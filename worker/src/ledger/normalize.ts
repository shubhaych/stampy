/**
 * Deterministic normalization so facts from different sources compare cleanly.
 * "Every two weeks", "bi-weekly", "Biweekly" → biweekly; "$1,240.00" → 1240.00; "11/02/2026" → 2026-11-02.
 */
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export function normalizeFrequency(raw: string): PayFrequency | null {
  const s = raw.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (/\b(bi ?weekly|every (two|2|other) weeks?|fortnightly|every other (week|friday|thursday|monday|tuesday|wednesday))\b/.test(s)) return 'biweekly';
  if (/\b(semi ?monthly|twice (a|per|each) month|two times a month|1st and 15th)\b/.test(s)) return 'semimonthly';
  if (/\b(weekly|every week|each week|once a week)\b/.test(s)) return 'weekly';
  if (/\b(monthly|every month|once a month|each month|per month)\b/.test(s)) return 'monthly';
  return null;
}

export function normalizeMoney(raw: string): string | null {
  const m = raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  return Number(m[0]).toFixed(2);
}

export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${y}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

export function normalizeNames(raw: string): string {
  return raw
    .split(/[;,\n]|\band\b/i)
    .map((x) => x.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean)
    .sort()
    .join('; ');
}

const MONEY_FIELDS = new Set(['gross_pay_amount', 'monthly_rent']);
const DATE_FIELDS = new Set(['application_date', 'pay_date', 'pay_period_start', 'pay_period_end']);
const NAME_FIELDS = new Set(['household_members', 'tenant_names']);

/** Normalized form for any ledger field; falls back to trimmed lowercase text. */
export function normalizeField(field: string, raw: string): string {
  const v = raw.trim();
  if (field === 'pay_frequency') return normalizeFrequency(v) ?? v.toLowerCase();
  if (MONEY_FIELDS.has(field)) return normalizeMoney(v) ?? v.toLowerCase();
  if (DATE_FIELDS.has(field)) return normalizeDate(v) ?? v.toLowerCase();
  if (NAME_FIELDS.has(field)) return normalizeNames(v);
  if (field === 'household_size') return String(parseInt(v, 10) || v);
  if (field === 'state') return v.toUpperCase().slice(0, 2);
  return v.toLowerCase().replace(/\s+/g, ' ');
}

export const FREQUENCY_LABEL: Record<PayFrequency, string> = {
  weekly: 'weekly', biweekly: 'every two weeks', semimonthly: 'twice a month', monthly: 'monthly',
};
