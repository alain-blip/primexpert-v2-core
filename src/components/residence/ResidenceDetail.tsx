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
import {
  InstitutionalResidenceTabShell,
} from './institutional/InstitutionalUi';
import { DocumentsDiligenceTab } from './documents/DocumentsDiligenceTab';
import { PromesseAchatTab } from './tabs/PromesseAchatTab';
import { Synthese360Tab } from './tabs/Synthese360Tab';

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

type InstitutionalShellTab =
  | 'synthese'
  | 'finances'
  | 'declaration'
  | 'marche'
  | 'documents'
  | 'intelligence'
  | 'promesse';

const INSTITUTIONAL_TAB_SHELL: Record<
  InstitutionalShellTab,
  {
    titleFr: string;
    titleEn: string;
    subtitleFr?: string;
    subtitleEn?: string;
    variant: 'card' | 'stack';
    useAddressSubtitle?: boolean;
  }
> = {
  synthese: {
    titleFr: 'Bilan exécutif 360°',
    titleEn: '360° Executive Summary',
    subtitleFr: 'Synthèse commerciale · rétribution · conformité C-73.2 · notes courtier',
    subtitleEn: 'Commercial summary · compensation · C-73.2 compliance · broker notes',
    variant: 'stack',
  },
  finances: {
    titleFr: 'Hub Finance institutionnel',
    titleEn: 'Institutional Finance Hub',
    subtitleFr: 'Bilan exécutif · revenus · finançabilité · ratios · analyse 360°',
    subtitleEn: 'Executive summary · revenue · financing · ratios · 360° analysis',
    variant: 'card',
  },
  declaration: {
    titleFr: 'Déclaration du vendeur',
    titleEn: 'Seller disclosure',
    subtitleFr: 'Questionnaire OACIQ · certification Gold Signature',
    subtitleEn: 'OACIQ questionnaire · Gold Signature certification',
    variant: 'stack',
  },
  marche: {
    titleFr: 'Marché & Concurrence',
    titleEn: 'Market & Competition',
    variant: 'stack',
    useAddressSubtitle: true,
  },
  documents: {
    titleFr: 'Espace Documents',
    titleEn: 'Document space',
    subtitleFr: 'Matrice transactionnelle — acheteurs, contrats, actes, promesses',
    subtitleEn: 'Transaction matrix — buyers, contracts, deeds, promises',
    variant: 'card',
  },
  intelligence: {
    titleFr: 'Intelligence · Chronologie',
    titleEn: 'Intelligence · Timeline',
    subtitleFr: 'Rapport vendeur · vélocité J+7 · historique appels et courriels',
    subtitleEn: 'Seller report · D+7 velocity · calls and email history',
    variant: 'stack',
  },
  promesse: {
    titleFr: "Promesse d'achat",
    titleEn: 'Purchase promise',
    subtitleFr: 'Pilotage transactionnel OACIQ · conservation WORM 6 ans',
    subtitleEn: 'OACIQ transaction control · 6-year WORM retention',
    variant: 'stack',
  },
};

function wrapInstitutionalTab(
  tab: ResidenceDetailTab,
  content: React.ReactNode,
  residence: Residence,
  language: 'fr' | 'en'
): React.ReactNode {
  const shell = INSTITUTIONAL_TAB_SHELL[tab as InstitutionalShellTab];
  if (!shell) return content;
  const title = language === 'fr' ? shell.titleFr : shell.titleEn;
  let subtitle: string | undefined;
  if (shell.useAddressSubtitle) {
    subtitle = residence.city
      ? `${residence.address}, ${residence.city}`
      : residence.address;
  } else {
    subtitle = language === 'fr' ? shell.subtitleFr : shell.subtitleEn;
  }
  return (
    <InstitutionalResidenceTabShell title={title} subtitle={subtitle} variant={shell.variant}>
      {content}
    </InstitutionalResidenceTabShell>
  );
}

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
        return <Synthese360Tab residence={residence} residenceId={residence.id} />;
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
            residenceCity={residence.city}
            residenceRegionHint={residence.city}
            assetNiche={residence.assetNiche}
            propertyType={residence.propertyType}
          />
        );
      case 'promesse':
        return <PromesseAchatTab residence={residence} brokerId={brokerId} />;
      default:
        return null;
    }
  }, [activeTab, brokerId, residence, onClose, t]);

  const panelContent = useMemo(
    () => wrapInstitutionalTab(activeTab, tabContent, residence, language === 'fr' ? 'fr' : 'en'),
    [activeTab, tabContent, residence, language]
  );

  return (
    <div className="space-y-6 min-h-[70vh] font-sans">
      {/* En-tête institutionnel */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-[#D4AF37]/60 hover:text-[#142c6a] transition"
              aria-label={t('Retour à mes inscriptions', 'Back to my listings')}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37]">
                {t('Fiche résidence · Primexpert V2', 'Residence file · Primexpert V2')}
              </p>
              <h1 className="text-2xl font-black text-[#142c6a] tracking-tight truncate">{addrTitle}</h1>
              <p className="text-[11px] font-bold text-slate-600 mt-1 font-mono">
                <span className="text-[#142c6a]">{formatCurrency(residence.price)}</span> · {statusLabel} · ID{' '}
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
                  ? 'border-[#D4AF37]/50 bg-amber-50 text-[#142c6a]'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#142c6a]'
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
          {panelContent}
        </div>
      </ResidenceDocumentProvider>
    </div>
  );
}
