import type { FinancialBaseData, FinancialCalc } from './normalizeFinancialData';
import { resolveCanonicalFinancialMetrics } from './resolveCanonicalRne';
import { safeNum } from './safeNumbers';

export interface ResolveNetOperatingIncomeInput {
  financialCalc?: FinancialCalc | null;
  baseData?: FinancialBaseData | null;
  revenuNetExploitation?: unknown;
  rne?: unknown;
  netOperatingIncome?: unknown;
  noi?: unknown;
  revenuBrutEffectif?: unknown;
  rbe?: unknown;
  effectiveGrossIncome?: unknown;
  depensesExploitation?: unknown;
  operatingExpenses?: unknown;
  opex?: unknown;
}

function firstFinite(...values: unknown[]): number | null {
  for (const value of values) {
    const n = safeNum(value);
    if (n != null && Number.isFinite(n)) return n;
  }
  return null;
}

export function resolveNetOperatingIncome(
  input: ResolveNetOperatingIncomeInput
): number | null {
  if (input.financialCalc || input.baseData) {
    const metrics = resolveCanonicalFinancialMetrics(
      input.financialCalc ?? null,
      input.baseData ?? null
    );
    if (metrics.rne != null && metrics.rne > 0) return metrics.rne;
  }

  const directRne = firstFinite(
    input.revenuNetExploitation,
    input.rne,
    input.netOperatingIncome,
    input.noi
  );
  if (directRne != null && directRne > 0) return Math.round(directRne);

  const rbe = firstFinite(
    input.revenuBrutEffectif,
    input.rbe,
    input.effectiveGrossIncome
  );
  const opex = firstFinite(
    input.depensesExploitation,
    input.operatingExpenses,
    input.opex
  );
  if (rbe != null && rbe > 0 && opex != null && opex >= 0) {
    return Math.max(0, Math.round(rbe - opex));
  }

  return null;
}

export function normalizeCapitalizationRatePct(value: unknown): number | null {
  const n = safeNum(value);
  if (n == null || n <= 0) return null;
  return n <= 1 ? n * 100 : n;
}

export function capitalizationRatePctToRatio(value: unknown): number | null {
  const pct = normalizeCapitalizationRatePct(value);
  return pct != null ? pct / 100 : null;
}

export function computeCapitalizationRatePct(
  rne: unknown,
  valeur: unknown
): number | null {
  const noi = safeNum(rne);
  const value = safeNum(valeur);
  if (noi == null || value == null || noi <= 0 || value <= 0) return null;
  return (noi / value) * 100;
}

export function computeCapitalizationRateRatio(
  rne: unknown,
  valeur: unknown
): number | null {
  const pct = computeCapitalizationRatePct(rne, valeur);
  return pct != null ? pct / 100 : null;
}

export function capitalizeNoiAtCapRatePct(
  rne: unknown,
  tgaPct: unknown
): number | null {
  const noi = safeNum(rne);
  const ratio = capitalizationRatePctToRatio(tgaPct);
  if (noi == null || noi <= 0 || ratio == null || ratio <= 0) return null;
  return Math.round(noi / ratio);
}
