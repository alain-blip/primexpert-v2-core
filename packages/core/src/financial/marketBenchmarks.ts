/**
 * Benchmarks marché — agrégation médiane depuis points anonymisés (Big Data).
 */

import type { ExpenseKey } from './expenseKeys';

export interface MarketBenchmarkQuery {
  regionAdministrative: string;
  siloType: string;
  nbPortes: number;
}

export interface MarketBenchmarkMedians {
  revenusParPorteAn: number | null;
  depensesParPorteAn: number | null;
  ratioFraisExploitationPct: number | null;
  depensesParCleParPorte: Partial<Record<ExpenseKey, number>>;
  sampleCount: number;
}

export interface MarketBenchmarkEntryLike {
  regionAdministrative: string;
  siloType: string;
  nbPortesBand: string;
  nbPortes?: number;
  revenusParPorteAn?: number;
  depensesParPorteAn?: number;
  ratioFraisExploitationPct?: number;
  depensesParCleParPorte?: Record<string, number>;
}

export function resolveNbPortesBandForQuery(nbPortes: number, siloType: string): string {
  if (siloType === 'rpa_ri_chsld') {
    if (nbPortes < 35) return 'RPA_[0-34]';
    if (nbPortes <= 80) return 'RPA_[35-80]';
    return 'RPA_[81+]';
  }
  if (siloType === 'cpe') {
    if (nbPortes < 40) return 'CPE_[0-39]';
    if (nbPortes <= 80) return 'CPE_[40-80]';
    return 'CPE_[81+]';
  }
  if (nbPortes <= 4) return 'PLEX_[1-4]';
  if (nbPortes <= 12) return 'PLEX_[5-12]';
  return 'PLEX_[13+]';
}

function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function aggregateMarketBenchmarkMedians(
  entries: MarketBenchmarkEntryLike[],
  query: MarketBenchmarkQuery
): MarketBenchmarkMedians {
  const band = resolveNbPortesBandForQuery(query.nbPortes, query.siloType);
  const matched = entries.filter(
    (e) =>
      e.regionAdministrative === query.regionAdministrative &&
      e.siloType === query.siloType &&
      e.nbPortesBand === band
  );

  const depensesParCleParPorte: Partial<Record<ExpenseKey, number>> = {};
  const keys = new Set<string>();
  for (const e of matched) {
    if (e.depensesParCleParPorte) {
      for (const k of Object.keys(e.depensesParCleParPorte)) keys.add(k);
    }
  }
  for (const key of keys) {
    const vals = matched
      .map((e) => e.depensesParCleParPorte?.[key])
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const m = median(vals);
    if (m != null) depensesParCleParPorte[key as ExpenseKey] = m;
  }

  return {
    revenusParPorteAn: median(
      matched.map((e) => e.revenusParPorteAn).filter((v): v is number => typeof v === 'number')
    ),
    depensesParPorteAn: median(
      matched.map((e) => e.depensesParPorteAn).filter((v): v is number => typeof v === 'number')
    ),
    ratioFraisExploitationPct: median(
      matched
        .map((e) => e.ratioFraisExploitationPct)
        .filter((v): v is number => typeof v === 'number')
    ),
    depensesParCleParPorte,
    sampleCount: matched.length,
  };
}

/** Écart vendeur sous le marché : déclaré < marché × (1 − seuil). */
export function isVendorExpenseAbnormallyLow(
  declared: number,
  marketAmount: number,
  thresholdPct = 15
): boolean {
  if (!marketAmount || marketAmount <= 0 || declared <= 0) return false;
  return declared < marketAmount * (1 - thresholdPct / 100);
}

export function marketAmountForExpenseKey(
  medians: MarketBenchmarkMedians,
  expenseKey: string,
  nombreUnites: number
): number | null {
  const perUnit = medians.depensesParCleParPorte[expenseKey as ExpenseKey];
  if (perUnit != null && perUnit > 0 && nombreUnites > 0) {
    return perUnit * nombreUnites;
  }
  if (medians.depensesParPorteAn != null && nombreUnites > 0 && expenseKey === '__total__') {
    return medians.depensesParPorteAn * nombreUnites;
  }
  return null;
}
