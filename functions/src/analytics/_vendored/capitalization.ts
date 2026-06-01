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

export function normalizeCapRateDecimal(capRate: number | null | undefined): number | null {
  if (capRate == null || !Number.isFinite(capRate) || capRate <= 0) return null;
  return capRate > 1 ? capRate / 100 : capRate;
}

export function normalizeCapRatePct(capRate: number | null | undefined): number | null {
  if (capRate == null || !Number.isFinite(capRate) || capRate <= 0) return null;
  return capRate > 1 ? capRate : capRate * 100;
}

export function roundCapRatePct(capRatePct: number | null | undefined, fractionDigits = 2): number | null {
  if (capRatePct == null || !Number.isFinite(capRatePct)) return null;
  return Number(capRatePct.toFixed(fractionDigits));
}

export function addCapRatePctAdjustments(
  baseCapRatePct: number | null | undefined,
  ...adjustmentsPct: Array<number | null | undefined>
): number | null {
  const base = normalizeCapRatePct(baseCapRatePct);
  if (base == null) return null;
  let adjusted = base;
  for (const adjustment of adjustmentsPct) {
    if (typeof adjustment === 'number' && Number.isFinite(adjustment)) {
      adjusted += adjustment;
    }
  }
  return adjusted > 0 ? adjusted : null;
}

export function hasCapRatePctMaterialDelta(
  valuePct: number | null | undefined,
  referencePct: number | null | undefined,
  tolerancePct = 0.04
): boolean {
  const value = normalizeCapRatePct(valuePct);
  const reference = normalizeCapRatePct(referencePct);
  if (value == null || reference == null) return false;
  return Math.abs(value - reference) > tolerancePct;
}

export function capitalizeNoiAtCapRatePct(
  netOperatingIncome: number,
  capRatePct: number | null | undefined
): number | null {
  if (!Number.isFinite(netOperatingIncome) || netOperatingIncome <= 0) return null;
  if (capRatePct == null || !Number.isFinite(capRatePct) || capRatePct <= 0) return null;
  return netOperatingIncome / (capRatePct / 100);
}

export function computeNoiVariancePct(
  firstNoi: number | null | undefined,
  secondNoi: number | null | undefined
): number | null {
  if (firstNoi == null || secondNoi == null) return null;
  if (!Number.isFinite(firstNoi) || !Number.isFinite(secondNoi)) return null;
  if (firstNoi <= 0 || secondNoi <= 0) return null;
  return (Math.abs(firstNoi - secondNoi) / Math.max(firstNoi, secondNoi)) * 100;
}
