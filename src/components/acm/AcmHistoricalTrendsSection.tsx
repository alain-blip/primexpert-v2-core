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
      className="rounded-[28px] border-2 border-slate-300 bg-white shadow-sm overflow-hidden"
      data-pdf-capture="acm-historical-trends"
    >
      <header className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-[#142c6a] shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {t('Analyse des tendances — inflation régionale', 'Trend analysis — regional inflation')}
            </p>
            <h3 className="text-lg font-black text-[#142c6a]">
              {t('Tendances — postes critiques', 'Trends — critical expense lines')}
            </h3>
            <p className="text-[12px] text-slate-600 mt-1 max-w-3xl leading-relaxed">
              {t(
                'Salaires et charges sociales, alimentation et énergie — médiane régionale GPS (24–36 mois) vs propriété sujet. Cette section n’affecte pas le calcul du revenu net d’exploitation (RNE).',
                'Salaries & benefits, food and energy — regional GPS median (24–36 months) vs. subject property. This section does not affect net operating income (NOI) calculation.'
              )}
            </p>
          </div>
        </div>
      </header>

      {globalNarrative && (
        <div className="px-5 py-4 bg-amber-50/70 border-b border-amber-100 text-[13px] leading-relaxed text-slate-800">
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
