/**
 * Currency and financial math utilities for Fatani Traders.
 * Standard base currency is Pakistani Rupee (PKR).
 */

export function roundMoney(amount: number): number {
  if (isNaN(amount)) return 0;
  // Standard half-up rounding to 2 decimal places
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatPKR(amount: number, showSymbol: boolean = true): string {
  const rounded = roundMoney(amount);
  const formatted = rounded.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return showSymbol ? `PKR ${formatted}` : formatted;
}

export function calculateLineTotal(grams: number, ratePerKg: number): number {
  if (!grams || !ratePerKg || grams < 0 || ratePerKg < 0) return 0;
  const kg = grams / 1000;
  return roundMoney(kg * ratePerKg);
}

export function calculateDiscountedTotal(subtotal: number, discount: number = 0): number {
  const safeSubtotal = Math.max(0, subtotal || 0);
  const safeDiscount = Math.max(0, discount || 0);
  return roundMoney(Math.max(0, safeSubtotal - safeDiscount));
}
