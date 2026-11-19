/**
 * Weight utility functions for textile trading.
 * 1 KG = 1000 grams.
 * All internal weights are stored as integer grams to prevent floating-point drift.
 */

export function kgAndGramsToGrams(kg: number, grams: number = 0): number {
  const safeKg = Math.max(0, Math.floor(kg || 0));
  const safeGrams = Math.max(0, Math.round(grams || 0));
  return safeKg * 1000 + safeGrams;
}

export function decimalKgToGrams(kgDecimal: number): number {
  if (isNaN(kgDecimal) || kgDecimal < 0) return 0;
  return Math.round(kgDecimal * 1000);
}

export const kgToGrams = decimalKgToGrams;

export function gramsToKg(totalGrams: number): number {
  if (!totalGrams || isNaN(totalGrams)) return 0;
  return totalGrams / 1000;
}

export function gramsToKgAndGrams(totalGrams: number): { kg: number; grams: number } {
  const safe = Math.max(0, Math.round(totalGrams || 0));
  const kg = Math.floor(safe / 1000);
  const grams = safe % 1000;
  return { kg, grams };
}

export function formatWeight(totalGrams: number, includeUnit: boolean = true): string {
  const kg = gramsToKg(totalGrams);
  const formatted = kg.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return includeUnit ? `${formatted} KG` : formatted;
}

export function formatWeightDetailed(totalGrams: number): string {
  const { kg, grams } = gramsToKgAndGrams(totalGrams);
  if (grams === 0) {
    return `${kg.toLocaleString()} KG`;
  }
  return `${kg.toLocaleString()} KG ${grams} g`;
}
