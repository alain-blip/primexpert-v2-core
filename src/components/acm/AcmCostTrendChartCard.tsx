/**
 * Graphique tendance — une catégorie de dépense (capture PDF compatible).
 */

import React, { useMemo } from 'react';
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
import type { AcmCostTrendPoint } from '@primexpert/core/market';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export interface AcmCostTrendChartCardProps {
  point: AcmCostTrendPoint;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
}

export function AcmCostTrendChartCard({ point, locale, t }: AcmCostTrendChartCardProps) {
  const title = locale === 'fr' ? point.labelFr : point.labelEn;
  const titleShort = title.replace(/\s*\(\$\s*\/\s*unité?\)\s*$/i, '').trim();

  const chartData = useMemo(() => {
    const labels = point.series.labels;
    const subjectLine =
      point.subjectPerUnit != null
        ? labels.map(() => point.subjectPerUnit)
        : labels.map(() => null);

    return {
      labels,
      datasets: [
        {
          label: t('Médiane régionale', 'Regional median'),
          data: point.series.values,
          borderColor: 'rgba(20, 44, 106, 0.85)',
          backgroundColor: 'rgba(20, 44, 106, 0.06)',
          pointRadius: 3,
          tension: 0.25,
          fill: true,
        },
        {
          label: t('Sujet', 'Subject'),
          data: subjectLine,
          borderColor: 'rgba(212, 175, 55, 1)',
          pointRadius: 4,
          borderDash: [5, 4],
          tension: 0,
          fill: false,
        },
      ],
    };
  }, [point, t]);

  const gapLabel =
    point.subjectGapPct != null
      ? `${point.subjectGapPct >= 0 ? '+' : ''}${point.subjectGapPct.toFixed(1)} %`
      : null;

  return (
    <article
      className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col"
      data-pdf-capture={`acm-cost-trend-${point.metricKey}`}
    >
      <header className="px-3 py-2 border-b border-slate-100 bg-slate-50/80">
        <h4 className="text-[11px] font-black text-[#142c6a] leading-tight">{titleShort}</h4>
        <div className="flex flex-wrap gap-2 mt-1 text-[9px] font-semibold text-slate-500">
          {point.trendDeltaPct != null && (
            <span>
              {t('Inflation rég.', 'Reg. infl.')}{' '}
              <span className="text-[#142c6a]">
                {point.trendDeltaPct >= 0 ? '+' : ''}
                {point.trendDeltaPct.toFixed(1)} %
              </span>
            </span>
          )}
          {gapLabel && (
            <span>
              {t('Écart sujet', 'Subject gap')} <span className="text-amber-800">{gapLabel}</span>
            </span>
          )}
        </div>
      </header>

      <div className="p-2 h-44 flex-1 min-h-[11rem]">
        {point.hasRegionalData ? (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const v = ctx.parsed.y;
                      if (v == null) return '';
                      return `${Math.round(v).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')} $`;
                    },
                  },
                },
              },
              scales: {
                x: { ticks: { maxRotation: 0, font: { size: 8 } } },
                y: {
                  ticks: {
                    font: { size: 8 },
                    callback: (v) =>
                      typeof v === 'number'
                        ? `${Math.round(v / 1000)}k`
                        : String(v),
                  },
                },
              },
            }}
          />
        ) : (
          <p className="text-[10px] text-slate-400 text-center py-10 px-2 leading-snug">
            {point.subjectPerUnit != null
              ? `${t('Sujet', 'Subject')}: ${Math.round(point.subjectPerUnit).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')} $ / ${t('unité', 'unit')} — ${t('GPS régional indisponible.', 'Regional GPS unavailable.')}`
              : t('Données GPS indisponibles.', 'GPS data unavailable.')}
          </p>
        )}
      </div>
    </article>
  );
}
