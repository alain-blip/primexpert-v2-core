function finitePositive(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

export function normalizeTgaPct(value: unknown): number | null {
  const n = finitePositive(value);
  if (n == null) return null;
  return n > 1 ? n : n * 100;
}

export function tgaPctToRate(value: unknown): number | null {
  const pct = normalizeTgaPct(value);
  return pct == null ? null : pct / 100;
}

export function applyTgaAdjustmentPct(
  baseTgaPct: unknown,
  adjustmentPct: unknown = 0,
  decimals = 2
): number | null {
  const base = normalizeTgaPct(baseTgaPct);
  if (base == null) return null;
  const adjustment = typeof adjustmentPct === 'number' && Number.isFinite(adjustmentPct)
    ? adjustmentPct
    : 0;
  return roundTo(base + adjustment, decimals);
}

export function computeCapRatePctFromRneAndPrice(input: {
  rne: unknown;
  price: unknown;
  decimals?: number;
}): number | null {
  const rne = finitePositive(input.rne);
  const price = finitePositive(input.price);
  if (rne == null || price == null) return null;
  return roundTo((rne / price) * 100, input.decimals ?? 2);
}

export function computeRneFromPriceAndTgaPct(input: {
  price: unknown;
  tgaPct: unknown;
  decimals?: number;
}): number | null {
  const price = finitePositive(input.price);
  const tgaRate = tgaPctToRate(input.tgaPct);
  if (price == null || tgaRate == null) return null;
  return roundTo(price * tgaRate, input.decimals ?? 2);
}

export function computeCapitalizedValueFromRneAndTgaPct(input: {
  rne: unknown;
  tgaPct: unknown;
  round?: boolean;
  decimals?: number;
}): number | null {
  const rne = finitePositive(input.rne);
  const tgaRate = tgaPctToRate(input.tgaPct);
  if (rne == null || tgaRate == null) return null;
  const value = rne / tgaRate;
  return input.round ? Math.round(value) : roundTo(value, input.decimals ?? 2);
}
