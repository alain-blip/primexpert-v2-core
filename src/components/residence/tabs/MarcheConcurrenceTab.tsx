/**
 * Marché & Concurrence — 3 piliers (zone, diagnostic territorial, registre visiteurs).
 * SSOT : @primexpert/core/market + ResidenceDocumentContext.
 */

import React from 'react';
import { MapPin } from 'lucide-react';
import { useLanguage } from '../../../lib/i18n';
import type { Residence } from '../../../services/residences';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { InstitutionalPageHeader } from '../institutional/InstitutionalUi';
import { CompetitorZoneSection } from '../market/CompetitorZoneSection';
import { MarketPenetrationSection } from '../market/MarketPenetrationSection';
import { TerritorialDiagnosticSection } from '../market/TerritorialDiagnosticSection';
import { VisitorRegistrySection } from '../market/VisitorRegistrySection';
import { WorkforceBasinSection } from '../market/WorkforceBasinSection';

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
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-16 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
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

  const lat = Number(residenceDoc?.latitude);
  const lng = Number(residenceDoc?.longitude);
  const coords =
    !Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0
      ? `${lat}, ${lng}`
      : t('Non géolocalisé', 'Not geolocated');

  return (
    <div className="space-y-6 font-sans text-slate-800">
      <InstitutionalPageHeader
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <MapPin className="h-4 w-4 text-[#D4AF37]" />
          </span>
        }
        title={t('Marché & Concurrence', 'Market & Competition')}
        meta={`${residence.address}${residence.city ? `, ${residence.city}` : ''} · ${coords}`}
      />

      {saveError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {saveError}
        </p>
      )}

      <MarketPenetrationSection />
      <CompetitorZoneSection />
      <WorkforceBasinSection />
      <TerritorialDiagnosticSection />
      <VisitorRegistrySection />
    </div>
  );
}
