/**
 * Graphique tendance — une catégorie de dépense (capture PDF compatible).
 */

import React, { useMemo } from 'react';
import { useTheme } from '../../lib/useTheme';
import {
  INSTITUTIONAL_CARD_DARK,
  INSTITUTIONAL_INK,
  institutionalListingsCardHeaderClass,
  institutionalListingsCardShellClass,
} from '../../lib/institutionalTheme';
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
  const { theme } = useTheme();
  const title = locale === 'fr' ? point.labelFr : point.labelEn;
  const titleShort = title.replace(/\s*\(\$\s*\/\s*unité?\)\s*$/i, '').trim();

  const chartPalette = useMemo(
    () => ({
      ink: theme === 'light' ? '#0f172a' : INSTITUTIONAL_INK,
      grid: 'rgba(20, 44, 106, 0.15)',
      tooltipBg: theme === 'light' ? '#ffffff' : INSTITUTIONAL_CARD_DARK,
      tooltipBorder: INSTITUTIONAL_INK,
    }),
    [theme]
  );

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

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: chartPalette.tooltipBg,
          titleColor: chartPalette.ink,
          bodyColor: chartPalette.ink,
          borderColor: chartPalette.tooltipBorder,
          borderWidth: 2,
          titleFont: { weight: 'bold' as const, size: 11 },
          bodyFont: { weight: 'bold' as const, size: 11 },
          callbacks: {
            label: (ctx: { parsed: { y: number | null } }) => {
              const v = ctx.parsed.y;
              if (v == null) return '';
              return `${Math.round(v).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')} $`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 0,
            color: chartPalette.ink,
            font: { size: 9, weight: 'bold' as const },
          },
          grid: { color: chartPalette.grid },
        },
        y: {
          ticks: {
            color: chartPalette.ink,
            font: { size: 9, weight: 'bold' as const },
            callback: (v: string | number) =>
              typeof v === 'number' ? `${Math.round(v / 1000)}k` : String(v),
          },
          grid: { color: chartPalette.grid },
        },
      },
    }),
    [chartPalette, locale]
  );

  const gapLabel =
    point.subjectGapPct != null
      ? `${point.subjectGapPct >= 0 ? '+' : ''}${point.subjectGapPct.toFixed(1)} %`
      : null;

  return (
    <article
      className={`${institutionalListingsCardShellClass} flex flex-col`}
      data-pdf-capture={`acm-cost-trend-${point.metricKey}`}
    >
      <header className={`${institutionalListingsCardHeaderClass} px-3 py-2`}>
        <h4 className="text-[11px] font-black leading-tight text-black dark:text-slate-900">
          {titleShort}
        </h4>
        <div className="mt-1 flex flex-wrap gap-2 text-[9px] font-bold text-slate-700">
          {point.trendDeltaPct != null && (
            <span>
              {t('Inflation rég.', 'Reg. infl.')}{' '}
              <span className="text-black dark:text-slate-900">
                {point.trendDeltaPct >= 0 ? '+' : ''}
                {point.trendDeltaPct.toFixed(1)} %
              </span>
            </span>
          )}
          {gapLabel && (
            <span>
              {t('Écart sujet', 'Subject gap')}{' '}
              <span className="font-black text-amber-900">{gapLabel}</span>
            </span>
          )}
        </div>
      </header>

      <div className="flex h-44 min-h-[11rem] flex-1 flex-col bg-white p-2 dark:bg-primexpert-cardDark">
        {point.hasRegionalData ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <p className="px-2 py-10 text-center text-[10px] font-semibold leading-snug text-slate-700">
            {point.subjectPerUnit != null
              ? `${t('Sujet', 'Subject')}: ${Math.round(point.subjectPerUnit).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')} $ / ${t('unité', 'unit')} — ${t('GPS régional indisponible.', 'Regional GPS unavailable.')}`
              : t('Données GPS indisponibles.', 'GPS data unavailable.')}
          </p>
        )}
      </div>
    </article>
  );
}
