/**
 * Graphique d'évolution temporelle — tendances $/unité et TGA (Dashboard GPS · onglet 3).
 */

import { useMemo, useState } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  TREND_METRIC_OPTIONS,
  computeMarketTrendSeries,
  type MarketGpsRatioSample,
  type MarketGpsTransaction,
  type TrendGranularity,
  type TrendMetricKey,
} from '@primexpert/core/market';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export function MarketTrendCharts({
  ratioSamples,
  transactions,
  regionFilter,
  locale,
  t,
}: {
  ratioSamples: MarketGpsRatioSample[];
  transactions: MarketGpsTransaction[];
  regionFilter: string;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
}) {
  const [metricKey, setMetricKey] = useState<TrendMetricKey>('salaires');
  const [granularity, setGranularity] = useState<TrendGranularity>('year');

  const series = useMemo(
    () =>
      computeMarketTrendSeries({
        ratioSamples,
        transactions,
        metricKey,
        granularity,
        region: regionFilter,
        locale,
      }),
    [ratioSamples, transactions, metricKey, granularity, regionFilter, locale]
  );

  const hasData = series.values.some((v) => v != null);

  return (
    <section className="rounded-xl border-2 border-slate-300 bg-white shadow-sm overflow-hidden mb-6">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-end gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {t('Analyse de tendances', 'Trend analysis')}
          </p>
          <h3 className="text-sm font-black text-[#142c6a]">
            {t('Évolution historique des coûts et ratios', 'Historical cost and ratio trends')}
          </h3>
        </div>
        <label className="flex flex-col gap-1 ml-auto">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {t('Poste / indicateur', 'Line item / indicator')}
          </span>
          <select
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value as TrendMetricKey)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900"
          >
            {TREND_METRIC_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {locale === 'fr' ? opt.labelFr : opt.labelEn}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {t('Granularité', 'Granularity')}
          </span>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as TrendGranularity)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900"
          >
            <option value="year">{t('Par année', 'By year')}</option>
            <option value="quarter">{t('Par trimestre', 'By quarter')}</option>
          </select>
        </label>
      </header>

      <div className="p-4 h-72">
        {hasData ? (
          <Line
            data={{
              labels: series.labels,
              datasets: [
                {
                  label: locale === 'fr' ? series.metric.labelFr : series.metric.labelEn,
                  data: series.values,
                  borderColor: 'rgba(20, 44, 106, 0.9)',
                  backgroundColor: 'rgba(20, 44, 106, 0.12)',
                  pointBackgroundColor: 'rgba(20, 44, 106, 1)',
                  pointRadius: 4,
                  tension: 0.25,
                  fill: true,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    afterLabel: (ctx) => {
                      const n = series.sampleCounts[ctx.dataIndex];
                      return `n = ${n}`;
                    },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: series.metric.unit === 'currency',
                  ticks: {
                    callback: (v) =>
                      series.metric.unit === 'percent'
                        ? `${Number(v).toFixed(1)} %`
                        : `${(Number(v) / 1000).toFixed(0)}k$`,
                  },
                },
              },
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400 text-sm">
            {t(
              'Pas assez de données datées pour tracer une tendance. Élargissez la région ou téléversez des rapports.',
              'Not enough dated data to plot a trend. Widen the region or upload reports.'
            )}
          </div>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] text-slate-600">
        {t(
          'Historique complet (toutes archives) pour la région sélectionnée — préparation analyse comparative de marché (ACM).',
          'Full history (all archives) for the selected region — comparative market analysis (CMA) preparation.'
        )}
      </footer>
    </section>
  );
}
