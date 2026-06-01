/**
 * Concurrence territoriale — comparables Centris / Matrix (Big Data).
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@primexpert/core/utils/formatting';
import { useLanguage } from '../../../lib/i18n';
import type {
  CentrisComparableListing,
  TerritorialComparableMergeResult,
} from '@primexpert/core/market';
import { inst, InstitutionalSection } from '../institutional/InstitutionalUi';

export interface TerritorialCentrisCompetitionSectionProps {
  loading: boolean;
  error: string | null;
  comparables: CentrisComparableListing[];
  medianTgaPct: number | null;
  sampleCount: number;
  regionAdministrative: string;
  classeImmeuble: string | null;
  filterScope?: TerritorialComparableMergeResult['filterScope'];
}

export function TerritorialCentrisCompetitionSection({
  loading,
  error,
  comparables,
  medianTgaPct,
  sampleCount,
  regionAdministrative,
  classeImmeuble,
  filterScope,
}: TerritorialCentrisCompetitionSectionProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr-CA' : 'en-CA';

  return (
    <InstitutionalSection
      title={t('Concurrence territoriale', 'Territorial competition')}
    >
      <p className="text-sm text-slate-600 leading-relaxed mb-4">
        {t(
          'Comparables vendus issus de listings_cache (Centris Matrix) et market_analytics_raw — filtrés par région administrative et classe d’immeuble, triés par récence.',
          'Sold comparables from listings_cache (Centris Matrix) and market_analytics_raw — filtered by administrative region and building class, sorted by recency.'
        )}
      </p>

      <p className="mb-3 text-[11px] font-semibold text-slate-700">
        {t('Territoire', 'Territory')}: {regionAdministrative || '—'}
        {classeImmeuble ? ` · ${classeImmeuble}` : ''}
        {filterScope ? ` · ${filterScope}` : ''}
        {medianTgaPct != null ? (
          <>
            {' '}
            ·{' '}
            {t(
              'Taux de capitalisation global (TGA) médian dynamique',
              'Dynamic median global capitalization rate (cap rate)'
            )}
            :{' '}
            <span className="font-black text-[#142c6a]">{medianTgaPct.toFixed(2)} %</span>
            {sampleCount ? ` (n=${sampleCount})` : ''}
          </>
        ) : null}
      </p>

      {loading ? (
        <div className={inst.loading}>
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-500" />
          <p className={inst.loadingText}>
            {t('Chargement des comparables…', 'Loading comparables…')}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className={inst.alertAmber} role="status">
          {error}
        </p>
      ) : null}

      {!loading && comparables.length === 0 ? (
        <p className="text-sm text-slate-500">
          {t(
            'Aucun comparable Centris / Matrix pour ce territoire pour le moment.',
            'No Centris / Matrix comparables for this territory yet.'
          )}
        </p>
      ) : null}

      {!loading && comparables.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2">{t('Inscription', 'Listing')}</th>
                <th className="px-3 py-2">{t('Prix vendu', 'Sold price')}</th>
                <th className="px-3 py-2">
                  {t('Revenu brut effectif (RBE)', 'Effective gross income (EGI)')}
                </th>
                <th className="px-3 py-2">
                  {t('Revenu net d’exploitation (RNE)', 'Net operating income (NOI)')}
                </th>
                <th className="px-3 py-2">
                  {t(
                    'Taux de capitalisation global (TGA) (%)',
                    'Global capitalization rate (cap rate) (%)'
                  )}
                </th>
                <th className="px-3 py-2">{t('Clôture', 'Closed')}</th>
              </tr>
            </thead>
            <tbody>
              {comparables.slice(0, 12).map((row) => (
                <tr key={row.mlsNumber} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-[#142c6a]">{row.mlsNumber}</td>
                  <td className="px-3 py-2 tabular-nums">{formatCurrency(row.soldPrice)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.revenuBrutEffectif > 0 ? formatCurrency(row.revenuBrutEffectif) : '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.netOperatingIncome > 0 ? formatCurrency(row.netOperatingIncome) : '—'}
                  </td>
                  <td className="px-3 py-2 font-black tabular-nums">
                    {row.calculatedCapRate.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {row.closedAtMillis
                      ? new Date(row.closedAtMillis).toLocaleDateString(locale)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </InstitutionalSection>
  );
}
