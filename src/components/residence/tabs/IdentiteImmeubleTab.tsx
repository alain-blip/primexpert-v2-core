/**
 * Identité fusionnée — Phase 4a lecture + Phase 4b écriture.
 * SSOT : buildIdentityViewModel() + ResidenceDocumentContext.
 */

import React, { useMemo } from 'react';
import { AlertTriangle, Building2, Info } from 'lucide-react';
import { buildIdentityViewModel } from '@primexpert/core/identity';
import { useLanguage } from '../../../lib/i18n';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import type { Residence } from '../../../services/residences';
import { IdentityOverviewStrip } from '../identity/IdentityOverviewStrip';
import { EditableIdentitySection } from '../identity/EditableIdentitySection';
import { BuildingAuditPanel } from '../identity/BuildingAuditPanel';
import { ServicesRecognitionSection } from '../identity/ServicesRecognitionSection';
import { RentPricingTableSection } from '../identity/RentPricingTableSection';
import { EditableCapacitySection } from '../identity/EditableCapacitySection';
import { MsssEnrichmentBanner } from '../identity/MsssEnrichmentBanner';
import { IdentitySectionCard } from '../identity/IdentitySectionCard';

export interface IdentiteImmeubleTabProps {
  residence: Residence;
}

export function IdentiteImmeubleTab({ residence }: IdentiteImmeubleTabProps) {
  const { language, t } = useLanguage();
  const { residenceDoc, loading, error, isInProvider, saving, saveError } =
    useResidenceDocument();

  const lang = language === 'fr' ? 'fr' : 'en';

  const docWithHints = useMemo(() => {
    if (!residenceDoc) return null;
    return {
      ...residenceDoc,
      address: residenceDoc.address ?? residence.address,
      city: residenceDoc.city ?? residence.city,
      price: residence.price,
      prixDemande: residence.price,
    } as Record<string, unknown>;
  }, [residenceDoc, residence]);

  const view = useMemo(
    () => buildIdentityViewModel(docWithHints, { loading }),
    [docWithHints, loading]
  );

  const establishmentSection = view.sections.find((s) => s.id === 'establishment');
  const legalSection = view.sections.find((s) => s.id === 'legal');

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
          {t('Chargement de l’identité…', 'Loading identity…')}
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

  if (!view.hasDocument) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-10">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-700">
              {t('Identité & immeuble', 'Identity & building')}
            </p>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">
              {t(
                'Document résidence introuvable ou vide.',
                'Residence document not found or empty.'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[#D4AF37]" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              {t('Identité fusionnée', 'Unified identity')}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              {t('Édition par section', 'Section editing')} · ID {residence.id}
              {saving ? ` · ${t('Enregistrement…', 'Saving…')}` : ''}
            </p>
          </div>
        </div>
      </div>

      {saveError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {saveError}
        </div>
      ) : null}

      <MsssEnrichmentBanner show={view.showMsssBanner} msss={view.msss} language={lang} />

      <IdentityOverviewStrip overview={view.overview} language={lang} />

      {establishmentSection && (
        <EditableIdentitySection section={establishmentSection} language={lang} />
      )}

      {legalSection && <EditableIdentitySection section={legalSection} language={lang} />}

      <BuildingAuditPanel blocks={view.buildingAudit} language={lang} />

      <ServicesRecognitionSection services={view.services} language={lang} />

      <RentPricingTableSection rentPricing={view.rentPricing} language={lang} />

      {docWithHints && <EditableCapacitySection residenceDoc={docWithHints} language={lang} />}

      {view.capacity.agePyramid.length > 0 && (
        <IdentitySectionCard
          title={lang === 'fr' ? 'Pyramide des âges — clientèle' : 'Age pyramid — clientele'}
          accent="#059669"
        >
          <div className="space-y-2">
            {view.capacity.agePyramid.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs font-semibold text-[#000000]">
                  {row.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500/80"
                    style={{ width: `${Math.min(100, row.pct)}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs font-mono text-slate-600">
                  {row.count} ({row.pct.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </IdentitySectionCard>
      )}

      {view.criticalGaps.length > 0 && !view.showMsssBanner && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            {t(
              'Certaines sections sont incomplètes. Complétez la fiche ou lancez un enrichissement MSSS depuis Copilote.',
              'Some sections are incomplete. Complete the file or run MSSS enrichment from Copilote.'
            )}
          </p>
        </div>
      )}
    </div>
  );
}
