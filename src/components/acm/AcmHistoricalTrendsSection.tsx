/**
 * Section ACM — tendances historiques par catégorie de dépense (grille multi-graphiques, PDF).
 */

import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
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
      }),
    [ratioSamples, transactions, region, locale, units, subjectExpenses]
  );

  const globalNarrative = useMemo(
    () => buildAcmCostTrendGlobalNarrative(points, locale),
    [points, locale]
  );

  const withSubject = points.filter((p) => (subjectExpenses?.[p.metricKey] ?? 0) > 0);

  if (!points.length) return null;

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
              {t('Tendances historiques par poste de dépense', 'Historical trends by expense line')}
            </h3>
            <p className="text-[12px] text-slate-600 mt-1 max-w-3xl leading-relaxed">
              {t(
                'Courbes médianes GPS (24–36 mois) et coût actuel de la propriété sujet ($ / unité) pour chaque catégorie extraite — transparence complète pour justifier le revenu net d’exploitation (RNE).',
                'GPS regional medians (24–36 months) and current subject cost ($ / unit) for each extracted category — full transparency to support net operating income (NOI).'
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
        className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        data-pdf-layout="acm-trend-grid"
      >
        {(withSubject.length > 0 ? withSubject : points).map((point) => (
          <AcmCostTrendChartCard key={point.metricKey} point={point} locale={locale} t={t} />
        ))}
      </div>

      <footer className="px-5 py-3 border-t border-slate-100 text-[10px] text-slate-500">
        {t(
          `${points.length} poste(s) · source Dashboard GPS · période : 12 derniers trimestres`,
          `${points.length} line item(s) · GPS dashboard source · period: last 12 quarters`
        )}
      </footer>
    </section>
  );
}
