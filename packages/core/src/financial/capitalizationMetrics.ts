function finitePositive(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizeCapitalizationRate(value: unknown): number | null {
  const rate = finitePositive(value);
  if (rate == null) return null;
  if (rate > 1 && rate <= 100) return rate / 100;
  return rate <= 1 ? rate : null;
}

export function computeCapitalizationRateFromNoi(
  noi: unknown,
  price: unknown
): number | null {
  const safeNoi = finitePositive(noi);
  const safePrice = finitePositive(price);
  if (safeNoi == null || safePrice == null) return null;
  return safeNoi / safePrice;
}

export function computeCapitalizedValueFromNoi(
  noi: unknown,
  capitalizationRate: unknown
): number | null {
  const safeNoi = finitePositive(noi);
  const safeRate = normalizeCapitalizationRate(capitalizationRate);
  if (safeNoi == null || safeRate == null) return null;
  return safeNoi / safeRate;
}
