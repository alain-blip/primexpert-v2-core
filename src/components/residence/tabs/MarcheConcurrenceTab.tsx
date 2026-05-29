/**
 * Marché & Concurrence — zone, concurrence territoriale Centris, diagnostic, registre visiteurs.
 * SSOT : @primexpert/core/market + ResidenceDocumentContext.
 */

import React, { useMemo } from 'react';
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
import { TerritorialCentrisCompetitionSection } from '../market/TerritorialCentrisCompetitionSection';
import { useTerritorialCompetition } from '../../../hooks/useTerritorialCompetition';
import { FinancialDataProvider } from '../../../context/FinancialDataContext';
import {
  normalizeAdministrativeRegion,
  resolveResidenceRpaBuildingClass,
} from '@primexpert/core/market';
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

  const regionAdministrative = useMemo(() => {
    const raw = String(
      residenceDoc?.regionAdministrative ??
        (residence as { region?: string }).region ??
        residence.city ??
        ''
    ).trim();
    if (!raw) return '';
    return normalizeAdministrativeRegion(raw, residence.city ?? undefined);
  }, [residenceDoc, residence]);

  const classeImmeuble = useMemo(
    () =>
      resolveResidenceRpaBuildingClass(
        (residenceDoc ?? undefined) as Record<string, unknown> | undefined,
        residence
      ),
    [residenceDoc, residence]
  );

  const territorialCompetition = useTerritorialCompetition({
    regionAdministrative,
    classeImmeuble,
    enabled: isInProvider && !loading && Boolean(regionAdministrative),
  });

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
        <ResidenceAcmValuationPanel
          residence={residence}
          territorialCompetition={territorialCompetition}
        />
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
          <TerritorialCentrisCompetitionSection
            loading={territorialCompetition.loading}
            error={territorialCompetition.error?.message ?? null}
            comparables={territorialCompetition.comparables}
            medianTgaPct={territorialCompetition.medianTgaPct}
            sampleCount={territorialCompetition.sampleCount}
            regionAdministrative={regionAdministrative}
            classeImmeuble={classeImmeuble}
          />
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
