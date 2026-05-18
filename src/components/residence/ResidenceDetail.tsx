/**
 * Fiche résidence V2 — coquille institutionnelle (Phase 0).
 * Les onglets métier (Hub CFO, Identité fusionnée, etc.) arrivent en phases suivantes.
 */

import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  FileText,
  Landmark,
  MapPin,
  ScrollText,
  Shield,
  Sparkles,
  LayoutDashboard,
  Handshake,
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import type { Residence, ResidenceStatus } from '../../services/residences';
import { ResidenceIntelligencePanel } from '../ResidenceIntelligencePanel';
import { FinancialDataProvider } from '../../context/FinancialDataContext';
import { FinanceHubTab } from './tabs/FinanceHubTab';
import { IdentiteImmeubleTab } from './tabs/IdentiteImmeubleTab';
import { DeclarationVendeurTab } from './tabs/DeclarationVendeurTab';
import { MarcheConcurrenceTab } from './tabs/MarcheConcurrenceTab';
import { ResidenceDocumentProvider } from '../../context/ResidenceDocumentContext';
import { InstitutionalPlaceholder } from './institutional/InstitutionalUi';
import { DocumentsDiligenceTab } from './documents/DocumentsDiligenceTab';
import { PromesseAchatTab } from './tabs/PromesseAchatTab';

export type ResidenceDetailTab =
  | 'synthese'
  | 'identite'
  | 'finances'
  | 'declaration'
  | 'marche'
  | 'documents'
  | 'intelligence'
  | 'promesse';

const STATUS_LABELS: Record<ResidenceStatus, { fr: string; en: string }> = {
  prospect: { fr: 'Prospection', en: 'Prospecting' },
  mandate: { fr: 'En mandat', en: 'Listed' },
  promise: { fr: 'En promesse', en: 'Under promise' },
  expired: { fr: 'Expiré', en: 'Expired' },
  unsigned: { fr: 'Non signé', en: 'Unsigned' },
  sold: { fr: 'Vendu', en: 'Sold' },
};

const TABS: {
  id: ResidenceDetailTab;
  icon: typeof LayoutDashboard;
  labelFr: string;
  labelEn: string;
}[] = [
  { id: 'synthese', icon: LayoutDashboard, labelFr: 'Synthèse', labelEn: 'Overview' },
  { id: 'identite', icon: Building2, labelFr: 'Identité', labelEn: 'Identity' },
  { id: 'finances', icon: Landmark, labelFr: 'Finances', labelEn: 'Finance' },
  { id: 'declaration', icon: Shield, labelFr: 'Déclaration', labelEn: 'Seller disclosure' },
  { id: 'marche', icon: MapPin, labelFr: 'Marché', labelEn: 'Market' },
  { id: 'documents', icon: FileText, labelFr: 'Documents', labelEn: 'Documents' },
  { id: 'intelligence', icon: Sparkles, labelFr: 'Intelligence', labelEn: 'Intelligence' },
  { id: 'promesse', icon: Handshake, labelFr: 'Promesse', labelEn: 'Promise' },
];

export interface ResidenceDetailProps {
  brokerId: string;
  residence: Residence;
  onClose: () => void;
  initialTab?: ResidenceDetailTab;
}

export function ResidenceDetail({
  brokerId,
  residence,
  onClose,
  initialTab = 'synthese',
}: ResidenceDetailProps) {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<ResidenceDetailTab>(initialTab);

  const addrTitle = residence.city
    ? `${residence.address}, ${residence.city}`
    : residence.address;

  const statusLabel = useMemo(() => {
    const row = STATUS_LABELS[residence.status];
    return language === 'fr' ? row.fr : row.en;
  }, [residence.status, language]);

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'intelligence':
        return (
          <ResidenceIntelligencePanel
            brokerId={brokerId}
            residence={residence}
            onClose={onClose}
            embedded
          />
        );
      case 'synthese':
        return (
          <InstitutionalPlaceholder
            phase={t('Phase 3 — Vue CFO', 'Phase 3 — CFO view')}
            title={t('Bilan exécutif & synthèse 360°', 'Executive summary & 360° overview')}
            subtitle={t(
              'Le Hub Finance (normalizeFinancialData + Bilan exécutif) sera branché ici après la migration des sous-collections financial/dataV2.',
              'The Finance Hub (normalizeFinancialData + executive summary) will connect here after financial/dataV2 subcollection migration.'
            )}
          />
        );
      case 'identite':
        return <IdentiteImmeubleTab residence={residence} />;
      case 'finances':
        return (
          <FinancialDataProvider residenceId={residence.id}>
            <FinanceHubTab residence={residence} />
          </FinancialDataProvider>
        );
      case 'declaration':
        return <DeclarationVendeurTab />;
      case 'marche':
        return <MarcheConcurrenceTab residence={residence} />;
      case 'documents':
        return (
          <DocumentsDiligenceTab
            propertyId={residence.id}
            brokerId={brokerId}
            courtiersResponsables={residence.courtiersResponsables}
          />
        );
      case 'promesse':
        return <PromesseAchatTab residence={residence} brokerId={brokerId} />;
      default:
        return null;
    }
  }, [activeTab, brokerId, residence, onClose, t]);

  return (
    <div className="space-y-6 min-h-[70vh] font-sans">
      {/* En-tête institutionnel */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-[#D4AF37]/60 hover:text-[#000000] transition"
              aria-label={t('Retour à mes inscriptions', 'Back to my listings')}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37]">
                {t('Fiche résidence · Primexpert V2', 'Residence file · Primexpert V2')}
              </p>
              <h1 className="text-2xl font-black text-[#000000] tracking-tight truncate">{addrTitle}</h1>
              <p className="text-[11px] font-bold text-slate-600 mt-1 font-mono">
                <span className="text-[#000000]">{formatCurrency(residence.price)}</span> · {statusLabel} · ID{' '}
                {residence.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-emerald-800">
              <ScrollText className="h-3.5 w-3.5" />
              {t('Vue institutionnelle', 'Institutional view')}
            </span>
          </div>
        </div>
      </div>

      {/* Barre d'onglets */}
      <div
        role="tablist"
        aria-label={t('Sections de la fiche', 'File sections')}
        className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const label = language === 'fr' ? tab.labelFr : tab.labelEn;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition border',
                active
                  ? 'border-[#D4AF37]/50 bg-amber-50 text-[#000000]'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#000000]'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          );
        })}
      </div>

      <ResidenceDocumentProvider residenceId={residence.id}>
        <div key={activeTab} role="tabpanel">
          {tabContent}
        </div>
      </ResidenceDocumentProvider>
    </div>
  );
}
