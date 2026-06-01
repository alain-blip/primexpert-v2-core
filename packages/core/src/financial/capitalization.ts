/**
 * Capitalisation financière centralisée — RNE / TGA.
 *
 * Toute conversion RNE ↔ valeur ↔ taux passe par ce module afin d'éviter les
 * formules divergentes dans les écrans, rendus HTML/PDF et moteurs marché.
 */

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export const DEFAULT_RPA_CAPITALIZATION_RATE_PCT = 8.5;
export const DEFAULT_RPA_CAPITALIZATION_RATE_DECIMAL = 0.085;

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

export function capitalizationRateDecimalToPct(
  capRateDecimal: number | null | undefined,
  fractionDigits = 2
): number | null {
  if (capRateDecimal == null || !Number.isFinite(capRateDecimal) || capRateDecimal <= 0) {
    return null;
  }
  return Number((capRateDecimal * 100).toFixed(fractionDigits));
}

export function capitalizationRatePctToDecimal(
  capRatePct: number | null | undefined,
  fractionDigits = 4
): number | null {
  if (capRatePct == null || !Number.isFinite(capRatePct) || capRatePct <= 0) return null;
  return Number((capRatePct / 100).toFixed(fractionDigits));
}

export function normalizeCapitalizationRatePct(
  capRate: number | null | undefined,
  fractionDigits = 2
): number | null {
  if (capRate == null || !Number.isFinite(capRate) || capRate <= 0) return null;
  const pct = capRate > 1 ? capRate : capRate * 100;
  return Number(pct.toFixed(fractionDigits));
}

export function applyCapitalizationRateAdjustmentPct(
  baseCapRatePct: number | null | undefined,
  adjustmentPct: number | null | undefined = 0,
  fractionDigits = 2
): number | null {
  if (baseCapRatePct == null || !Number.isFinite(baseCapRatePct) || baseCapRatePct <= 0) {
    return null;
  }
  const adjustment = adjustmentPct != null && Number.isFinite(adjustmentPct) ? adjustmentPct : 0;
  const adjusted = baseCapRatePct + adjustment;
  return adjusted > 0 ? Number(adjusted.toFixed(fractionDigits)) : null;
}

export function isCapitalizationRateManualOverride(
  inputCapRatePct: number | null | undefined,
  automaticCapRatePct: number | null | undefined,
  tolerancePct = 0.04
): boolean {
  if (inputCapRatePct == null || !Number.isFinite(inputCapRatePct)) return true;
  if (automaticCapRatePct == null || !Number.isFinite(automaticCapRatePct)) return true;
  return Math.abs(inputCapRatePct - automaticCapRatePct) > tolerancePct;
}

export function computeNetOperatingIncomeVarianceRatio(
  firstNoi: number | null | undefined,
  secondNoi: number | null | undefined
): number | null {
  if (firstNoi == null || !Number.isFinite(firstNoi) || firstNoi <= 0) return null;
  if (secondNoi == null || !Number.isFinite(secondNoi) || secondNoi <= 0) return null;
  return Math.abs(firstNoi - secondNoi) / Math.max(firstNoi, secondNoi);
}

export function formatNetOperatingIncomeVariancePct(
  varianceRatio: number | null | undefined,
  fractionDigits = 1
): string | null {
  if (varianceRatio == null || !Number.isFinite(varianceRatio) || varianceRatio < 0) {
    return null;
  }
  return (varianceRatio * 100).toFixed(fractionDigits);
}

export function capitalizeNoiAtCapRatePct(
  netOperatingIncome: number,
  capRatePct: number | null | undefined
): number | null {
  if (!Number.isFinite(netOperatingIncome) || netOperatingIncome <= 0) return null;
  if (capRatePct == null || !Number.isFinite(capRatePct) || capRatePct <= 0) return null;
  return netOperatingIncome / (capRatePct / 100);
}

export function resolveNetOperatingIncomeFromValueAndCapRatePct(
  marketValue: number | null | undefined,
  capRatePct: number | null | undefined
): number | null {
  if (marketValue == null || !Number.isFinite(marketValue) || marketValue <= 0) return null;
  const capRateDecimal = capitalizationRatePctToDecimal(capRatePct);
  if (capRateDecimal == null) return null;
  return marketValue * capRateDecimal;
}
