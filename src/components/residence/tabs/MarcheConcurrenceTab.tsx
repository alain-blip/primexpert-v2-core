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
import {
  institutionalListingsFailSafeClass,
  institutionalListingsPanelClass,
} from '../../../lib/institutionalTheme';

export interface MarcheConcurrenceTabProps {
  residence: Residence;
}

export function MarcheConcurrenceTab({ residence }: MarcheConcurrenceTabProps) {
  const { t } = useLanguage();
  const { residenceDoc, loading, error, isInProvider, saveError } = useResidenceDocument();

  if (!isInProvider) {
    return (
      <div className={institutionalListingsFailSafeClass}>
        {t(
          'Provider document résidence manquant.',
          'Residence document provider missing.'
        )}
      </div>
    );
  }

  return (
    <div className={institutionalListingsPanelClass}>
      {saveError && (
        <p className={institutionalListingsFailSafeClass}>
          {saveError}
        </p>
      )}

      <FinancialDataProvider residenceId={residence.id}>
        <ResidenceAcmValuationPanel residence={residence} />
      </FinancialDataProvider>

      {error ? (
        <div className={institutionalListingsFailSafeClass}>
          {t('Erreur Firestore', 'Firestore error')}: {error.message}
        </div>
      ) : null}

      {loading ? (
        <div className={institutionalListingsFailSafeClass}>
          <p className={inst.loadingText}>
            {t('Chargement du diagnostic territorial…', 'Loading territorial diagnostic…')}
          </p>
        </div>
      ) : (
        <>
          <MarketPenetrationSection />
          <CompetitorZoneSection />
          <WorkforceBasinSection />
          <TerritorialDiagnosticSection />
          <VisitorRegistrySection />
        </>
      )}
    </div>
  );
}
