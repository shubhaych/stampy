import { describe, expect, it } from 'vitest';
import { GC1_BUNDLE, GC4_BUNDLE } from '@cleancase/contracts/fixtures';
import { STATIONS, toMonthly, conversionArithmetic, incomeDelta, evaluate, validOverride } from '../src/index';

describe('stations', () => {
  it('has ten stations with PG1..PG10', () => {
    expect(STATIONS.map((s) => s.gate.rule)).toEqual(['PG1', 'PG2', 'PG3', 'PG4', 'PG5', 'PG6', 'PG7', 'PG8', 'PG9', 'PG10']);
  });
});

describe('frequency', () => {
  it('converts GC-1: $1,240 biweekly = $2,666 / month', () => {
    expect(toMonthly(1240, 'biweekly')).toBe(2666);
    expect(conversionArithmetic(1240, 'biweekly')).toBe('$1,240.00 × 2.15 = $2,666.00');
  });
  it('weekly, semimonthly, monthly', () => {
    expect(toMonthly(100, 'weekly')).toBe(430);
    expect(toMonthly(100, 'semimonthly')).toBe(200);
    expect(toMonthly(100, 'monthly')).toBe(100);
  });
});

describe('direction', () => {
  it('more income than budgeted = overissuance risk', () => {
    expect(incomeDelta(1240, 2666, 59)).toMatchObject({ delta: 1426, direction: 'over', aboveTolerance: true });
  });
  it('less income than budgeted = underissuance risk', () => {
    expect(incomeDelta(2000, 1900, 59).direction).toBe('under');
  });
});

describe('gate', () => {
  it('GC-1 surfaces interview, open flag and open question', () => {
    const b = GC1_BUNDLE;
    const items = evaluate({ caseFile: b.case, steps: b.steps, flags: b.flags, questions: b.questions, runs: b.agentRuns });
    expect(items.map((i) => i.rule).sort()).toEqual(['PG3', 'PG5', 'PG8']);
  });
  it('GC-4 clean case has no gate items', () => {
    const b = GC4_BUNDLE;
    expect(evaluate({ caseFile: b.case, steps: b.steps, flags: b.flags, questions: b.questions, runs: b.agentRuns })).toEqual([]);
  });
  it('overrides need a typed reason', () => {
    expect(validOverride('')).toBe(false);
    expect(validOverride('Verified by phone with employer')).toBe(true);
  });
});
