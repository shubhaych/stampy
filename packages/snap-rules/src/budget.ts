import type { CaseBudget, HouseholdMember } from '@stampy/contracts';
import { deductions, type DeductionBreakdown } from './deductions';

export interface BudgetResult {
  grossMonthly: number;
  deductions: DeductionBreakdown;
  netMonthly: number | null;
  allotmentMonthly: number | null;
  /** 'stub' until the rules feature loads every FY2027 parameter. */
  completeness: 'stub' | 'complete';
}

/** STUB (rules feature, machine B): deterministic benefit computation. Never decides eligibility. */
export function computeBudget(budget: CaseBudget, members: HouseholdMember[]): BudgetResult {
  const grossMonthly = budget.earnedIncomeMonthly + budget.unearnedIncomeMonthly;
  return { grossMonthly, deductions: deductions(budget, members), netMonthly: null, allotmentMonthly: null, completeness: 'stub' };
}

export interface Delta { before: number; after: number; delta: number; direction: 'over' | 'under' | 'none'; aboveTolerance: boolean }

/**
 * Direction of a payment risk from an income comparison.
 * More countable income than budgeted means the case risks overissuance; less means underissuance.
 */
export function incomeDelta(budgeted: number, recomputed: number, tolerance: number): Delta {
  const delta = Math.round((recomputed - budgeted) * 100) / 100;
  const direction = delta > 0 ? 'over' : delta < 0 ? 'under' : 'none';
  return { before: budgeted, after: recomputed, delta, direction, aboveTolerance: Math.abs(delta) > tolerance };
}
