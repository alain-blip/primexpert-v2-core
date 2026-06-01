/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/financial/capitalization.ts
 * Régénéré : functions/scripts/sync-core-analytics-flywheel.cjs (prebuild)
 */
/**
 * Capitalisation financière centralisée — RNE / TGA.
 *
 * Toute conversion RNE ↔ valeur ↔ taux passe par ce module afin d'éviter les
 * formules divergentes dans les écrans, rendus HTML/PDF et moteurs marché.
 */

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export interface NetOperatingIncomeInput {
  netOperatingIncome?: number | null;
  revenuBrutEffectif?: number | null;
  depensesExploitation?: number | null;
}

export function resolveNetOperatingIncome(
  input: NetOperatingIncomeInput,
  options?: { allowNonPositive?: boolean }
): number | null {
  const direct = finiteNumber(input.netOperatingIncome);
  if (direct != null && (direct > 0 || options?.allowNonPositive)) return direct;

  const rbe = finiteNumber(input.revenuBrutEffectif);
  const depenses = finiteNumber(input.depensesExploitation);
  if (rbe != null && rbe > 0 && depenses != null && depenses >= 0) {
    const rne = rbe - depenses;
    return Number.isFinite(rne) && (rne > 0 || options?.allowNonPositive) ? rne : null;
  }

  return null;
}

export function computeCapitalizationRateDecimal(
  netOperatingIncome: number,
  marketValue: number,
  fractionDigits = 4
): number | null {
  if (!Number.isFinite(netOperatingIncome) || netOperatingIncome <= 0) return null;
  if (!Number.isFinite(marketValue) || marketValue <= 0) return null;
  const multiplier = 10 ** fractionDigits;
  return Math.round((netOperatingIncome / marketValue) * multiplier) / multiplier;
}

export function computeCapitalizationRatePct(
  netOperatingIncome: number,
  marketValue: number,
  fractionDigits = 2
): number | null {
  const decimal = computeCapitalizationRateDecimal(netOperatingIncome, marketValue, fractionDigits + 2);
  if (decimal == null) return null;
  return Number((decimal * 100).toFixed(fractionDigits));
}

export function normalizeCapRateToDecimal(
  capRate: number | null | undefined,
  fallback: number | null = null
): number | null {
  const value = finiteNumber(capRate) ?? finiteNumber(fallback);
  if (value == null || value <= 0) return null;
  return value > 1 ? value / 100 : value;
}

export function normalizeCapRateToPct(
  capRate: number | null | undefined,
  fallback: number | null = null
): number | null {
  const decimal = normalizeCapRateToDecimal(capRate, fallback);
  if (decimal == null) return null;
  return decimal * 100;
}

export function applyCapRateAdjustmentPct(
  baseCapRatePct: number | null | undefined,
  adjustmentPct: number | null | undefined
): number | null {
  const base = finiteNumber(baseCapRatePct);
  if (base == null) return null;
  const adjustment = finiteNumber(adjustmentPct) ?? 0;
  return base + adjustment;
}

export function capitalizeNoiAtCapRatePct(
  netOperatingIncome: number,
  capRatePct: number | null | undefined
): number | null {
  if (!Number.isFinite(netOperatingIncome) || netOperatingIncome <= 0) return null;
  const capRateDecimal = normalizeCapRateToDecimal(capRatePct);
  if (capRateDecimal == null) return null;
  return netOperatingIncome / capRateDecimal;
}

export function resolveNoiFromValueAndCapRatePct(
  marketValue: number,
  capRatePct: number | null | undefined
): number | null {
  if (!Number.isFinite(marketValue) || marketValue <= 0) return null;
  const capRateDecimal = normalizeCapRateToDecimal(capRatePct);
  if (capRateDecimal == null) return null;
  return marketValue * capRateDecimal;
}

export function resolveOperatingExpensesFromRbeAndNoi(
  revenuBrutEffectif: number,
  netOperatingIncome: number | null | undefined
): number | null {
  if (!Number.isFinite(revenuBrutEffectif) || revenuBrutEffectif <= 0) return null;
  const rne = finiteNumber(netOperatingIncome);
  if (rne == null || rne < 0) return null;
  const expenses = revenuBrutEffectif - rne;
  return Number.isFinite(expenses) && expenses > 0 ? expenses : null;
}
