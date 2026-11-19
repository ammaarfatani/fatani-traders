import { describe, it, expect } from 'vitest';
import {
  kgAndGramsToGrams,
  gramsToKg,
  gramsToKgAndGrams,
  formatWeight,
  formatWeightDetailed,
  calculateLandedCost,
  recalculateLotCostWithAdjustment,
  roundMoney,
  calculateLineTotal,
  calculateDiscountedTotal,
  formatPKR,
} from '@fatani/shared';

describe('Weight & Grams Precision Logic', () => {
  it('converts KG and grams to exact integer grams', () => {
    expect(kgAndGramsToGrams(2000, 0)).toBe(2000000);
    expect(kgAndGramsToGrams(12, 450)).toBe(12450);
    expect(kgAndGramsToGrams(0, 750)).toBe(750);
  });

  it('converts grams back to decimal KG accurately', () => {
    expect(gramsToKg(2000000)).toBe(2000);
    expect(gramsToKg(12450)).toBe(12.45);
    expect(gramsToKg(750)).toBe(0.75);
  });

  it('decomposes grams to KG and remaining grams', () => {
    expect(gramsToKgAndGrams(12450)).toEqual({ kg: 12, grams: 450 });
    expect(gramsToKgAndGrams(5000)).toEqual({ kg: 5, grams: 0 });
  });

  it('formats weight with exact unit notation', () => {
    expect(formatWeight(2000000)).toBe('2,000.000 KG');
    expect(formatWeight(12450)).toBe('12.450 KG');
    expect(formatWeightDetailed(12450)).toBe('12 KG 450 g');
    expect(formatWeightDetailed(5000)).toBe('5 KG');
  });
});

describe('Monetary Precision & Landed Cost Calculations', () => {
  it('performs half-up monetary rounding without floating drift', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10.00);
    expect(formatPKR(125000.5)).toBe('PKR 125,000.50');
  });

  it('calculates line item total based on weight and rate per KG', () => {
    // 500 KG (500,000 grams) @ PKR 160/KG = PKR 80,000
    expect(calculateLineTotal(500000, 160)).toBe(80000);

    // 12.5 KG (12,500 grams) @ PKR 325.50/KG = 4068.75
    expect(calculateLineTotal(12500, 325.5)).toBe(4068.75);
  });

  it('calculates discounted total', () => {
    expect(calculateDiscountedTotal(100000, 5000)).toBe(95000);
    expect(calculateDiscountedTotal(50000, 0)).toBe(50000);
    expect(calculateDiscountedTotal(50000, 60000)).toBe(0); // cannot be negative
  });

  it('calculates Landed Cost accurately matching prompt example', () => {
    // Purchased Weight: 2,000 KG
    // Purchase Rate: PKR 120/KG
    // Base Purchase Cost: PKR 240,000
    // Transport: PKR 5,000
    // Unloading Labor: PKR 3,000
    // Folding: PKR 2,000
    // Total Additional Expenses: PKR 10,000
    // Total Landed Cost: PKR 250,000
    // Actual Cost per KG: PKR 125

    const weightGrams = kgAndGramsToGrams(2000, 0);
    const ratePerKg = 120;
    const expenses = [
      { category: 'Transport', amount: 5000, isCapitalized: true },
      { category: 'Unloading Labor', amount: 3000, isCapitalized: true },
      { category: 'Folding', amount: 2000, isCapitalized: true },
    ];

    const result = calculateLandedCost(weightGrams, ratePerKg, expenses);

    expect(result.purchasedKg).toBe(2000);
    expect(result.basePurchaseCost).toBe(240000);
    expect(result.totalAdditionalExpenses).toBe(10000);
    expect(result.totalLandedCost).toBe(250000);
    expect(result.actualCostPerKg).toBe(125);
  });

  it('recalculates landed cost when post-purchase expense is added', () => {
    // Initial: 2000 KG, landed cost PKR 250,000 (PKR 125/KG)
    // Additional packaging bill of PKR 6,000 arrives later
    // New total landed cost: PKR 256,000
    // New cost per KG: 256,000 / 2,000 = PKR 128/KG
    const initialGrams = 2000000;
    const currentTotalLandedCost = 250000;
    const additionalExpense = 6000;

    const recalc = recalculateLotCostWithAdjustment(
      initialGrams,
      currentTotalLandedCost,
      additionalExpense
    );

    expect(recalc.newTotalLandedCost).toBe(256000);
    expect(recalc.newCostPerKg).toBe(128);
  });

  it('ignores non-capitalized operating expenses in lot landed cost', () => {
    const weightGrams = kgAndGramsToGrams(1000, 0);
    const ratePerKg = 200;
    const expenses = [
      { category: 'Transport', amount: 4000, isCapitalized: true },
      { category: 'Staff Chai', amount: 500, isCapitalized: false }, // Operating, should not capitalize
    ];

    const result = calculateLandedCost(weightGrams, ratePerKg, expenses);
    expect(result.basePurchaseCost).toBe(200000);
    expect(result.totalAdditionalExpenses).toBe(4000);
    expect(result.totalLandedCost).toBe(204000);
    expect(result.actualCostPerKg).toBe(204);
  });
});
