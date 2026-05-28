/**
 * Section ACM — Top 3 tendances (Salaires, Alimentation, Énergie) — une ligne, PDF-ready.
 * Totalement découplée du calcul RNE / valorisation.
 */

import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  ACM_TOP3_TREND_KEYS,
  buildAcmCostTrendGlobalNarrative,
  computeAcmCostTrendPoints,
  type MarketGpsRatioSample,
  type MarketGpsTransaction,
} from '@primexpert/core/market';
import { AcmCostTrendChartCard } from './AcmCostTrendChartCard';
import {
  institutionalListingsCardHeaderClass,
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
} from '../../lib/institutionalTheme';

export interface AcmHistoricalTrendsSectionProps {
  ratioSamples: MarketGpsRatioSample[];
  transactions: MarketGpsTransaction[];
  region?: string | null;
  locale: 'fr' | 'en';
  units: number;
  subjectExpenses?: Partial<Record<string, number>>;
  t: (fr: string, en: string) => string;
}

export function AcmHistoricalTrendsSection({
  ratioSamples,
  transactions,
  region,
  locale,
  units,
  subjectExpenses,
  t,
}: AcmHistoricalTrendsSectionProps) {
  const points = useMemo(
    () =>
      computeAcmCostTrendPoints({
        ratioSamples,
        transactions,
        region: region ?? undefined,
        locale,
        units,
        subjectExpenses,
        metricKeys: [...ACM_TOP3_TREND_KEYS],
      }),
    [ratioSamples, transactions, region, locale, units, subjectExpenses]
  );

  const globalNarrative = useMemo(
    () => buildAcmCostTrendGlobalNarrative(points, locale),
    [points, locale]
  );

  if (!ratioSamples.length) return null;

  return (
    <section
      className={institutionalListingsCardShellClass}
      data-pdf-capture="acm-historical-trends"
    >
      <header className={institutionalListingsCardHeaderClass}>
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-primexpert-dark" aria-hidden />
          <div>
            <p className={institutionalListingsCardTitleClass}>
              {t('Analyse des tendances — inflation régionale', 'Trend analysis — regional inflation')}
            </p>
            <h3 className="mt-1 text-lg font-black text-black dark:text-slate-900">
              {t('Tendances — postes critiques', 'Trends — critical expense lines')}
            </h3>
            <p className="mt-1 max-w-3xl text-[12px] font-semibold leading-relaxed text-slate-800">
              {t(
                'Salaires et charges sociales, alimentation et énergie — médiane régionale GPS (24–36 mois) vs propriété sujet. Cette section n’affecte pas le calcul du revenu net d’exploitation (RNE).',
                'Salaries & benefits, food and energy — regional GPS median (24–36 months) vs. subject property. This section does not affect net operating income (NOI) calculation.'
              )}
            </p>
          </div>
        </div>
      </header>

      {globalNarrative && (
        <div className="border-b-2 border-amber-200 bg-amber-50 px-5 py-4 text-[13px] font-semibold leading-relaxed text-slate-900 dark:bg-amber-100">
          {globalNarrative}
        </div>
      )}

      <div
        className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4"
        data-pdf-layout="acm-trend-top3"
      >
        {points.map((point) => (
          <AcmCostTrendChartCard key={point.metricKey} point={point} locale={locale} t={t} />
        ))}
      </div>
    </section>
  );
}
