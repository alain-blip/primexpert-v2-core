function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export interface NetOperatingIncomeInput {
  effectiveGrossIncome: number;
  totalOperatingExpenses: number;
}

export function resolveNetOperatingIncome(input: NetOperatingIncomeInput): number | null {
  const { effectiveGrossIncome, totalOperatingExpenses } = input;
  if (!finitePositive(effectiveGrossIncome) || !Number.isFinite(totalOperatingExpenses) || totalOperatingExpenses < 0) {
    return null;
  }

  return Math.max(0, effectiveGrossIncome - totalOperatingExpenses);
}

export function capRatePctToDecimal(capRatePct: number): number | null {
  if (!finitePositive(capRatePct)) return null;
  return capRatePct / 100;
}

export function capRateDecimalToPct(capRateDecimal: number): number | null {
  if (!finitePositive(capRateDecimal)) return null;
  return capRateDecimal * 100;
}

export function computeCapitalizationRateDecimal(netOperatingIncome: number, marketValue: number): number | null {
  if (!finitePositive(netOperatingIncome) || !finitePositive(marketValue)) return null;
  return netOperatingIncome / marketValue;
}

export function computeCapitalizationRatePct(netOperatingIncome: number, marketValue: number): number | null {
  const decimal = computeCapitalizationRateDecimal(netOperatingIncome, marketValue);
  return decimal == null ? null : decimal * 100;
}

export function capitalizeNoiAtCapRateDecimal(netOperatingIncome: number, capRateDecimal: number): number | null {
  if (!finitePositive(netOperatingIncome) || !finitePositive(capRateDecimal)) return null;
  return netOperatingIncome / capRateDecimal;
}

export function capitalizeNoiAtCapRatePct(netOperatingIncome: number, capRatePct: number): number | null {
  const decimal = capRatePctToDecimal(capRatePct);
  return decimal == null ? null : capitalizeNoiAtCapRateDecimal(netOperatingIncome, decimal);
}
