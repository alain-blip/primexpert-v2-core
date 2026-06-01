/**
 * Panneau ACM intégré à la fiche résidence — exige financial/dataV2 validé.
 */

import React, { useMemo } from 'react';
import { buildBrokerFooterFromProfile } from '../../../services/certifiableReportPdfService';
import { AlertTriangle } from 'lucide-react';
import { bootstrapResidenceAcm } from '@primexpert/core/valuation';
import type { FinancialDataV2Doc, ResidenceFinancialHints } from '@primexpert/core/financial';
import { useLanguage } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { useMarketData } from '../../../hooks/useMarketData';
import { useGlobalFinancialBenchmark } from '../../../hooks/useGlobalFinancialBenchmark';
import { getListingPrice } from '@primexpert/core/residence';
import type { Residence } from '../../../services/residences';
import { AcmValuationWorkspace } from '../../acm/AcmValuationWorkspace';
import { AcmTab } from './AcmTab';
import {
  institutionalListingsCardHeaderClass,
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
  institutionalListingsFailSafeClass,
} from '../../../lib/institutionalTheme';

export interface ResidenceAcmValuationPanelProps {
  residence: Residence;
  onOpenComparables?: () => void;
}

export function ResidenceAcmValuationPanel({
  residence,
  onOpenComparables,
}: ResidenceAcmValuationPanelProps) {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const { financialData, loading, error } = useFinancialData();
  const { residenceDoc } = useResidenceDocument();
  const { transactions: marketTransactions, ratioSamples } = useMarketData(language, profile?.uid ?? null);

  const residenceLive = useMemo((): Residence => {
    const merged = { ...residence, ...(residenceDoc ?? {}) } as Residence & Record<string, unknown>;
    const listingPrice = getListingPrice(merged);
    if (listingPrice <= 0) return residence;
    return {
      ...residence,
      price: listingPrice,
      askingPrice: listingPrice,
      prixDemande: listingPrice,
    };
  }, [residence, residenceDoc]);

  const subjectExpenses = useMemo(() => {
    const depenses = (financialData as FinancialDataV2Doc | null)?.baseData?.depenses;
    if (!depenses || typeof depenses !== 'object') return undefined;
    const out: Record<string, number> = {};
    for (const [key, val] of Object.entries(depenses)) {
      if (key === 'autresDepenses' || key === 'nonOpexExcluded') continue;
      const n = typeof val === 'number' ? val : Number(val);
      if (Number.isFinite(n) && n > 0) out[key] = n;
    }
    return Object.keys(out).length ? out : undefined;
  }, [financialData]);

  const bootstrap = useMemo(() => {
    if (!financialData) return null;
    return bootstrapResidenceAcm(
      residenceLive,
      residenceDoc ?? undefined,
      financialData as FinancialDataV2Doc,
      { marketTransactions }
    );
  }, [residenceLive, residenceDoc, financialData, marketTransactions]);

  const benchmarkState = useGlobalFinancialBenchmark(Boolean(bootstrap), {
    regionAdministrative: bootstrap?.regionLabel ?? null,
    assetClassLabel: bootstrap?.assetClassLabel ?? null,
  });

  const pdfExport = useMemo(() => {
    if (!financialData) return undefined;
    const addressParts = [residenceLive.address, residenceLive.city].filter(Boolean);
    const locale: 'fr' | 'en' = language === 'fr' ? 'fr' : 'en';
    return {
      residenceId: residenceLive.id,
      residenceAddress: addressParts.length ? addressParts.join(', ') : undefined,
      broker: buildBrokerFooterFromProfile(profile),
      locale,
      financialData: financialData as FinancialDataV2Doc,
      residence: residenceLive as unknown as ResidenceFinancialHints,
    };
  }, [residenceLive, financialData, profile, language]);

  if (loading) {
    return (
      <div className={institutionalListingsFailSafeClass}>
        <p className="text-sm font-bold text-slate-900">
          {t('Chargement des états financiers…', 'Loading financial statements…')}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border-2 border-red-400 bg-red-50 px-5 py-4 text-sm font-bold text-red-900">
        {t('Erreur Firestore', 'Firestore error')}: {error.message}
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-amber-950"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.16em]">
            {t(
              'États financiers requis pour l’analyse de mise en marché (ACM)',
              'Financial statements required for market launch analysis (CMA)'
            )}
          </p>
          <p className="text-[14px] leading-relaxed">
            {t(
              'Complétez et validez la grille financière V2 (onglet Finances) avant de lancer l’analyse de mise en marché (ACM). Les revenus brut effectif (RBE) et net d’exploitation (RNE) proviennent exclusivement de financial/dataV2.calculatedResults.',
              'Complete and validate the V2 financial grid (Finance tab) before launching the market launch analysis (CMA). Effective gross income (EGI) and net operating income (NOI) come exclusively from financial/dataV2.calculatedResults.'
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className={institutionalListingsCardShellClass}>
        <header className={institutionalListingsCardHeaderClass}>
          <h3 className={institutionalListingsCardTitleClass}>
            {t(
              'Analyse comparative de marché (ACM) — valorisation',
              'Comparative market analysis (CMA) — valuation'
            )}
          </h3>
        </header>
        <div className="p-4 sm:p-5">
          <AcmValuationWorkspace
            bootstrap={bootstrap}
            onOpenComparables={onOpenComparables}
            compact
            ratioSamples={ratioSamples}
            transactions={marketTransactions}
            subjectExpenses={subjectExpenses}
            pdfExport={pdfExport}
            territorialMedians={benchmarkState.territorialMedians ?? undefined}
          />
        </div>
      </section>
      <AcmTab residence={residenceLive} />
    </div>
  );
}
