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

export function capitalizeNoiAtCapRatePct(
  netOperatingIncome: number,
  capRatePct: number | null | undefined
): number | null {
  if (!Number.isFinite(netOperatingIncome) || netOperatingIncome <= 0) return null;
  if (capRatePct == null || !Number.isFinite(capRatePct) || capRatePct <= 0) return null;
  return netOperatingIncome / (capRatePct / 100);
}

export function capRatePctToDecimal(capRatePct: number | null | undefined): number | null {
  if (capRatePct == null || !Number.isFinite(capRatePct) || capRatePct <= 0) return null;
  return capRatePct / 100;
}

export function capRateDecimalToPct(
  capRateDecimal: number | null | undefined,
  fractionDigits = 2
): number | null {
  if (capRateDecimal == null || !Number.isFinite(capRateDecimal) || capRateDecimal <= 0) {
    return null;
  }
  return Number((capRateDecimal * 100).toFixed(fractionDigits));
}

export function formatCapitalizationRatePct(
  capRatePct: number | null | undefined,
  fractionDigits = 2,
  fallback = '—'
): string {
  if (capRatePct == null || !Number.isFinite(capRatePct)) return fallback;
  return `${capRatePct.toFixed(fractionDigits)}%`;
}

export function formatCapitalizationRateDecimal(
  capRateDecimal: number | null | undefined,
  fractionDigits = 2,
  fallback = '—'
): string {
  const pct = capRateDecimalToPct(capRateDecimal, fractionDigits);
  return pct == null ? fallback : formatCapitalizationRatePct(pct, fractionDigits, fallback);
}

export function normalizeCapitalizationRatePct(
  capRate: number | null | undefined,
  fractionDigits = 2
): number | null {
  if (capRate == null || !Number.isFinite(capRate) || capRate <= 0) return null;
  const pct = capRate > 1 ? capRate : capRateDecimalToPct(capRate, fractionDigits);
  return pct == null ? null : Number(pct.toFixed(fractionDigits));
}

export function formatCapitalizationRate(
  capRate: number | null | undefined,
  fractionDigits = 2,
  fallback = '—'
): string {
  const pct = normalizeCapitalizationRatePct(capRate, fractionDigits);
  return pct == null ? fallback : formatCapitalizationRatePct(pct, fractionDigits, fallback);
}

export function isCapitalizationRatePctManuallyAdjusted(
  enteredCapRatePct: number | null | undefined,
  automaticCapRatePct: number | null | undefined,
  tolerancePct = 0.04
): boolean {
  if (enteredCapRatePct == null || !Number.isFinite(enteredCapRatePct)) return false;
  if (automaticCapRatePct == null || !Number.isFinite(automaticCapRatePct)) return true;
  return Math.abs(enteredCapRatePct - automaticCapRatePct) > tolerancePct;
}
