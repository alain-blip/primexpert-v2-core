/**
 * Contexte tendances coûts régionaux pour l'ACM — inflation 24–36 mois + point sujet.
 */

import {
  computeMarketTrendSeries,
  TREND_METRIC_OPTIONS,
  type MarketTrendSeries,
  type TrendMetricKey,
} from './marketGpsTrendSeries';
import type { MarketGpsRatioSample, MarketGpsTransaction } from './marketGpsViewModel';

export interface AcmCostTrendPoint {
  metricKey: TrendMetricKey;
  labelFr: string;
  labelEn: string;
  /** Médiane régionale la plus récente ($ / unité ou %) */
  latestRegional: number | null;
  /** Valeur sujet ($ / unité) */
  subjectPerUnit: number | null;
  /** Variation % entre première et dernière période avec données */
  trendDeltaPct: number | null;
  series: MarketTrendSeries;
  narrativeFr: string | null;
  narrativeEn: string | null;
}

function trendDeltaPct(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (valid.length < 2) return null;
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (first <= 0) return null;
  return Math.round(((last - first) / first) * 1000) / 10;
}

function buildNarrative(
  labelFr: string,
  labelEn: string,
  deltaPct: number | null,
  subjectPerUnit: number | null,
  latestRegional: number | null,
  locale: 'fr' | 'en'
): string | null {
  if (deltaPct == null) return null;
  const dirFr = deltaPct >= 0 ? 'augmenté' : 'diminué';
  const dirEn = deltaPct >= 0 ? 'increased' : 'decreased';
  const absPct = Math.abs(deltaPct).toFixed(1);

  if (locale === 'fr') {
    let s = `Les coûts régionaux « ${labelFr} » ont ${dirFr} d'environ ${absPct} % sur la période analysée.`;
    if (subjectPerUnit != null && latestRegional != null && latestRegional > 0) {
      const gap = Math.round(((subjectPerUnit - latestRegional) / latestRegional) * 1000) / 10;
      if (Math.abs(gap) <= 8) {
        s += ` Vos dépenses suivent la courbe d'inflation régionale observée.`;
      } else if (gap > 8) {
        s += ` Vos dépenses excèdent la médiane régionale de ${gap.toFixed(1)} % — justifiez-les par les spécificités de l'immeuble.`;
      } else {
        s += ` Vos dépenses sont inférieures à la médiane régionale de ${Math.abs(gap).toFixed(1)} %.`;
      }
    }
    return s;
  }

  let s = `Regional « ${labelEn} » costs have ${dirEn} by about ${absPct}% over the analyzed period.`;
  if (subjectPerUnit != null && latestRegional != null && latestRegional > 0) {
    const gap = Math.round(((subjectPerUnit - latestRegional) / latestRegional) * 1000) / 10;
    if (Math.abs(gap) <= 8) {
      s += ` Your expenses track the observed regional inflation curve.`;
    } else if (gap > 8) {
      s += ` Your expenses exceed the regional median by ${gap.toFixed(1)}% — justify with property-specific factors.`;
    } else {
      s += ` Your expenses are ${Math.abs(gap).toFixed(1)}% below the regional median.`;
    }
  }
  return s;
}

export function computeAcmCostTrendPoints(input: {
  ratioSamples: MarketGpsRatioSample[];
  transactions: MarketGpsTransaction[];
  region?: string;
  locale: 'fr' | 'en';
  units: number;
  /** Dépenses annuelles par clé canonique */
  subjectExpenses?: Partial<Record<string, number>>;
  metricKeys?: TrendMetricKey[];
}): AcmCostTrendPoint[] {
  const keys =
    input.metricKeys ??
    (['salairesAvantages', 'energie', 'entretienReparation', 'nourritures'] as TrendMetricKey[]);

  const units = Math.max(1, input.units);
  const expenses = input.subjectExpenses ?? {};

  return keys.map((metricKey) => {
    const opt = TREND_METRIC_OPTIONS.find((m) => m.key === metricKey)!;
    const series = computeMarketTrendSeries({
      ratioSamples: input.ratioSamples,
      transactions: input.transactions,
      metricKey,
      granularity: 'quarter',
      region: input.region,
      locale: input.locale,
    });

    const latestRegional =
      [...series.values].reverse().find((v) => v != null && Number.isFinite(v)) ?? null;
    const delta = trendDeltaPct(series.values);
    const annual = expenses[metricKey] ?? null;
    const subjectPerUnit =
      annual != null && annual > 0 ? Math.round(annual / units) : null;

    return {
      metricKey,
      labelFr: opt.labelFr,
      labelEn: opt.labelEn,
      latestRegional,
      subjectPerUnit,
      trendDeltaPct: delta,
      series,
      narrativeFr: buildNarrative(opt.labelFr, opt.labelEn, delta, subjectPerUnit, latestRegional, 'fr'),
      narrativeEn: buildNarrative(opt.labelFr, opt.labelEn, delta, subjectPerUnit, latestRegional, 'en'),
    };
  });
}

export function collectAcmCostTrendNarratives(
  points: AcmCostTrendPoint[],
  locale: 'fr' | 'en'
): string[] {
  return points
    .map((p) => (locale === 'fr' ? p.narrativeFr : p.narrativeEn))
    .filter((s): s is string => !!s);
}
