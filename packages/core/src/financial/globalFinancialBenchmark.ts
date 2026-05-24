/**
 * Types et helpers — benchmark portefeuille (callable getGlobalFinancialBenchmark).
 */

export const GLOBAL_FINANCIAL_BENCHMARK_MIN_SAMPLES = 3;
export const PORTFOLIO_EXPENSE_RATIO_TOLERANCE = 0.85;

export interface GlobalFinancialBenchmarkSummary {
  medianExpenseRatio: number | null;
  medianProfitMargin: number | null;
  medianIncomePerUnit: number | null;
  medianExpensePerUnit: number | null;
  summarySampleCount: number;
  dossierCount: number;
  windowMinYear: number;
  windowMaxYear: number;
}

export interface GlobalFinancialBenchmarkGroup {
  id: string;
  labelFr: string;
  labelEn: string;
  pctOfRevenue: number | null;
  avgCostPerUnit: number | null;
  ratioSampleCount: number;
  costPerUnitSampleCount: number;
}

export interface GlobalFinancialBenchmarkPayload {
  means: Record<string, number | null>;
  medians: Record<string, number | null>;
  counts: Record<string, number>;
  scannedResidences: number;
  dataV2DocumentsRead: number;
  excludedOutOfRollingWindow: number;
  qualityExcludedCount: number;
  minSamples: number;
  thresholdFactor: number;
  summary: GlobalFinancialBenchmarkSummary;
  benchmarkGroups: GlobalFinancialBenchmarkGroup[];
  benchmarkWindow?: {
    minYear: number;
    maxYear: number;
    dossierCount: number;
    currentYear: number;
  };
}

/** Montant marché annuel à partir d'une médiane ratio dépense/RBE. */
export function marketAmountFromMedianRatio(
  medianRatio: number | null | undefined,
  rbe: number
): number | null {
  if (medianRatio == null || !Number.isFinite(medianRatio) || rbe <= 0) return null;
  return medianRatio * rbe;
}

/** % du RBE à partir d'une médiane ratio (0–1 → points de %). */
export function marketPctFromMedianRatio(medianRatio: number | null | undefined): number | null {
  if (medianRatio == null || !Number.isFinite(medianRatio)) return null;
  return medianRatio * 100;
}

/** Alerte si déclaré < médiane marché × facteur de tolérance (legacy 0,85). */
export function lineTriggersPortfolioBenchmarkAlert(
  declared: number,
  marketAmount: number | null,
  thresholdFactor = PORTFOLIO_EXPENSE_RATIO_TOLERANCE
): boolean {
  if (!marketAmount || marketAmount <= 0 || declared <= 0) return false;
  return declared < marketAmount * thresholdFactor;
}
