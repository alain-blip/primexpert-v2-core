/**
 * Tendances coûts régionaux — ACM (courbe marché + point propriété sujet).
 * Chart.js — compatible capture PDF (canvas).
 */

import React, { useMemo, useState } from 'react';
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
  computeAcmCostTrendPoints,
  type AcmCostTrendPoint,
  type MarketGpsRatioSample,
  type MarketGpsTransaction,
  type TrendMetricKey,
} from '@primexpert/core/market';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const MAX_PERIODS = 12;

function sliceRecentSeries(point: AcmCostTrendPoint): AcmCostTrendPoint {
  const start = Math.max(0, point.series.labels.length - MAX_PERIODS);
  return {
    ...point,
    series: {
      ...point.series,
      labels: point.series.labels.slice(start),
      values: point.series.values.slice(start),
      sampleCounts: point.series.sampleCounts.slice(start),
    },
  };
}

export interface AcmCostTrendPanelProps {
  ratioSamples: MarketGpsRatioSample[];
  transactions: MarketGpsTransaction[];
  region?: string | null;
  locale: 'fr' | 'en';
  units: number;
  subjectExpenses?: Partial<Record<string, number>>;
  t: (fr: string, en: string) => string;
}

export function AcmCostTrendPanel({
  ratioSamples,
  transactions,
  region,
  locale,
  units,
  subjectExpenses,
  t,
}: AcmCostTrendPanelProps) {
  const [metricKey, setMetricKey] = useState<TrendMetricKey>('salairesAvantages');

  const points = useMemo(
    () =>
      computeAcmCostTrendPoints({
        ratioSamples,
        transactions,
        region: region ?? undefined,
        locale,
        units,
        subjectExpenses,
      }),
    [ratioSamples, transactions, region, locale, units, subjectExpenses]
  );

  const active = useMemo(() => {
    const raw = points.find((p) => p.metricKey === metricKey) ?? points[0];
    return raw ? sliceRecentSeries(raw) : null;
  }, [points, metricKey]);

  const hasRegional = active?.series.values.some((v) => v != null) ?? false;

  const chartData = useMemo(() => {
    if (!active) return null;
    const labels = active.series.labels;
    const regionalData = active.series.values;

    const subjectLine =
      active.subjectPerUnit != null
        ? labels.map(() => active.subjectPerUnit)
        : labels.map(() => null);

    return {
      labels,
      datasets: [
        {
          label: t('Médiane régionale', 'Regional median'),
          data: regionalData,
          borderColor: 'rgba(20, 44, 106, 0.9)',
          backgroundColor: 'rgba(20, 44, 106, 0.08)',
          pointBackgroundColor: 'rgba(20, 44, 106, 1)',
          pointRadius: 4,
          tension: 0.25,
          fill: true,
        },
        {
          label: t('Propriété sujet ($ / unité)', 'Subject property ($ / unit)'),
          data: subjectLine,
          borderColor: 'rgba(212, 175, 55, 1)',
          backgroundColor: 'rgba(212, 175, 55, 0.15)',
          pointBackgroundColor: 'rgba(212, 175, 55, 1)',
          pointRadius: 5,
          borderDash: [6, 4],
          tension: 0,
          fill: false,
        },
      ],
    };
  }, [active, t]);

  const narrative = locale === 'fr' ? active?.narrativeFr : active?.narrativeEn;

  return (
    <section
      className="rounded-xl border-2 border-slate-300 bg-white shadow-sm overflow-hidden"
      data-pdf-capture="acm-cost-trend"
    >
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-end gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {t('Analyse des tendances — inflation régionale', 'Trend analysis — regional inflation')}
          </p>
          <h3 className="text-sm font-black text-[#142c6a]">
            {t('Évolution des coûts d’exploitation (GPS)', 'Operating cost trends (GPS)')}
          </h3>
        </div>
        <label className="flex flex-col gap-1 ml-auto">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {t('Poste de dépense', 'Expense line')}
          </span>
          <select
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value as TrendMetricKey)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900"
          >
            {TREND_METRIC_OPTIONS.filter((o) =>
              ['salairesAvantages', 'energie', 'entretienReparation', 'nourritures', 'assurances'].includes(
                o.key
              )
            ).map((opt) => (
              <option key={opt.key} value={opt.key}>
                {locale === 'fr' ? opt.labelFr : opt.labelEn}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="p-4 h-72">
        {hasRegional && chartData ? (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const v = ctx.parsed.y;
                      if (v == null) return '';
                      return `${ctx.dataset.label}: ${Math.round(v).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')} $`;
                    },
                  },
                },
              },
              scales: {
                y: {
                  ticks: {
                    callback: (v) =>
                      typeof v === 'number'
                        ? `${Math.round(v).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')}`
                        : v,
                  },
                },
              },
            }}
          />
        ) : (
          <p className="text-sm text-slate-500 py-8 text-center">
            {t(
              'Données GPS insuffisantes pour cette région et ce poste.',
              'Insufficient GPS data for this region and line item.'
            )}
          </p>
        )}
      </div>

      {narrative && (
        <footer className="border-t border-slate-200 bg-amber-50/60 px-4 py-3 text-[13px] leading-relaxed text-slate-800">
          {narrative}
          {active?.trendDeltaPct != null && (
            <span className="ml-1 font-semibold text-[#142c6a]">
              ({active.trendDeltaPct >= 0 ? '+' : ''}
              {active.trendDeltaPct.toFixed(1)} %)
            </span>
          )}
        </footer>
      )}
    </section>
  );
}
