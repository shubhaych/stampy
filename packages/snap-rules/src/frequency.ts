import type { PayFrequency } from '@cleancase/contracts';

/** Monthly conversion factors from master prompt section 10, station 5 (cite 7 CFR 273.10(c), verify). */
export const FREQUENCY_FACTOR: Record<PayFrequency, number> = {
  weekly: 4.3,
  biweekly: 2.15,
  semimonthly: 2,
  monthly: 1,
};

/** Convert a per-period gross to monthly, rounded to cents. */
export function toMonthly(perPeriod: number, frequency: PayFrequency): number {
  return Math.round(perPeriod * FREQUENCY_FACTOR[frequency] * 100) / 100;
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function conversionArithmetic(perPeriod: number, frequency: PayFrequency): string {
  return `${money(perPeriod)} × ${FREQUENCY_FACTOR[frequency]} = ${money(toMonthly(perPeriod, frequency))}`;
}
