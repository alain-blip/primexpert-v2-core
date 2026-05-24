/**
 * Séries temporelles Dashboard GPS — tendances par année/trimestre (préparation ACM).
 */

import { cleanseMarketRegion, median, type MarketGpsRatioSample, type MarketGpsTransaction } from './marketGpsViewModel';
import { canonicalExpenseKey } from './marketPlExpenseDictionary';

export type TrendGranularity = 'year' | 'quarter';

export type TrendMetricKey =
  | 'salairesAvantages'
  | 'energie'
  | 'assurances'
  | 'prix_unite'
  | 'tga';

export interface TrendMetricOption {
  key: TrendMetricKey;
  labelFr: string;
  labelEn: string;
  unit: 'currency' | 'percent';
}

export const TREND_METRIC_OPTIONS: TrendMetricOption[] = [
  { key: 'salairesAvantages', labelFr: 'Salaires et charges sociales ($ / unité)', labelEn: 'Salaries & benefits ($ / unit)', unit: 'currency' },
  { key: 'energie', labelFr: 'Énergie ($ / unité)', labelEn: 'Energy ($ / unit)', unit: 'currency' },
  { key: 'assurances', labelFr: 'Assurances ($ / unité)', labelEn: 'Insurance ($ / unit)', unit: 'currency' },
  { key: 'prix_unite', labelFr: 'Prix / unité (ventes)', labelEn: 'Price / unit (sales)', unit: 'currency' },
  { key: 'tga', labelFr: 'Taux de capitalisation (TGA)', labelEn: 'Capitalization rate (cap rate)', unit: 'percent' },
];

export interface MarketTrendSeries {
  labels: string[];
  values: (number | null)[];
  sampleCounts: number[];
  metric: TrendMetricOption;
  granularity: TrendGranularity;
}

function periodKeyFromMillis(ms: number, granularity: TrendGranularity): string | null {
  if (ms <= 0) return null;
  const d = new Date(ms);
  const y = d.getFullYear();
  if (granularity === 'year') return String(y);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${y}-T${q}`;
}

function sortPeriodKeys(keys: string[], granularity: TrendGranularity): string[] {
  return [...keys].sort((a, b) => {
    if (granularity === 'year') return Number(a) - Number(b);
    const [ya, qa] = a.split('-T').map(Number);
    const [yb, qb] = b.split('-T').map(Number);
    return ya !== yb ? ya - yb : qa - qb;
  });
}

function formatPeriodLabel(key: string, granularity: TrendGranularity, locale: 'fr' | 'en'): string {
  if (granularity === 'year') return key;
  const [y, q] = key.split('-T');
  return locale === 'fr' ? `${y} · T${q}` : `${y} · Q${q}`;
}

export function computeMarketTrendSeries(input: {
  ratioSamples: MarketGpsRatioSample[];
  transactions: MarketGpsTransaction[];
  metricKey: TrendMetricKey;
  granularity: TrendGranularity;
  region?: string;
  locale: 'fr' | 'en';
}): MarketTrendSeries {
  const metric = TREND_METRIC_OPTIONS.find((m) => m.key === input.metricKey) ?? TREND_METRIC_OPTIONS[0];
  const buckets = new Map<string, number[]>();

  const regionOk = (region: string) => {
    const r = cleanseMarketRegion(region);
    if (!input.region || input.region === 'all') return true;
    return r === input.region;
  };

  if (metric.key === 'prix_unite' || metric.key === 'tga') {
    for (const tx of input.transactions) {
      if (!regionOk(tx.region)) continue;
      const key = periodKeyFromMillis(tx.sortMillis, input.granularity);
      if (!key) continue;
      let val: number | undefined;
      if (metric.key === 'prix_unite') {
        val =
          tx.prixVente != null && tx.nbPortes != null && tx.nbPortes > 0
            ? tx.prixVente / tx.nbPortes
            : tx.prixParPorte;
      } else {
        val = tx.tgaPct;
      }
      if (val == null || !Number.isFinite(val)) continue;
      const list = buckets.get(key) ?? [];
      list.push(val);
      buckets.set(key, list);
    }
  } else {
    for (const s of input.ratioSamples) {
      if (!regionOk(s.region)) continue;
      if (canonicalExpenseKey(s.labelKey) !== metric.key || s.montantParPorte == null) continue;
      const key = periodKeyFromMillis(s.sortMillis, input.granularity);
      if (!key) continue;
      const list = buckets.get(key) ?? [];
      list.push(s.montantParPorte);
      buckets.set(key, list);
    }
  }

  const sortedKeys = sortPeriodKeys([...buckets.keys()], input.granularity);
  const labels = sortedKeys.map((k) => formatPeriodLabel(k, input.granularity, input.locale));
  const values: (number | null)[] = [];
  const sampleCounts: number[] = [];

  for (const key of sortedKeys) {
    const vals = buckets.get(key) ?? [];
    sampleCounts.push(vals.length);
    values.push(vals.length ? median(vals) ?? null : null);
  }

  return {
    labels,
    values,
    sampleCounts,
    metric,
    granularity: input.granularity,
  };
}
