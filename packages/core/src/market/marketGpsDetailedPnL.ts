/**
 * Tableau P&L détaillé — moyennes vs médianes par poste (Dashboard GPS).
 */

import {
  classifyExpenseGroup,
  compareExpenseLineKeys,
  dominantLabelDisplay,
  isResidualExpenseKey,
  resolveExpenseLineMeta,
  type PlExpenseGroup,
} from './marketPlExpenseDictionary';
import {
  coerceOperatingRatioPct,
  isPnLExpenseCandidate,
  sanitizeRatioSamplesForPnL,
} from './marketDataNormalize';
import {
  cleanseMarketRegion,
  computeValueRange,
  passesTemporalFilter,
  type MarketGpsRatioSample,
  type MarketTemporalWindow,
} from './marketGpsViewModel';

export type DetailedPnLRowKind = 'section-header' | 'group-header' | 'line' | 'subtotal';

export interface DetailedPnLRow {
  id: string;
  kind: DetailedPnLRowKind;
  labelFr: string;
  labelEn: string;
  indent?: boolean;
  /** Nombre d'échantillons bruts pour ce poste. */
  sampleCount: number;
  /** Moyenne arithmétique ($ / unité). */
  meanPerUnit?: number;
  /** Médiane ($ / unité). */
  medianPerUnit?: number;
  minPerUnit?: number;
  maxPerUnit?: number;
  /** % du revenu brut effectif (RBE) — moyenne. */
  pctRbeMean?: number;
  /** % du revenu brut effectif (RBE) — médiane. */
  pctRbeMedian?: number;
  /** Ligne ratio (RDE) — pas de $/unité. */
  isRatioLine?: boolean;
  meanRatioPct?: number;
  medianRatioPct?: number;
}

function mean(values: number[]): number | undefined {
  const nums = values.filter(Number.isFinite);
  if (!nums.length) return undefined;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function statsFromRatioValues(values: number[]) {
  const cleaned = values
    .map((v) => coerceOperatingRatioPct(v))
    .filter((v): v is number => v != null);
  const range = computeValueRange(cleaned);
  return {
    sampleCount: range.count,
    meanRatioPct: mean(cleaned),
    medianRatioPct: range.median,
    minRatioPct: range.min,
    maxRatioPct: range.max,
  };
}

function statsFromValues(values: number[]) {
  const range = computeValueRange(values);
  return {
    sampleCount: range.count,
    meanPerUnit: mean(values),
    medianPerUnit: range.median,
    minPerUnit: range.min,
    maxPerUnit: range.max,
  };
}

function pctOfRbe(amount?: number, rbe?: number): number | undefined {
  if (amount == null || rbe == null || rbe <= 0) return undefined;
  return (amount / rbe) * 100;
}

function estimateRbePerUnit(
  expenseMeans: Map<string, number>,
  rdeMedian?: number
): number | undefined {
  if (rdeMedian == null || rdeMedian <= 0 || rdeMedian >= 100) return undefined;
  let total = 0;
  for (const [key, v] of expenseMeans) {
    if (isResidualExpenseKey(key)) continue;
    total += v;
  }
  if (total <= 0) return undefined;
  return total / (rdeMedian / 100);
}

function sectionHeader(id: string, labelFr: string, labelEn: string): DetailedPnLRow {
  return { id, kind: 'section-header', labelFr, labelEn, sampleCount: 0 };
}

function groupHeader(id: string, labelFr: string, labelEn: string): DetailedPnLRow {
  return { id, kind: 'group-header', labelFr, labelEn, sampleCount: 0, indent: true };
}

const REVENUE_KEYS = new Set(['rbe', 'rne', 'rde']);

export function computeDetailedPnLRows(samples: MarketGpsRatioSample[]): DetailedPnLRow[] {
  if (!samples.length) return [];

  const cleanSamples = sanitizeRatioSamplesForPnL(samples);

  const rbeValues = cleanSamples
    .filter((s) => s.labelKey === 'rbe' && s.montantParPorte != null)
    .map((s) => s.montantParPorte!);
  const rneValues = cleanSamples
    .filter((s) => s.labelKey === 'rne' && s.montantParPorte != null)
    .map((s) => s.montantParPorte!);
  const rdeValues = cleanSamples
    .filter((s) => s.labelKey === 'rde' && s.ratioPct != null)
    .map((s) => s.ratioPct!);

  const expenseKeys = new Set<string>();
  for (const s of cleanSamples) {
    if (
      !REVENUE_KEYS.has(s.labelKey) &&
      isPnLExpenseCandidate(s.labelKey, s.labelDisplay) &&
      s.montantParPorte != null &&
      Number.isFinite(s.montantParPorte)
    ) {
      expenseKeys.add(s.labelKey);
    }
  }

  const expenseStats = new Map<string, ReturnType<typeof statsFromValues>>();
  const expenseMeans = new Map<string, number>();
  for (const key of expenseKeys) {
    const vals = cleanSamples
      .filter((s) => s.labelKey === key && s.montantParPorte != null)
      .map((s) => s.montantParPorte!);
    const st = statsFromValues(vals);
    expenseStats.set(key, st);
    if (st.meanPerUnit != null && !isResidualExpenseKey(key)) {
      expenseMeans.set(key, st.meanPerUnit);
    }
  }

  const rbeStats = statsFromValues(rbeValues);
  const rdeStats = statsFromRatioValues(rdeValues);
  let rbeMean = rbeStats.meanPerUnit;
  let rbeMedian = rbeStats.medianPerUnit;
  const rdeMedianPct = rdeStats.medianRatioPct;
  const rdeMeanPct = rdeStats.meanRatioPct;
  if (rbeMean == null && rdeMedianPct != null) {
    rbeMean = estimateRbePerUnit(expenseMeans, rdeMedianPct);
  }
  if (rbeMedian == null && rdeMedianPct != null) {
    const expenseMedians = new Map<string, number>();
    for (const [k, st] of expenseStats) {
      if (st.medianPerUnit != null && !isResidualExpenseKey(k)) {
        expenseMedians.set(k, st.medianPerUnit);
      }
    }
    let total = 0;
    for (const [, v] of expenseMedians) total += v;
    if (total > 0) rbeMedian = total / (rdeMedianPct / 100);
  }

  const rneStats = statsFromValues(rneValues);
  if (!rneStats.sampleCount && rbeMedian != null && rdeMedianPct != null) {
    const rne = rbeMedian * (1 - rdeMedianPct / 100);
    rneStats.meanPerUnit =
      rbeMean != null ? rbeMean * (1 - (rdeMeanPct ?? rdeMedianPct) / 100) : rne;
    rneStats.medianPerUnit = rne;
    rneStats.minPerUnit = rne;
    rneStats.maxPerUnit = rne;
    rneStats.sampleCount = 1;
  }

  const rows: DetailedPnLRow[] = [];

  rows.push(sectionHeader('sec-revenu', '1 · Revenus', '1 · Revenue'));
  rows.push({
    id: 'rbe',
    kind: 'subtotal',
    labelFr: 'Revenu brut effectif (RBE)',
    labelEn: 'Effective gross income (EGI)',
    sampleCount: rbeStats.sampleCount,
    meanPerUnit: rbeMean ?? rbeStats.meanPerUnit,
    medianPerUnit: rbeMedian ?? rbeStats.medianPerUnit,
    minPerUnit: rbeStats.minPerUnit,
    maxPerUnit: rbeStats.maxPerUnit,
    pctRbeMean: 100,
    pctRbeMedian: 100,
  });

  rows.push(sectionHeader('sec-depense', '2 · Dépenses', '2 · Expenses'));

  const groups: PlExpenseGroup[] = ['fixes', 'operationnelles', 'gestion'];
  const groupLabels: Record<PlExpenseGroup, { fr: string; en: string }> = {
    fixes: { fr: 'Dépenses fixes', en: 'Fixed expenses' },
    operationnelles: { fr: 'Dépenses opérationnelles', en: 'Operating expenses' },
    gestion: { fr: 'Frais de gestion', en: 'Management expenses' },
  };

  const sortedExpenseKeys = [...expenseKeys].sort(compareExpenseLineKeys);

  for (const group of groups) {
    const keysInGroup = sortedExpenseKeys.filter((k) => classifyExpenseGroup(k) === group);
    if (!keysInGroup.length) continue;

    rows.push(groupHeader(`grp-${group}`, groupLabels[group].fr, groupLabels[group].en));

    for (const key of keysInGroup) {
      const displayOverride = dominantLabelDisplay(key, cleanSamples);
      const meta = resolveExpenseLineMeta(key, displayOverride);
      const st = expenseStats.get(key)!;
      rows.push({
        id: `exp-${key}`,
        kind: 'line',
        labelFr: displayOverride ?? meta.labelFr,
        labelEn: displayOverride ?? meta.labelEn,
        indent: true,
        sampleCount: st.sampleCount,
        meanPerUnit: st.meanPerUnit,
        medianPerUnit: st.medianPerUnit,
        minPerUnit: st.minPerUnit,
        maxPerUnit: st.maxPerUnit,
        pctRbeMean: pctOfRbe(st.meanPerUnit, rbeMean ?? rbeMedian),
        pctRbeMedian: pctOfRbe(st.medianPerUnit, rbeMedian ?? rbeMean),
      });
    }
  }

  rows.push({
    id: 'rde-total',
    kind: 'subtotal',
    labelFr: 'Total des dépenses — ratio des dépenses d\'exploitation (RDE)',
    labelEn: 'Total expenses — operating expense ratio (OER)',
    sampleCount: rdeStats.sampleCount,
    isRatioLine: true,
    meanRatioPct: rdeMeanPct,
    medianRatioPct: rdeMedianPct,
    minPerUnit: rdeStats.minRatioPct,
    maxPerUnit: rdeStats.maxRatioPct,
    pctRbeMean: rdeMeanPct,
    pctRbeMedian: rdeMedianPct,
  });

  rows.push(sectionHeader('sec-profit', '3 · Profit', '3 · Profit'));
  rows.push({
    id: 'rne',
    kind: 'subtotal',
    labelFr: 'Revenu net d\'exploitation (RNE)',
    labelEn: 'Net operating income (NOI)',
    sampleCount: rneStats.sampleCount,
    meanPerUnit: rneStats.meanPerUnit,
    medianPerUnit: rneStats.medianPerUnit,
    minPerUnit: rneStats.minPerUnit,
    maxPerUnit: rneStats.maxPerUnit,
    pctRbeMean: pctOfRbe(rneStats.meanPerUnit, rbeMean ?? rbeMedian),
    pctRbeMedian: pctOfRbe(rneStats.medianPerUnit, rbeMedian ?? rbeMean),
  });

  return rows;
}

/** Filtre échantillons ratio (région + fenêtre temporelle). */
export function filterRatioSamples(
  samples: MarketGpsRatioSample[],
  options: {
    region?: string;
    temporalWindow?: MarketTemporalWindow;
    temporalCutoffMillis?: number | null;
  }
): MarketGpsRatioSample[] {
  return samples.filter((s) => {
    const region = cleanseMarketRegion(s.region);
    if (options.region && options.region !== 'all' && region !== options.region) return false;
    if (options.temporalWindow && options.temporalWindow !== 'all') {
      if (!passesTemporalFilter(s.sortMillis, options.temporalWindow)) return false;
    } else if (options.temporalCutoffMillis != null && options.temporalCutoffMillis > 0) {
      if (s.sortMillis <= 0 || s.sortMillis < options.temporalCutoffMillis) return false;
    }
    return true;
  });
}

export function computeDetailedPnLForFilter(
  samples: MarketGpsRatioSample[],
  options: {
    region?: string;
    temporalWindow?: MarketTemporalWindow;
    temporalCutoffMillis?: number | null;
  }
): { rows: DetailedPnLRow[]; sampleCount: number; regionLabel: string; lineCount: number } {
  const filtered = filterRatioSamples(samples, options);
  const regions = new Set(filtered.map((s) => cleanseMarketRegion(s.region)).filter((r) => r && r !== '—'));
  const regionLabel =
    options.region && options.region !== 'all'
      ? options.region
      : regions.size === 1
        ? [...regions][0]
        : 'all';

  const rows = computeDetailedPnLRows(filtered);
  const lineCount = rows.filter((r) => r.kind === 'line').length;

  return {
    rows,
    sampleCount: filtered.length,
    regionLabel,
    lineCount,
  };
}
