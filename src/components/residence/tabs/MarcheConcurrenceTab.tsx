/**
 * Marché & Concurrence — 3 piliers (zone, diagnostic territorial, registre visiteurs).
 * SSOT : @primexpert/core/market + ResidenceDocumentContext.
 */

import React from 'react';
import { useLanguage } from '../../../lib/i18n';
import type { Residence } from '../../../services/residences';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { inst } from '../institutional/InstitutionalUi';
import { CompetitorZoneSection } from '../market/CompetitorZoneSection';
import { MarketPenetrationSection } from '../market/MarketPenetrationSection';
import { TerritorialDiagnosticSection } from '../market/TerritorialDiagnosticSection';
import { VisitorRegistrySection } from '../market/VisitorRegistrySection';
import { WorkforceBasinSection } from '../market/WorkforceBasinSection';
import { ResidenceAcmValuationPanel } from '../market/ResidenceAcmValuationPanel';
import { FinancialDataProvider } from '../../../context/FinancialDataContext';

export interface MarcheConcurrenceTabProps {
  residence: Residence;
}

export function MarcheConcurrenceTab({ residence }: MarcheConcurrenceTabProps) {
  const { t } = useLanguage();
  const { residenceDoc, loading, error, isInProvider, saveError } = useResidenceDocument();

  if (!isInProvider) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        {t(
          'Provider document résidence manquant.',
          'Residence document provider missing.'
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className={inst.loading}>
        <p className={inst.loadingText}>
          {t('Chargement du marché…', 'Loading market data…')}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-900">
        {t('Erreur Firestore', 'Firestore error')}: {error.message}
      </div>
    );
  }

  return (
    <div className={inst.page}>
      {saveError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {saveError}
        </p>
      )}

      <FinancialDataProvider residenceId={residence.id}>
        <ResidenceAcmValuationPanel residence={residence} />
      </FinancialDataProvider>
      <MarketPenetrationSection />
      <CompetitorZoneSection />
      <WorkforceBasinSection />
      <TerritorialDiagnosticSection />
      <VisitorRegistrySection />
    </div>
  );
}
