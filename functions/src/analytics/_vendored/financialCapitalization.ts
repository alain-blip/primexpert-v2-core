/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/financial/capitalization.ts
 * Régénéré : functions/scripts/sync-core-analytics-flywheel.cjs (prebuild)
 */
function finitePositive(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function finiteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

function maybeRound(value: number, options?: { round?: boolean; decimals?: number }): number {
  if (options?.round) return Math.round(value);
  return roundTo(value, options?.decimals ?? 2);
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

export function computeCapRateRatioFromRneAndPrice(input: {
  rne: unknown;
  price: unknown;
  decimals?: number;
}): number | null {
  const pct = computeCapRatePctFromRneAndPrice(input);
  return tgaPctToRate(pct);
}

export function resolveRneFromRevenueAndExpenses(input: {
  netOperatingIncome?: unknown;
  revenuBrutEffectif?: unknown;
  depensesExploitation?: unknown;
  round?: boolean;
  decimals?: number;
}): number | null {
  const directNoi = finitePositive(input.netOperatingIncome);
  if (directNoi != null) {
    return maybeRound(directNoi, input);
  }

  const rbe = finitePositive(input.revenuBrutEffectif);
  const expenses = finiteNumber(input.depensesExploitation);
  if (rbe == null || expenses == null) return null;

  const rne = rbe - expenses;
  return rne > 0 ? maybeRound(rne, input) : null;
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
  return maybeRound(value, input);
}
