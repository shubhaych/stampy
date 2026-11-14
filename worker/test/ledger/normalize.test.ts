import { describe, expect, it } from 'vitest';
import { normalizeDate, normalizeField, normalizeFrequency, normalizeMoney, normalizeNames } from '../../src/ledger/normalize';
import { monthlyIncome } from '../../src/rules/benefit';

describe('normalizeFrequency', () => {
  it.each([
    ['Biweekly', 'biweekly'], ['bi-weekly', 'biweekly'], ['Every two weeks', 'biweekly'], ['every other Friday', 'biweekly'],
    ['Oh, every two weeks. Every other Friday.', 'biweekly'], ['Monthly', 'monthly'], ['[X] Monthly', 'monthly'], ['once a month', 'monthly'],
    ['Weekly', 'weekly'], ['twice a month', 'semimonthly'], ['semi-monthly', 'semimonthly'],
  ])('%s → %s', (raw, want) => expect(normalizeFrequency(raw)).toBe(want));
  it('returns null when unsure', () => expect(normalizeFrequency('I am not sure')).toBeNull());
});

describe('money, dates, names', () => {
  it('money', () => {
    expect(normalizeMoney('$1,240.00')).toBe('1240.00');
    expect(normalizeMoney('950')).toBe('950.00');
  });
  it('dates', () => {
    expect(normalizeDate('09/25/2026')).toBe('2026-09-25');
    expect(normalizeDate('2026-10-23')).toBe('2026-10-23');
    expect(normalizeDate('11/2/26')).toBe('2026-11-02');
  });
  it('names compare regardless of order and separators', () => {
    expect(normalizeNames('Lena Torres; Maya Torres; Leo Torres')).toBe(normalizeNames('Lena Torres, Maya Torres, Leo Torres'));
  });
  it('field dispatch', () => {
    expect(normalizeField('pay_frequency', 'Every two weeks')).toBe('biweekly');
    expect(normalizeField('gross_pay_amount', '$1,240.00')).toBe('1240.00');
    expect(normalizeField('state', 'ca')).toBe('CA');
  });
});

describe('monthly income uses the SNAP conversion factors', () => {
  it('biweekly × 2.15', () => expect(monthlyIncome(1240, 'biweekly')).toBe(2666));
  it('weekly × 4.3', () => expect(monthlyIncome(500, 'weekly')).toBe(2150));
  it('monthly × 1', () => expect(monthlyIncome(1240, 'monthly')).toBe(1240));
});
