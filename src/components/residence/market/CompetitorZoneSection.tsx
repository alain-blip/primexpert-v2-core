/**
 * Pilier 1 — Concurrence de zone (comparables Haversine).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { BarChart3, Loader2, MapPin, RefreshCw } from 'lucide-react';
import {
  competitorDisplayName,
  competitorUnits,
  MIN_COMPETITORS_TARGET,
  parseCompetitorsList,
  parseMarketScope,
  type MarketCompetitorRow,
} from '@primexpert/core/market';
import { MajorCompetitorsLeaderboard } from './MajorCompetitorsLeaderboard';
import { formatCurrency } from '@primexpert/core/utils/formatting';
import { useLanguage } from '../../../lib/i18n';
import { cn } from '../../../lib/utils';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { scanMarketCompetitors } from '../../../services/marketCompetitorScan';
import {
  inst,
  InstitutionalKpi,
  InstitutionalSection,
} from '../institutional/InstitutionalUi';

const SCOPE_LABELS = {
  fr: { strict: 'Strict', expanded: 'Élargi', regional: 'Régional' },
  en: { strict: 'Strict', expanded: 'Expanded', regional: 'Regional' },
} as const;

export function CompetitorZoneSection() {
  const { t, language } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';
  const { residenceDoc, residenceId, updateResidence, saving } = useResidenceDocument();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const competitors = useMemo(
    () => parseCompetitorsList(residenceDoc),
    [residenceDoc]
  );
  const marketScope = useMemo(() => parseMarketScope(residenceDoc), [residenceDoc]);

  const lat = Number(residenceDoc?.latitude);
  const lng = Number(residenceDoc?.longitude);
  const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0;

  const scopeMessage =
    typeof residenceDoc?.marketScopeMessageClient === 'string'
      ? residenceDoc.marketScopeMessageClient
      : null;

  const lastAnalysis =
    typeof residenceDoc?.marketAnalysisUpdatedAt === 'string'
      ? residenceDoc.marketAnalysisUpdatedAt
      : null;

  const handleScan = useCallback(async () => {
    if (!residenceId || !hasCoords) return;
    setScanning(true);
    setScanError(null);
    setScanMessage(null);
    try {
      const patch = await scanMarketCompetitors(residenceId, lat, lng, lang);
      await updateResidence(patch);
      const msg =
        typeof patch.marketScopeMessageClient === 'string'
          ? patch.marketScopeMessageClient
          : t('Analyse terminée.', 'Analysis complete.');
      setScanMessage(msg);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }, [residenceId, hasCoords, lat, lng, lang, updateResidence, t]);

  const kpis = useMemo(() => {
    const n = residenceDoc?.nombreResidencesConcurrentes;
    const units = residenceDoc?.nombreUnitesDisponiblesMarche;
    const vacance = residenceDoc?.tauxVacanceMarche ?? residenceDoc?.tauxVacanceMarcheEstime;
    const prix = residenceDoc?.prixParUniteMarche ?? residenceDoc?.prixParUniteMarcheEstime;
    return {
      count: n != null ? String(n) : '—',
      units: units != null ? String(units) : '—',
      vacance: vacance != null ? `${vacance} %` : '—',
      prix:
        prix != null && !Number.isNaN(Number(prix))
          ? formatCurrency(Number(prix))
          : '—',
    };
  }, [residenceDoc]);

  return (
    <InstitutionalSection
      title={t('Pilier 1 — Concurrence de zone', 'Pillar 1 — Zone competition')}
    >
      <div className="space-y-5">
        <p className="text-sm text-slate-600 leading-relaxed">
          {t(
            'Identification des RPA comparables par recherche progressive (5 à 50 km, formule Haversine). Données consolidées pour la diligence commerciale.',
            'Comparable RPAs via progressive radius search (5–50 km, Haversine). Consolidated for commercial diligence.'
          )}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleScan()}
            disabled={scanning || saving || !hasCoords}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] transition',
              hasCoords
                ? 'border-slate-300 bg-white text-[#000000] hover:border-[#D4AF37]/50'
                : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
            )}
          >
            {scanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {scanning
              ? t('Analyse en cours…', 'Scanning…')
              : t('Actualiser les comparables', 'Refresh comparables')}
          </button>
          {!hasCoords && (
            <span className="text-[10px] text-slate-500 font-medium">
              {t(
                'Coordonnées GPS requises (onglet Identité ou géocodage).',
                'GPS coordinates required (Identity tab or geocoding).'
              )}
            </span>
          )}
        </div>

        {scanError && (
          <p className={inst.alertRed}>{scanError}</p>
        )}
        {scanMessage && !scanError && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#000000]">
            {scanMessage}
          </p>
        )}

        {marketScope && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            <MapPin className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span className="text-[#000000]">
              {t('Périmètre', 'Scope')}: {marketScope.radiusKm} km ·{' '}
              {SCOPE_LABELS[lang][marketScope.level]}
            </span>
            {lastAnalysis && (
              <span className="text-slate-500 font-mono normal-case">
                · {new Date(lastAnalysis).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')}
              </span>
            )}
          </div>
        )}

        {scopeMessage && (
          <p className="text-sm text-[#000000] leading-relaxed border-l-2 border-[#D4AF37] pl-4">
            {scopeMessage}
          </p>
        )}

        {competitors.length > 0 && competitors.length < MIN_COMPETITORS_TARGET && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#000000] leading-relaxed">
            {t(
              'Échantillon local restreint. Périmètre élargi automatiquement pour assurer la représentativité de la vérification.',
              'Limited local sample. Perimeter automatically expanded to ensure a representative verification scope.'
            )}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InstitutionalKpi
            label={t('Résidences comparables', 'Comparable residences')}
            sublabel={
              marketScope?.radiusKm
                ? t(`Rayon ${marketScope.radiusKm} km`, `${marketScope.radiusKm} km radius`)
                : undefined
            }
            value={kpis.count}
          />
          <InstitutionalKpi
            label={t('Unités — marché local', 'Units — local market')}
            value={kpis.units}
          />
          <InstitutionalKpi
            label={t('Vacance marché estimée', 'Estimated market vacancy')}
            value={kpis.vacance}
          />
          <InstitutionalKpi
            label={t('Prix / unité — marché', 'Price / unit — market')}
            value={kpis.prix}
          />
        </div>

        {competitors.length > 0 ? (
          <>
            <MajorCompetitorsLeaderboard competitors={competitors} />
            <CompetitorsTable competitors={competitors} lang={lang} t={t} />
          </>
        ) : marketScope?.level === 'regional' ? (
          <div className={inst.note}>
            <p className="text-sm text-[#000000] font-semibold mb-1">
              {t('Repère régional', 'Regional benchmark')}
            </p>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              {t(
                'Aucune comparable stricte dans les rayons 5, 10, 25 et 50 km. Une analyse qualitative complémentaire est recommandée.',
                'No strict comparable within 5, 10, 25 or 50 km. Supplementary qualitative analysis recommended.'
              )}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
            <BarChart3 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600">
              {t(
                'Lancez l’actualisation pour générer le tableau comparatif.',
                'Run refresh to build the comparison table.'
              )}
            </p>
          </div>
        )}
      </div>
    </InstitutionalSection>
  );
}

function CompetitorsTable({
  competitors,
  lang,
  t,
}: {
  competitors: MarketCompetitorRow[];
  lang: 'fr' | 'en';
  t: (fr: string, en: string) => string;
}) {
  return (
    <div className={inst.tableWrap}>
      <table className={inst.table}>
        <thead>
          <tr>
            <th className={inst.th}>#</th>
            <th className={inst.th}>{t('Résidence', 'Residence')}</th>
            <th className={inst.thRight}>{t('Distance', 'Distance')}</th>
            <th className={inst.thRight}>{t('Unités', 'Units')}</th>
            <th className={inst.thRight}>{t('Occupation', 'Occupancy')}</th>
            <th className={inst.thRight}>{t('Prix demandé', 'Asking price')}</th>
            <th className={inst.thRight}>{t('Revenus annuels', 'Annual revenue')}</th>
          </tr>
        </thead>
        <tbody>
          {competitors.map((comp, index) => {
            const prix = comp.prixDemande ?? comp.prixAnnonce ?? comp.askingPrice;
            const revenus = comp.revenusAnnuelsBruts ?? comp.revenusAnnuels;
            const taux =
              comp.tauxOccupation != null ? `${comp.tauxOccupation} %` : '—';
            const dist =
              comp._distanceKm != null ? `${comp._distanceKm} km` : '—';

            return (
              <tr key={comp.id} className={inst.tr}>
                <td className={inst.td}>{index + 1}</td>
                <td className="px-4 py-2.5 font-semibold text-[#000000]">
                  {competitorDisplayName(comp)}
                  {(comp.city || comp.address || comp.adresse) && (
                    <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                      {String(comp.city ?? comp.address ?? comp.adresse ?? '')}
                    </span>
                  )}
                </td>
                <td className={inst.tdValueMono}>{dist}</td>
                <td className={inst.tdValue}>{competitorUnits(comp)}</td>
                <td className={inst.tdValue}>{taux}</td>
                <td className={inst.tdValue}>
                  {prix != null ? formatCurrency(Number(prix)) : '—'}
                </td>
                <td className={inst.tdValue}>
                  {revenus != null ? formatCurrency(Number(revenus)) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
