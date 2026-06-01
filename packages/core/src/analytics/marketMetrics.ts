/**
 * Métriques marché — ratio des dépenses d'exploitation (RDE / OER) V3.7.
 * SSOT validation IA, benchmarks régionaux et alertes HITL.
 */

import { coerceOperatingRatioPct } from '../market/operatingRatio';

/** Classes d'actif pour tolérances de validation IA. */
export type AssetBenchmarkClass = 'rpa' | 'plex' | 'commercial_pure' | 'industrial';

export const OPERATING_EXPENSE_RATIO_ALERT_GAP_PP = 7;

export interface OperatingExpenseRatioMetric {
  /** Ratio des dépenses d'exploitation (RDE) — pourcentage (ex. 42,5). */
  operatingExpenseRatio: number;
  assetClass: AssetBenchmarkClass;
  regionAdministrative?: string | null;
  anneeDonnees?: number | null;
  sampleCount?: number;
}

export interface OperatingExpenseRatioValidation {
  normalizedRatio: number | null;
  assetClass: AssetBenchmarkClass;
  withinTolerance: boolean;
  minPct: number;
  maxPct: number;
  issues: string[];
}

export interface OperatingExpenseRatioBenchmarkAssessment {
  subjectRatioPct: number;
  regionalMedianPct: number;
  gapPct: number;
  exceedsAlertThreshold: boolean;
  alertThresholdPct: number;
}

/** Bornes de validation IA par classe d'actif (% du revenu brut effectif (RBE)). */
export const ASSET_CLASS_OER_BOUNDS: Record<
  AssetBenchmarkClass,
  { minPct: number; maxPct: number; labelFr: string; labelEn: string }
> = {
  rpa: { minPct: 55, maxPct: 92, labelFr: 'résidence pour aînés (RPA)', labelEn: 'retirement home (RPA)' },
  plex: { minPct: 28, maxPct: 55, labelFr: 'plex / multilogement', labelEn: 'plex / multi-family' },
  commercial_pure: {
    minPct: 20,
    maxPct: 45,
    labelFr: 'commercial pur',
    labelEn: 'pure commercial',
  },
  industrial: {
    minPct: 12,
    maxPct: 35,
    labelFr: 'industriel',
    labelEn: 'industrial',
  },
};

export function normalizeOperatingExpenseRatioPct(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return coerceOperatingRatioPct(n) ?? null;
}

/** Calcule RDE = dépenses d'exploitation normalisées ÷ revenu brut effectif (RBE) × 100. */
export function computeOperatingExpenseRatioPct(input: {
  revenuBrutEffectif: number;
  depensesExploitation?: number | null;
  revenuNetExploitation?: number | null;
}): number | null {
  const rbe = input.revenuBrutEffectif;
  if (!Number.isFinite(rbe) || rbe <= 0) return null;

  let depenses = input.depensesExploitation;
  if ((depenses == null || depenses <= 0) && input.revenuNetExploitation != null) {
    depenses = rbe - input.revenuNetExploitation;
  }
  if (depenses == null || !Number.isFinite(depenses) || depenses <= 0) return null;

  return normalizeOperatingExpenseRatioPct((depenses / rbe) * 100);
}

export function resolveAssetBenchmarkClass(raw: unknown): AssetBenchmarkClass {
  const token = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/indust|entrepot|warehouse|manufactur/.test(token)) return 'industrial';
  if (/commercial|bureau|office|retail|strip/.test(token) && !/rpa|plex|residen/.test(token)) {
    return 'commercial_pure';
  }
  if (/plex|multilog|triplex|duplex|5\+|multi.?fam|coprop/.test(token)) return 'plex';
  return 'rpa';
}

export function validateOperatingExpenseRatioForAssetClass(
  ratioPct: unknown,
  assetClass: AssetBenchmarkClass
): OperatingExpenseRatioValidation {
  const normalizedRatio = normalizeOperatingExpenseRatioPct(ratioPct);
  const bounds = ASSET_CLASS_OER_BOUNDS[assetClass];
  const issues: string[] = [];

  if (normalizedRatio == null) {
    issues.push('Ratio des dépenses d\'exploitation (RDE) non calculable.');
    return {
      normalizedRatio: null,
      assetClass,
      withinTolerance: false,
      minPct: bounds.minPct,
      maxPct: bounds.maxPct,
      issues,
    };
  }

  if (normalizedRatio < bounds.minPct) {
    issues.push(
      `Ratio inférieur à la plage ${assetClass} (${bounds.minPct}–${bounds.maxPct} %).`
    );
  }
  if (normalizedRatio > bounds.maxPct) {
    issues.push(
      `Ratio supérieur à la plage ${assetClass} (${bounds.minPct}–${bounds.maxPct} %).`
    );
  }

  return {
    normalizedRatio,
    assetClass,
    withinTolerance: normalizedRatio >= bounds.minPct && normalizedRatio <= bounds.maxPct,
    minPct: bounds.minPct,
    maxPct: bounds.maxPct,
    issues,
  };
}

export function assessOperatingExpenseRatioVsRegionalMedian(
  subjectRatioPct: number,
  regionalMedianPct: number | null | undefined,
  alertGapPct = OPERATING_EXPENSE_RATIO_ALERT_GAP_PP
): OperatingExpenseRatioBenchmarkAssessment | null {
  const subject = normalizeOperatingExpenseRatioPct(subjectRatioPct);
  const median = normalizeOperatingExpenseRatioPct(regionalMedianPct);
  if (subject == null || median == null) return null;

  const gapPct = Math.abs(subject - median);
  return {
    subjectRatioPct: subject,
    regionalMedianPct: median,
    gapPct,
    exceedsAlertThreshold: gapPct > alertGapPct,
    alertThresholdPct: alertGapPct,
  };
}

export interface ProvincialOerAggregateRow {
  regionAdministrative: string;
  siloType: string;
  assetClassBenchmark: AssetBenchmarkClass;
  operatingExpenseRatioMedian: number;
  sampleCount: number;
}

export interface ProvincialOerAggregates {
  updatedAtMillis: number;
  globalOperatingExpenseRatioMedian: number | null;
  byRegion: ProvincialOerAggregateRow[];
}

function median(nums: number[]): number | null {
  const v = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

/** Agrège les médianes RDE provinciales par région / silo (snapshots quotidiens). */
export function computeProvincialOperatingExpenseRatioAggregates(
  rows: Array<{
    regionAdministrative?: unknown;
    siloType?: unknown;
    assetClassBenchmark?: unknown;
    operatingExpenseRatio?: unknown;
    ratioPct?: unknown;
  }>,
  updatedAtMillis = Date.now()
): ProvincialOerAggregates {
  const buckets = new Map<
    string,
    { regionAdministrative: string; siloType: string; assetClassBenchmark: AssetBenchmarkClass; ratios: number[] }
  >();

  for (const row of rows) {
    const ratio =
      normalizeOperatingExpenseRatioPct(row.operatingExpenseRatio) ??
      normalizeOperatingExpenseRatioPct(row.ratioPct);
    if (ratio == null) continue;

    const regionAdministrative = String(row.regionAdministrative ?? 'Quebec').trim() || 'Quebec';
    const siloType = String(row.siloType ?? 'rpa_ri_chsld').trim() || 'rpa_ri_chsld';
    const assetClassBenchmark = row.assetClassBenchmark
      ? resolveAssetBenchmarkClass(row.assetClassBenchmark)
      : resolveAssetBenchmarkClass(siloType);
    const key = `${regionAdministrative}|${siloType}|${assetClassBenchmark}`;
    const bucket = buckets.get(key) ?? {
      regionAdministrative,
      siloType,
      assetClassBenchmark,
      ratios: [],
    };
    bucket.ratios.push(ratio);
    buckets.set(key, bucket);
  }

  const byRegion: ProvincialOerAggregateRow[] = [];
  const allRatios: number[] = [];
  for (const bucket of buckets.values()) {
    const med = median(bucket.ratios);
    if (med == null) continue;
    byRegion.push({
      regionAdministrative: bucket.regionAdministrative,
      siloType: bucket.siloType,
      assetClassBenchmark: bucket.assetClassBenchmark,
      operatingExpenseRatioMedian: Number(med.toFixed(2)),
      sampleCount: bucket.ratios.length,
    });
    allRatios.push(...bucket.ratios);
  }

  byRegion.sort((a, b) => a.regionAdministrative.localeCompare(b.regionAdministrative, 'fr-CA'));

  const globalMed = median(allRatios);
  return {
    updatedAtMillis,
    globalOperatingExpenseRatioMedian:
      globalMed != null ? Number(globalMed.toFixed(2)) : null,
    byRegion,
  };
}

export function resolveRegionalOperatingExpenseRatioMedian(
  aggregates: ProvincialOerAggregates | null | undefined,
  regionAdministrative: string | null | undefined,
  assetClass?: AssetBenchmarkClass | null
): number | null {
  if (!aggregates?.byRegion.length) return aggregates?.globalOperatingExpenseRatioMedian ?? null;
  const region = String(regionAdministrative ?? '').trim();
  const matches = aggregates.byRegion.filter((row) => {
    const regionOk = !region || row.regionAdministrative === region;
    const classOk = !assetClass || row.assetClassBenchmark === assetClass;
    return regionOk && classOk;
  });
  const pool = matches.length ? matches : aggregates.byRegion;
  return median(pool.map((r) => r.operatingExpenseRatioMedian));
}

/** Médiane RDE depuis échantillons GPS (`market_analytics_raw`). */
export function resolveRegionalOerMedianFromRatioSamples(
  ratioSamples: Array<{ region?: string; labelKey?: string; ratioPct?: number | null }>,
  regionAdministrative: string | null | undefined
): number | null {
  const region = String(regionAdministrative ?? '').trim();
  const ratios = ratioSamples
    .filter(
      (s) =>
        s.labelKey === 'rde' &&
        s.ratioPct != null &&
        (!region || s.region === region)
    )
    .map((s) => s.ratioPct as number);
  return median(ratios);
}
