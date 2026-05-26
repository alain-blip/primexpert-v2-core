/**
 * Contexte tendances coûts régionaux pour l'ACM — inflation 24–36 mois, toutes catégories extraites.
 */

import {
  computeMarketTrendSeries,
  resolveExpenseTrendMetricOption,
  type MarketTrendSeries,
  type TrendMetricKey,
} from './marketGpsTrendSeries';
import type { MarketGpsRatioSample, MarketGpsTransaction } from './marketGpsViewModel';
import {
  expenseTrendLabel,
  resolveAcmTrendExpenseKeys,
} from './acmExpenseTrendCatalog';

export interface AcmCostTrendPoint {
  metricKey: string;
  labelFr: string;
  labelEn: string;
  latestRegional: number | null;
  subjectPerUnit: number | null;
  /** Écart sujet vs médiane régionale (%) */
  subjectGapPct: number | null;
  trendDeltaPct: number | null;
  series: MarketTrendSeries;
  narrativeFr: string | null;
  narrativeEn: string | null;
  hasRegionalData: boolean;
}

export interface AcmCostTrendNarrativeBundle {
  globalSummaryFr: string | null;
  globalSummaryEn: string | null;
  /** Notes courtes par poste (moteur narratif) */
  bulletsFr: string[];
  bulletsEn: string[];
}

const MAX_PERIODS = 12;
const GAP_ALIGNED = 8;

function trendDeltaPct(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (valid.length < 2) return null;
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (first <= 0) return null;
  return Math.round(((last - first) / first) * 1000) / 10;
}

function sliceSeries(series: MarketTrendSeries): MarketTrendSeries {
  const start = Math.max(0, series.labels.length - MAX_PERIODS);
  return {
    ...series,
    labels: series.labels.slice(start),
    values: series.values.slice(start),
    sampleCounts: series.sampleCounts.slice(start),
  };
}

function shortLabel(labelFr: string, labelEn: string, locale: 'fr' | 'en'): string {
  const raw = locale === 'fr' ? labelFr : labelEn;
  return raw.replace(/\s*\(\$\s*\/\s*unité?\)\s*$/i, '').trim();
}

function buildCategoryNarrative(
  labelFr: string,
  labelEn: string,
  deltaPct: number | null,
  subjectPerUnit: number | null,
  latestRegional: number | null,
  locale: 'fr' | 'en'
): string | null {
  if (deltaPct == null && subjectPerUnit == null) return null;
  const name = shortLabel(labelFr, labelEn, locale);

  if (locale === 'fr') {
    let s = '';
    if (deltaPct != null) {
      const dir = deltaPct >= 0 ? 'augmenté' : 'diminué';
      s = `« ${name} » : inflation régionale d'environ ${Math.abs(deltaPct).toFixed(1)} % (${dir}).`;
    }
    if (subjectPerUnit != null && latestRegional != null && latestRegional > 0) {
      const gap = Math.round(((subjectPerUnit - latestRegional) / latestRegional) * 1000) / 10;
      if (Math.abs(gap) <= GAP_ALIGNED) {
        s += ` Vos coûts suivent la médiane régionale.`;
      } else if (gap > GAP_ALIGNED) {
        s += ` Vos coûts dépassent la médiane de ${gap.toFixed(1)} %.`;
      } else {
        s += ` Vos coûts sont sous la médiane de ${Math.abs(gap).toFixed(1)} %.`;
      }
    } else if (subjectPerUnit != null && subjectPerUnit > 0) {
      s += ` Coût sujet : ${Math.round(subjectPerUnit).toLocaleString('fr-CA')} $ / unité (données GPS régionales limitées).`;
    }
    return s.trim() || null;
  }

  let s = '';
  if (deltaPct != null) {
    const dir = deltaPct >= 0 ? 'increased' : 'decreased';
    s = `« ${name} »: regional inflation about ${Math.abs(deltaPct).toFixed(1)}% (${dir}).`;
  }
  if (subjectPerUnit != null && latestRegional != null && latestRegional > 0) {
    const gap = Math.round(((subjectPerUnit - latestRegional) / latestRegional) * 1000) / 10;
    if (Math.abs(gap) <= GAP_ALIGNED) {
      s += ' Your costs track the regional median.';
    } else if (gap > GAP_ALIGNED) {
      s += ` Your costs exceed the median by ${gap.toFixed(1)}%.`;
    } else {
      s += ` Your costs are ${Math.abs(gap).toFixed(1)}% below the median.`;
    }
  }
  return s.trim() || null;
}

export function buildAcmCostTrendGlobalNarrative(
  points: AcmCostTrendPoint[],
  locale: 'fr' | 'en'
): string | null {
  const compared = points.filter(
    (p) =>
      p.subjectPerUnit != null &&
      p.latestRegional != null &&
      p.latestRegional > 0 &&
      p.subjectGapPct != null
  );
  if (!compared.length) {
    return locale === 'fr'
      ? 'Analyse des tendances : données GPS régionales ou ventilation sujet insuffisantes pour une lecture comparative par poste.'
      : 'Trend analysis: insufficient regional GPS data or subject breakdown for line-by-line comparison.';
  }

  const aligned: string[] = [];
  const above: string[] = [];
  const below: string[] = [];
  const inflating: string[] = [];

  for (const p of compared) {
    const name = shortLabel(p.labelFr, p.labelEn, locale);
    const gap = p.subjectGapPct!;
    if (Math.abs(gap) <= GAP_ALIGNED) aligned.push(name);
    else if (gap > GAP_ALIGNED) above.push(name);
    else below.push(name);
    if (p.trendDeltaPct != null && p.trendDeltaPct >= 5) inflating.push(name);
  }

  const join = (arr: string[]) =>
    arr.length <= 2
      ? arr.join(locale === 'fr' ? ' et ' : ' and ')
      : `${arr.slice(0, -1).join(', ')}${locale === 'fr' ? ' et ' : ', and '}${arr[arr.length - 1]}`;

  if (locale === 'fr') {
    const parts: string[] = [
      'Lecture des tendances régionales (GPS, 24–36 mois) par rapport à la propriété sujet :',
    ];
    if (aligned.length) {
      parts.push(
        `${join(aligned)} ${aligned.length > 1 ? 'suivent' : 'suit'} la courbe d'inflation régionale observée.`
      );
    }
    if (above.length) {
      parts.push(
        `${join(above)} ${above.length > 1 ? 'excèdent' : 'excède'} la médiane régionale — à justifier (spécificités de l'immeuble).`
      );
    }
    if (below.length) {
      parts.push(
        `${join(below)} ${below.length > 1 ? 'restent' : 'reste'} sous la médiane régionale.`
      );
    }
    if (inflating.length && inflating.length !== aligned.length) {
      parts.push(
        `Inflation régionale marquée sur ${join(inflating)}.`
      );
    }
    return parts.join(' ');
  }

  const parts: string[] = [
    'Regional trend read (GPS, 24–36 months) vs. the subject property:',
  ];
  if (aligned.length) {
    parts.push(
      `${join(aligned)} track${aligned.length > 1 ? '' : 's'} the observed regional inflation curve.`
    );
  }
  if (above.length) {
    parts.push(
      `${join(above)} exceed${above.length > 1 ? '' : 's'} the regional median — justify with property-specific factors.`
    );
  }
  if (below.length) {
    parts.push(`${join(below)} remain${below.length > 1 ? '' : 's'} below the regional median.`);
  }
  if (inflating.length && inflating.length !== aligned.length) {
    parts.push(`Notable regional inflation on ${join(inflating)}.`);
  }
  return parts.join(' ');
}

export function computeAcmCostTrendPoints(input: {
  ratioSamples: MarketGpsRatioSample[];
  transactions: MarketGpsTransaction[];
  region?: string;
  locale: 'fr' | 'en';
  units: number;
  subjectExpenses?: Partial<Record<string, number>>;
  metricKeys?: string[];
}): AcmCostTrendPoint[] {
  const keys = input.metricKeys ?? resolveAcmTrendExpenseKeys(input.subjectExpenses);
  const units = Math.max(1, input.units);
  const expenses = input.subjectExpenses ?? {};

  return keys.map((metricKey) => {
    const opt = resolveExpenseTrendMetricOption(metricKey);
    const rawSeries = computeMarketTrendSeries({
      ratioSamples: input.ratioSamples,
      transactions: input.transactions,
      metricKey: metricKey as TrendMetricKey,
      granularity: 'quarter',
      region: input.region,
      locale: input.locale,
    });
    const series = sliceSeries(rawSeries);
    const hasRegionalData = series.values.some((v) => v != null);

    const latestRegional =
      [...series.values].reverse().find((v) => v != null && Number.isFinite(v)) ?? null;
    const delta = trendDeltaPct(series.values);
    const annual = expenses[metricKey] ?? null;
    const subjectPerUnit =
      annual != null && annual > 0 ? Math.round(annual / units) : null;
    const subjectGapPct =
      subjectPerUnit != null && latestRegional != null && latestRegional > 0
        ? Math.round(((subjectPerUnit - latestRegional) / latestRegional) * 1000) / 10
        : null;

    const labelFr = expenseTrendLabel(metricKey, 'fr');
    const labelEn = expenseTrendLabel(metricKey, 'en');

    return {
      metricKey,
      labelFr: opt.labelFr.includes('($') ? opt.labelFr : `${labelFr} ($ / unité)`,
      labelEn: opt.labelEn.includes('($') ? opt.labelEn : `${labelEn} ($ / unit)`,
      latestRegional,
      subjectPerUnit,
      subjectGapPct,
      trendDeltaPct: delta,
      series,
      narrativeFr: buildCategoryNarrative(
        labelFr,
        labelEn,
        delta,
        subjectPerUnit,
        latestRegional,
        'fr'
      ),
      narrativeEn: buildCategoryNarrative(
        labelFr,
        labelEn,
        delta,
        subjectPerUnit,
        latestRegional,
        'en'
      ),
      hasRegionalData,
    };
  });
}

export function buildAcmCostTrendNarrativeBundle(
  points: AcmCostTrendPoint[],
  locale: 'fr' | 'en'
): AcmCostTrendNarrativeBundle {
  const globalSummaryFr = buildAcmCostTrendGlobalNarrative(points, 'fr');
  const globalSummaryEn = buildAcmCostTrendGlobalNarrative(points, 'en');

  const bulletsFr = points
    .map((p) => p.narrativeFr)
    .filter((s): s is string => !!s)
    .slice(0, 6);
  const bulletsEn = points
    .map((p) => p.narrativeEn)
    .filter((s): s is string => !!s)
    .slice(0, 6);

  return { globalSummaryFr, globalSummaryEn, bulletsFr, bulletsEn };
}

/** @deprecated Préférer buildAcmCostTrendNarrativeBundle */
export function collectAcmCostTrendNarratives(
  points: AcmCostTrendPoint[],
  locale: 'fr' | 'en'
): string[] {
  const bundle = buildAcmCostTrendNarrativeBundle(points, locale);
  const global = locale === 'fr' ? bundle.globalSummaryFr : bundle.globalSummaryEn;
  const bullets = locale === 'fr' ? bundle.bulletsFr : bundle.bulletsEn;
  return global ? [global, ...bullets] : bullets;
}
