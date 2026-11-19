import { roundMoney } from './currency';
import { gramsToKg } from './weight';

export interface LotExpenseInput {
  amount: number;
  isCapitalized?: boolean; // default true for lot expenses
  category?: string;
  customName?: string;
}

export interface LandedCostResult {
  purchasedGrams: number;
  purchasedKg: number;
  purchaseRatePerKg: number;
  basePurchaseCost: number;
  totalAdditionalExpenses: number;
  totalLandedCost: number;
  actualCostPerKg: number;
}

/**
 * Calculates landed cost for a fabric purchase lot.
 * Base Purchase Cost = Purchased Weight in KG * Purchase Rate per KG
 * Total Landed Cost = Base Purchase Cost + Sum(Capitalizable Lot Expenses)
 * Actual Cost per KG = Total Landed Cost / Purchased Weight in KG
 *
 * Expense payment status (paid or unpaid) does NOT affect inventory landed cost.
 */
export function calculateLandedCost(
  purchasedGrams: number,
  purchaseRatePerKg: number,
  expenses: LotExpenseInput[] = []
): LandedCostResult {
  const purchasedKg = gramsToKg(purchasedGrams);
  const safeRate = Math.max(0, purchaseRatePerKg || 0);

  const basePurchaseCost = roundMoney(purchasedKg * safeRate);

  const totalAdditionalExpenses = expenses.reduce((sum, exp) => {
    // Only capitalize expenses flagged as capitalized (defaults to true)
    const isCap = exp.isCapitalized !== false;
    if (isCap && exp.amount > 0) {
      return roundMoney(sum + exp.amount);
    }
    return sum;
  }, 0);

  const totalLandedCost = roundMoney(basePurchaseCost + totalAdditionalExpenses);

  const actualCostPerKg =
    purchasedKg > 0 ? roundMoney(totalLandedCost / purchasedKg) : 0;

  return {
    purchasedGrams,
    purchasedKg,
    purchaseRatePerKg: safeRate,
    basePurchaseCost,
    totalAdditionalExpenses,
    totalLandedCost,
    actualCostPerKg,
  };
}

/**
 * Recalculates lot landed cost when a post-purchase expense is recorded.
 */
export function recalculateLotCostWithAdjustment(
  purchasedGrams: number,
  currentTotalLandedCost: number,
  additionalAdjustmentAmount: number
): { newTotalLandedCost: number; newCostPerKg: number } {
  const purchasedKg = gramsToKg(purchasedGrams);
  const newTotalLandedCost = roundMoney(currentTotalLandedCost + additionalAdjustmentAmount);
  const newCostPerKg = purchasedKg > 0 ? roundMoney(newTotalLandedCost / purchasedKg) : 0;
  return { newTotalLandedCost, newCostPerKg };
}
