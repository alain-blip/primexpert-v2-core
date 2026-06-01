/**
 * Rapports financiers PDF — analyse vendeur (Sprint 0 ACM).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { useFinancialData } from '../../context/FinancialDataContext';
import {
  buildBrokerFooterFromProfile,
} from '../../services/certifiableReportPdfService';
import { downloadSellerListingAnalysisPdf } from '../../services/sellerListingAnalysisPdfService';
import type { Residence } from '../../services/residences';
import {
  computePenetrationRate75,
  parseCompetitorsList,
  resolveMarcheDemographics,
  sumSectorRpaUnits,
  getSubjectUnitCount,
} from '@primexpert/core/market';
import { useResidenceFinancialHints } from '../../context/ResidenceDataContext';

const GOLD_BTN =
  'inline-flex items-center justify-center gap-2 rounded-lg border-2 border-black bg-[#D4AF37] px-4 py-3 text-[13px] font-black text-black hover:bg-[#c9a432] transition disabled:opacity-50 disabled:cursor-not-allowed';

export interface FinancialReportsSectionProps {
  residence: Residence;
}

export function FinancialReportsSection({ residence }: FinancialReportsSectionProps) {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const { financialData, loading } = useFinancialData();
  const financialHints = useResidenceFinancialHints(residence);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canExport = Boolean(financialData?.calculatedResults) && !loading;

  const penetrationRate = useMemo(() => {
    const competitors = parseCompetitorsList(residence as unknown as Record<string, unknown>);
    const demographics = resolveMarcheDemographics(residence as unknown as Record<string, unknown>);
    const subjectUnits = getSubjectUnitCount(residence as unknown as Record<string, unknown>);
    const sectorUnits = sumSectorRpaUnits(competitors, subjectUnits);
    const pop75 = demographics.population75_plus;
    if (pop75 == null) return null;
    return computePenetrationRate75(sectorUnits, pop75);
  }, [residence]);

  const handleSellerPdf = useCallback(() => {
    setError(null);
    if (!financialData?.calculatedResults) {
      setError(
        t(
          'Complétez la grille financière V2 (calculatedResults).',
          'Complete the V2 financial grid (calculatedResults).'
        )
      );
      return;
    }
    setPending(true);
    try {
      downloadSellerListingAnalysisPdf({
        locale: language === 'fr' ? 'fr' : 'en',
        financialData,
        residence: {
          id: residence.id,
          address: residence.address,
          city: residence.city,
          residenceName: residence.residenceName,
          nomCommercial: residence.nomCommercial,
          name: residence.name,
          prixDemande: financialHints.prixDemande,
          askingPrice: financialHints.askingPrice,
          price: financialHints.price,
          nombreUnites: financialHints.nombreUnites ?? residence.nicheMetadata?.nombreUnites,
          nombreUnitesTotal:
            financialHints.nombreUnitesTotal ?? residence.nicheMetadata?.nombreUnites,
          region: residence.region,
        },
        broker: buildBrokerFooterFromProfile(profile),
        penetrationRate,
      });
    } catch (e) {
      console.error('[FinancialReportsSection] seller PDF failed', e);
      setError(
        t(
          'Échec de génération du rapport vendeur.',
          'Seller report generation failed.'
        )
      );
    } finally {
      setPending(false);
    }
  }, [financialData, residence, financialHints, profile, language, penetrationRate, t]);

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white px-6 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-slate-700" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#142c6a]">
          {t('Analyse vendeur & mise en marché', 'Seller listing analysis')}
        </p>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">
        {t(
          'Générez l’analyse de valeur et la stratégie de mise en marché (scénarios d’occupation, ajustement du taux de capitalisation (TGA), prix recommandé). Document non-évaluation agréée.',
          'Generate value analysis and go-to-market strategy (occupancy scenarios, cap rate adjustment, recommended price). Not a certified appraisal.'
        )}
      </p>
      <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
        <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          {t('Scénarios 85 / 90 / 100 %', '85 / 90 / 100% scenarios')}
        </li>
        <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          {t('Ajustement TGA pénétration', 'Penetration cap rate adj.')}
        </li>
        <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          {t('Stratégie de prix conservatrice', 'Conservative pricing')}
        </li>
      </ul>
      <div className="mt-4">
        <button
          type="button"
          className={GOLD_BTN}
          disabled={!canExport || pending}
          onClick={handleSellerPdf}
        >
          <FileText className="h-4 w-4" />
          {pending
            ? t('Génération…', 'Generating…')
            : t('Générer le PDF vendeur', 'Generate seller PDF')}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-[13px] font-bold text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
