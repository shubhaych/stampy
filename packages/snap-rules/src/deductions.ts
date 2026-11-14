import type { CaseBudget, HouseholdMember } from '@cleancase/contracts';

export interface DeductionBreakdown {
  standard: number | null;
  earnedIncome: number;
  dependentCare: number;
  medical: number;
  childSupport: number;
  excessShelter: number | null;
  notes: string[];
}

/**
 * STUB (rules feature, machine B): full FY2027 deduction logic.
 * Returns what can be computed without unsourced parameters; null where a parameter is <fill in>.
 */
export function deductions(budget: CaseBudget, _members: HouseholdMember[], earnedRate = 0.2): DeductionBreakdown {
  return {
    standard: null,
    earnedIncome: Math.round(budget.earnedIncomeMonthly * earnedRate * 100) / 100,
    dependentCare: budget.dependentCareMonthly,
    medical: budget.medicalMonthly,
    childSupport: budget.childSupportMonthly,
    excessShelter: null,
    notes: ['stub: standard deduction, medical threshold and shelter cap not loaded'],
  };
}
