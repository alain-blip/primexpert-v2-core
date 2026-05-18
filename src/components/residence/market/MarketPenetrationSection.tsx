/**
 * Taux de pénétration du marché (75 ans +) — secteur Haversine.
 */

import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  computePenetrationRate75,
  formatPenetrationPercent,
  formatPopulationCount,
  parseCompetitorsList,
  resolveMarcheDemographics,
  sumSectorRpaUnits,
  getSubjectUnitCount,
} from '@primexpert/core/market';
import { useLanguage } from '../../../lib/i18n';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { InstitutionalKpi, InstitutionalSection } from '../institutional/InstitutionalUi';

export function MarketPenetrationSection() {
  const { t, language } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';
  const { residenceDoc } = useResidenceDocument();

  const competitors = useMemo(
    () => parseCompetitorsList(residenceDoc),
    [residenceDoc]
  );
  const demographics = useMemo(() => resolveMarcheDemographics(residenceDoc), [residenceDoc]);

  const subjectUnits = useMemo(() => getSubjectUnitCount(residenceDoc), [residenceDoc]);
  const sectorUnits = useMemo(
    () => sumSectorRpaUnits(competitors, subjectUnits),
    [competitors, subjectUnits]
  );

  const population75 = demographics.population75_plus;
  const rate = useMemo(
    () =>
      population75 != null ? computePenetrationRate75(sectorUnits, population75) : null,
    [sectorUnits, population75]
  );

  const radiusKm =
    residenceDoc?.marketScope &&
    typeof residenceDoc.marketScope === 'object' &&
    'radiusKm' in (residenceDoc.marketScope as object)
      ? Number((residenceDoc.marketScope as { radiusKm: number }).radiusKm)
      : null;

  return (
    <InstitutionalSection
      title={t('Taux de pénétration du marché', 'Market penetration rate')}
    >
      <div className="space-y-5">
        <p className="text-sm text-slate-600 leading-relaxed">
          {t(
            'Indicateur de maturité RPA pour la souscription : offre sectorielle (portes) rapportée à la clientèle potentielle 75 ans et plus.',
            'RPA maturity indicator for underwriting: sector supply (doors) vs potential clientele aged 75+.'
          )}
        </p>

        <div className="rounded-xl border border-slate-200 bg-white px-5 py-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-[#D4AF37]" />
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#000000]">
              {t('Taux de pénétration (75 ans +)', 'Penetration rate (75+)')}
            </p>
          </div>

          <p className="text-4xl font-black text-[#000000] tabular-nums tracking-tight">
            {formatPenetrationPercent(rate)}
          </p>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-[#000000] font-semibold">
            <span className="tabular-nums">
              [{formatPopulationCount(sectorUnits > 0 ? sectorUnits : null)}{' '}
              {t('unités RPA du secteur', 'sector RPA units')}]
            </span>
            <span className="text-slate-400 font-normal">÷</span>
            <span className="tabular-nums">
              [{formatPopulationCount(population75)}{' '}
              {t('hab. 75 ans et plus', 'pop. aged 75+')}]
            </span>
            {rate != null && (
              <>
                <span className="text-slate-400 font-normal">=</span>
                <span className="font-black">{formatPenetrationPercent(rate)}</span>
              </>
            )}
          </div>

          {demographics.population75_source === 'regional_reference' && (
            <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">
              {t(
                `Population 75+ : repère régional${demographics.regionalName ? ` (${demographics.regionalName})` : ''} en attente de saisie municipale. Mettez à jour le bassin démographique ci-dessous pour affiner le calcul.`,
                `75+ population: regional reference${demographics.regionalName ? ` (${demographics.regionalName})` : ''} until municipal data is entered. Update the demographic basin below to refine.`
              )}
            </p>
          )}

          {population75 == null && (
            <p className="mt-3 text-sm text-[#000000]">
              {t(
                'Renseignez la population 75 ans et plus (section bassin démographique) ou actualisez les comparables pour estimer le secteur.',
                'Enter the 75+ population (demographic basin section) or refresh comparables to estimate the sector.'
              )}
            </p>
          )}

          {radiusKm != null && !Number.isNaN(radiusKm) && (
            <p className="mt-2 text-[10px] font-mono text-slate-500">
              {t('Périmètre sectoriel', 'Sector perimeter')}: {radiusKm} km · Haversine
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InstitutionalKpi
            label={t('Portes — secteur', 'Doors — sector')}
            value={formatPopulationCount(sectorUnits > 0 ? sectorUnits : null)}
          />
          <InstitutionalKpi
            label={t('Dont résidence analysée', 'Including subject property')}
            value={formatPopulationCount(subjectUnits > 0 ? subjectUnits : null)}
          />
          <InstitutionalKpi
            label={t('Comparables dans le périmètre', 'Comparables in scope')}
            value={String(competitors.length)}
          />
        </div>
      </div>
    </InstitutionalSection>
  );
}
