function finitePositiveNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function computeCapitalizationRateDecimal(
  revenuNetExploitation: unknown,
  price: unknown
): number | null {
  const noi = finitePositiveNumber(revenuNetExploitation);
  const denominator = finitePositiveNumber(price);
  if (noi == null || denominator == null) return null;
  return noi / denominator;
}

export function computeCapitalizationRatePct(
  revenuNetExploitation: unknown,
  price: unknown
): number | null {
  const decimal = computeCapitalizationRateDecimal(revenuNetExploitation, price);
  return decimal == null ? null : decimal * 100;
}

export function capitalizeNoiAtCapRateDecimal(
  revenuNetExploitation: unknown,
  capRateDecimal: unknown
): number | null {
  const noi = finitePositiveNumber(revenuNetExploitation);
  const rate = finitePositiveNumber(capRateDecimal);
  if (noi == null || rate == null) return null;
  return noi / rate;
}

export function capitalizeNoiAtCapRatePct(
  revenuNetExploitation: unknown,
  capRatePct: unknown
): number | null {
  const pct = finitePositiveNumber(capRatePct);
  if (pct == null) return null;
  return capitalizeNoiAtCapRateDecimal(revenuNetExploitation, pct / 100);
}
