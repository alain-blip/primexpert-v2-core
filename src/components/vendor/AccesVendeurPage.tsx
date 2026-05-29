/**
 * Accès Vendeur — portail client (jeton) ou aperçu courtier.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Home,
  ShieldCheck,
  Link2,
  Copy,
  LayoutDashboard,
  FileText,
  Building2,
  BarChart3,
  FolderOpen,
  Mail,
  Phone,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth, type UserProfile } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { useLanguage } from '../../lib/i18n';
import { useTheme } from '../../lib/useTheme';
import { buildContactDisplayName } from '@primexpert/core/crm';
import {
  assessVendorPortalCatalogueCompliance,
  mandateMissingFieldLabels,
} from '@primexpert/core/residence';
import {
  listOrganizationContacts,
  type ContactServiceContext,
} from '../../services/contacts';
import {
  subscribeVendorPortal,
  vendorPortalResidenceAdapter,
  type VendorPortalViewModel,
} from '../../services/vendorPortalService';
import {
  createVendorPortalInviteLink,
  redeemVendorPortalToken,
  type VendorBrokerContact,
  type VendorPortalClientSession,
} from '../../services/vendorPortalAccessService';
import type { PropertyDocumentRecord } from '../../types/propertyDocument';
import { VendorTimeline } from './VendorTimeline';
import { VendorComplianceGauge } from './VendorComplianceGauge';
import { VendorDocumentDropzone } from './VendorDocumentDropzone';
import { VendorOfferPanel } from './VendorOfferPanel';
import { VendorPortalSkeleton } from './VendorPortalSkeleton';
import { DeclarationVendeurTab } from '../residence/tabs/DeclarationVendeurTab';
import { IdentiteImmeubleTab } from '../residence/tabs/IdentiteImmeubleTab';
import { FinanceHubTab } from '../residence/tabs/FinanceHubTab';
import { ResidenceDocumentProvider } from '../../context/ResidenceDocumentContext';
import { FinancialDataProvider } from '../../context/FinancialDataContext';
import {
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
  institutionalListingsPanelClass,
  vendorPortalLayoutShellClass,
} from '../../lib/institutionalTheme';
import { cn } from '../../lib/utils';

export type VendorPortalDisplayMode = 'broker' | 'client';

export type VendorPortalTabId =
  | 'overview'
  | 'declaration'
  | 'identity'
  | 'finance'
  | 'documents';

const VENDOR_PORTAL_TABS: {
  id: VendorPortalTabId;
  icon: typeof LayoutDashboard;
  labelFr: string;
  labelEn: string;
}[] = [
  { id: 'overview', icon: LayoutDashboard, labelFr: "Vue d'ensemble", labelEn: 'Overview' },
  { id: 'declaration', icon: FileText, labelFr: 'Déclaration du vendeur', labelEn: 'Seller disclosure' },
  { id: 'identity', icon: Building2, labelFr: 'Identité / Immeuble', labelEn: 'Identity / Building' },
  { id: 'finance', icon: BarChart3, labelFr: 'Données financières', labelEn: 'Financial data' },
  { id: 'documents', icon: FolderOpen, labelFr: 'Documents', labelEn: 'Documents' },
];

function profileToBrokerContact(profile: UserProfile): VendorBrokerContact {
  const firstLast = [profile.firstName, profile.lastName]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .trim();
  return {
    displayName: profile.displayName?.trim() || firstLast || 'Courtier Primexpert',
    email: profile.email?.trim() || undefined,
    phone: profile.phone?.trim() || undefined,
  };
}

function userDocToBrokerContact(data: Record<string, unknown>): VendorBrokerContact | null {
  const firstLast = [data.firstName, data.lastName]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .trim();
  const displayName =
    (typeof data.displayName === 'string' && data.displayName.trim()) ||
    firstLast ||
    '';
  if (!displayName) return null;
  return {
    displayName,
    email: typeof data.email === 'string' && data.email.trim() ? data.email.trim() : undefined,
    phone: typeof data.phone === 'string' && data.phone.trim() ? data.phone.trim() : undefined,
  };
}

function useVendorBrokerContact(
  brokerId: string,
  clientSession?: VendorPortalClientSession | null
): VendorBrokerContact | null {
  const { profile } = useAuth();
  const [fetched, setFetched] = useState<VendorBrokerContact | null>(null);

  useEffect(() => {
    if (clientSession?.brokerContact) {
      setFetched(null);
      return;
    }
    if (!brokerId) {
      setFetched(null);
      return;
    }
    if (profile?.uid === brokerId) {
      setFetched(null);
      return;
    }

    let cancelled = false;
    void getDoc(doc(db, 'users', brokerId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        setFetched(userDocToBrokerContact(snap.data() as Record<string, unknown>));
      })
      .catch(() => {
        if (!cancelled) setFetched(null);
      });

    return () => {
      cancelled = true;
    };
  }, [brokerId, clientSession?.brokerContact, profile?.uid]);

  if (clientSession?.brokerContact) return clientSession.brokerContact;
  if (profile?.uid === brokerId && profile) return profileToBrokerContact(profile);
  return fetched;
}

function VendorResponsibleBrokerContact({
  contact,
  t,
}: {
  contact: VendorBrokerContact;
  t: (fr: string, en: string) => string;
}) {
  const phoneHref = contact.phone?.replace(/[^\d+]/g, '') ?? '';

  return (
    <div className="w-full min-w-[200px] rounded-lg border border-primexpert-dark/15 bg-primexpert-blue/5 px-3 py-2.5 sm:max-w-xs dark:border-white/20 dark:bg-primexpert-blueDeep">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">
        {t('Courtier responsable', 'Responsible broker')}
      </p>
      <p className="mt-1 text-sm font-black leading-snug text-slate-900 dark:text-white">
        {contact.displayName}
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-primexpert-dark dark:text-[#daeefa] dark:hover:text-white"
          >
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{contact.email}</span>
          </a>
        ) : null}
        {contact.phone ? (
          <a
            href={phoneHref ? `tel:${phoneHref}` : undefined}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-primexpert-dark dark:text-[#daeefa] dark:hover:text-white"
          >
            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{contact.phone}</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

function AccesVendeurShell({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: VendorPortalDisplayMode;
}) {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-primexpert-blue text-slate-900 dark:bg-primexpert-blueDeep"
    >
      <header className="sticky top-0 z-30 border-b-2 border-primexpert-dark/20 bg-primexpert-blue dark:bg-primexpert-blueDeep">
        <div className={cn('flex items-center justify-between gap-3 py-4', vendorPortalLayoutShellClass)}>
          <div className="flex items-center gap-3 min-w-0">
            {mode === 'broker' ? (
              <Link
                to="/workhub"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primexpert-dark/20 bg-white px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-900 hover:text-black dark:bg-primexpert-cardDark"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                {t('Retour', 'Back')}
              </Link>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-widest text-white">
                {t('Accès Vendeur', 'Seller access')}
              </p>
              <p className="truncate text-[10px] font-semibold text-white/90">
                {mode === 'client'
                  ? t('Espace client sécurisé', 'Secure client space')
                  : t('Aperçu courtier', 'Broker preview')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div
              className="flex items-center rounded-lg border border-primexpert-dark/30 bg-white p-0.5 dark:bg-primexpert-cardDark"
              role="group"
              aria-label={t('Langue', 'Language')}
            >
              {(['fr', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase ${
                    language === lang
                      ? 'bg-primexpert-dark text-white'
                      : 'text-slate-900 dark:text-slate-900'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <div
              className="flex items-center rounded-lg border border-primexpert-dark/30 bg-white p-0.5 dark:bg-primexpert-cardDark"
              role="group"
              aria-label={t('Thème d’affichage', 'Display theme')}
            >
              {(
                [
                  { id: 'light' as const, labelFr: 'Clair', labelEn: 'Light' },
                  { id: 'dark' as const, labelFr: 'Foncé', labelEn: 'Dark' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setTheme(mode.id)}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    theme === mode.id
                      ? 'bg-primexpert-dark text-white'
                      : 'text-slate-900 dark:text-slate-900'
                  }`}
                >
                  {language === 'fr' ? mode.labelFr : mode.labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </motion.div>
  );
}

function ContactPicker({
  ctx,
  onSelect,
  t,
}: {
  ctx: ContactServiceContext;
  onSelect: (contactId: string) => void;
  t: (fr: string, en: string) => string;
}) {
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<{ id: string; name: string; residences: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listOrganizationContacts(ctx).then((rows) => {
      if (cancelled) return;
      setSellers(
        rows
          .filter((c) => c.relationRoles?.includes('seller'))
          .map((c) => ({
            id: c.id,
            name: buildContactDisplayName(c),
            residences: c.residenceIds?.length ?? 0,
          }))
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  if (loading) return <VendorPortalSkeleton />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-6 py-8', vendorPortalLayoutShellClass, institutionalListingsPanelClass)}
    >
      <section className={cn(institutionalListingsCardShellClass, 'bg-white p-6 dark:bg-primexpert-cardDark')}>
        <h1 className="text-2xl font-black tracking-tight text-black">
          {t('Accès Vendeur', 'Seller access')}
        </h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-900">
          {t(
            'Sélectionnez un vendeur pour ouvrir son espace de suivi de propriété.',
            'Select a seller to open their property follow-up space.'
          )}
        </p>
      </section>

      {sellers.length === 0 ? (
        <p className="rounded-xl border-2 border-primexpert-dark/20 bg-white px-5 py-4 text-sm font-semibold text-slate-900 dark:bg-primexpert-cardDark">
          {t(
            'Aucun contact vendeur lié à une propriété pour le moment.',
            'No seller contact linked to a property yet.'
          )}
        </p>
      ) : (
        <ul className="space-y-3">
          {sellers.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border-2 border-primexpert-dark/20 bg-white px-5 py-4 text-left shadow-md transition hover:border-primexpert-dark/40 hover:bg-primexpert-light dark:bg-primexpert-cardDark"
              >
                <div>
                  <p className="font-black text-slate-900">{s.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-900">
                    {s.residences}{' '}
                    {t(
                      s.residences === 1 ? 'propriété liée' : 'propriétés liées',
                      s.residences === 1 ? 'linked property' : 'linked properties'
                    )}
                  </p>
                </div>
                <Home className="h-5 w-5 shrink-0 text-primexpert-dark" aria-hidden />
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

function VendorPortalTabNav({
  activeTab,
  onTabChange,
  t,
  language,
}: {
  activeTab: VendorPortalTabId;
  onTabChange: (tab: VendorPortalTabId) => void;
  t: (fr: string, en: string) => string;
  language: 'fr' | 'en';
}) {
  return (
    <nav
      className="flex gap-2 overflow-x-auto rounded-xl border-2 border-primexpert-dark/20 bg-white p-2 dark:bg-primexpert-cardDark"
      aria-label={t('Sections portail vendeur', 'Seller portal sections')}
    >
      {VENDOR_PORTAL_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        const label = language === 'fr' ? tab.labelFr : tab.labelEn;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg border-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider transition',
              active
                ? 'border-primexpert-dark bg-primexpert-dark text-white'
                : 'border-transparent bg-white text-slate-900 hover:border-primexpert-dark/30 dark:bg-primexpert-cardDark dark:text-slate-900'
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function VendorPortalWorkspace({
  vm,
  mode,
  clientSession,
  children,
}: {
  vm: VendorPortalViewModel;
  mode: VendorPortalDisplayMode;
  clientSession?: VendorPortalClientSession | null;
  children: React.ReactNode;
}) {
  const vendorToken = mode === 'client' ? clientSession?.token ?? null : null;
  return (
    <ResidenceDocumentProvider residenceId={vm.residenceId} vendorPortalToken={vendorToken}>
      <FinancialDataProvider residenceId={vm.residenceId}>{children}</FinancialDataProvider>
    </ResidenceDocumentProvider>
  );
}

function VendorPortalWelcomeCard({
  t,
  language,
}: {
  t: (fr: string, en: string) => string;
  language: 'fr' | 'en';
}) {
  const wiifmItems = [
    t(
      'Un contrôle total : suivez l’avancement des offres et la jauge de conformité de votre dossier en temps réel.',
      'Full control: track offer progress and your file’s compliance gauge in real time.'
    ),
    t(
      'Une valorisation optimisée : des données claires et prêtes attirent les acheteurs d’élite et protègent votre prix de vente.',
      'Optimized value: clear, ready data attracts elite buyers and protects your asking price.'
    ),
    t(
      'Zéro perte de temps : téléversez vos documents directement dans vos coffres sécurisés, sans intermédiaires.',
      'Zero wasted time: upload documents directly to your secure vaults, without intermediaries.'
    ),
  ];

  return (
    <section
      className={cn(
        institutionalListingsCardShellClass,
        'border-l-[6px] border-l-primexpert-gold bg-white p-6 dark:bg-primexpert-cardDark'
      )}
    >
      <p className="text-base font-black leading-snug text-slate-900 dark:font-bold">
        {t(
          'Bonjour et bienvenue dans votre espace privé Primexpert.',
          'Hello and welcome to your private Primexpert space.'
        )}
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <h2 className={institutionalListingsCardTitleClass}>
            {language === 'fr'
              ? 'Pourquoi utiliser ce cockpit ? (Why you should)'
              : 'Why use this cockpit? (Why you should)'}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-900 dark:font-medium">
            {t(
              'Pour sécuriser et accélérer la mise en marché exclusive de votre résidence. En complétant vos détails techniques et votre déclaration du vendeur officielle (DV-RPA), vous dressez un bouclier juridique complet autour de votre transaction.',
              'To secure and accelerate the exclusive listing of your residence. By completing your technical details and your official seller disclosure (DV-RPA), you build a complete legal shield around your transaction.'
            )}
          </p>
        </div>

        <div>
          <h2 className={institutionalListingsCardTitleClass}>
            {language === 'fr' ? 'Ce que vous y gagnez : (WIIFM)' : 'What you gain: (WIIFM)'}
          </h2>
          <ul className="mt-3 space-y-2.5">
            {wiifmItems.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 text-sm font-semibold leading-relaxed text-slate-900 dark:font-medium"
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primexpert-dark dark:bg-slate-900"
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t-2 border-primexpert-dark/10 pt-4 text-sm font-semibold leading-relaxed text-slate-900 dark:font-medium">
          {t(
            'Votre courtier responsable révisera chaque élément avec vous avant toute présentation officielle.',
            'Your responsible broker will review each item with you before any official presentation.'
          )}
        </p>
      </div>
    </section>
  );
}

function VendorPortalOverview({
  vm,
  catalogueCompliance,
  complianceSublabel,
  t,
  locale,
  showWelcome,
  language,
}: {
  vm: VendorPortalViewModel;
  catalogueCompliance: ReturnType<typeof assessVendorPortalCatalogueCompliance>;
  complianceSublabel: string;
  t: (fr: string, en: string) => string;
  locale: 'fr' | 'en';
  showWelcome: boolean;
  language: 'fr' | 'en';
}) {
  return (
    <>
      {showWelcome ? <VendorPortalWelcomeCard t={t} language={language} /> : null}

      <section className={cn(institutionalListingsCardShellClass, 'bg-white p-6 dark:bg-primexpert-cardDark')}>
        <h2 className={institutionalListingsCardTitleClass}>
          {t('Progression de la vente', 'Sale progress')}
        </h2>
        <div className="mt-6">
          <VendorTimeline activeStageId={vm.timelineStageId} t={t} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VendorComplianceGauge
          percent={catalogueCompliance.percent}
          label={t('Preuves de conformité — catalogue', 'Compliance evidence — catalogue')}
          sublabel={complianceSublabel}
          receivedCount={catalogueCompliance.receivedCount}
          requiredCount={catalogueCompliance.requiredCount}
        />

        <section className={cn(institutionalListingsCardShellClass, 'bg-white p-6 dark:bg-primexpert-cardDark')}>
          <h2 className={institutionalListingsCardTitleClass}>
            {t('Diligence documentaire', 'Document diligence')}
          </h2>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-900">
            {t(
              `${catalogueCompliance.canonicalCount} types canoniques — déposez chaque pièce dans la catégorie appropriée.`,
              `${catalogueCompliance.canonicalCount} canonical types — upload each item in the appropriate category.`
            )}
          </p>
        </section>
      </div>

      {vm.hasActivePromesse && vm.promesse ? (
        <VendorOfferPanel promesse={vm.promesse} locale={locale} t={t} />
      ) : (
        <section
          className={cn(
            institutionalListingsCardShellClass,
            'bg-white px-6 py-8 text-center dark:bg-primexpert-cardDark'
          )}
        >
          <p className="text-sm font-semibold text-slate-900">
            {t(
              "Aucune promesse d'achat active pour le moment.",
              'No active purchase promise at this time.'
            )}
          </p>
        </section>
      )}
    </>
  );
}

function VendorPortalContent({
  vm,
  mode,
  clientSession,
  orgId,
  onInviteLink,
}: {
  vm: VendorPortalViewModel;
  mode: VendorPortalDisplayMode;
  clientSession?: VendorPortalClientSession | null;
  orgId: string;
  onInviteLink?: (path: string) => void;
}) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const [portalDocs, setPortalDocs] = useState<PropertyDocumentRecord[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<VendorPortalTabId>('overview');

  const residence = useMemo(() => vendorPortalResidenceAdapter(vm), [vm]);
  const isClientMode = mode === 'client';
  const vendorSubmittedBy = clientSession?.contactId ?? vm.contact.id;
  const brokerContact = useVendorBrokerContact(vm.brokerId, clientSession);

  const catalogueCompliance = useMemo(
    () => assessVendorPortalCatalogueCompliance(portalDocs),
    [portalDocs]
  );

  const missingMandateLabels = mandateMissingFieldLabels(vm.mandateResult, locale);
  const complianceSublabel =
    catalogueCompliance.missingRequired.length > 0
      ? t(
          `Pièces requises manquantes : ${catalogueCompliance.missingRequired
            .slice(0, 4)
            .map((m) => m.labelFr)
            .join(', ')}${catalogueCompliance.missingRequired.length > 4 ? '…' : ''}.`,
          `Missing required items: ${catalogueCompliance.missingRequired
            .slice(0, 4)
            .map((m) => m.labelEn)
            .join(', ')}${catalogueCompliance.missingRequired.length > 4 ? '…' : ''}.`
        )
      : missingMandateLabels.length > 0
        ? t(
            `Éléments mandat : ${missingMandateLabels.join(', ')}.`,
            `Mandate items: ${missingMandateLabels.join(', ')}.`
          )
        : t(
            'Dossier conforme aux exigences de mise en marché.',
            'File meets listing requirements.'
          );

  const handleCreateInvite = async () => {
    if (!onInviteLink) return;
    setInviteBusy(true);
    try {
      const { path } = await createVendorPortalInviteLink({
        orgId,
        contactId: vm.contact.id,
        residenceId: vm.residenceId,
      });
      onInviteLink(path);
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <VendorPortalWorkspace vm={vm} mode={mode} clientSession={clientSession}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'mx-auto space-y-6 py-8 pb-16',
          vendorPortalLayoutShellClass,
          institutionalListingsPanelClass
        )}
      >
        {mode === 'broker' ? (
          <div
            role="status"
            className="rounded-xl border-2 border-amber-500 bg-amber-100 px-4 py-3 dark:bg-amber-100"
          >
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-950">
              {t('Aperçu courtier', 'Broker preview')}
            </p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900 dark:font-medium">
              {t(
                'Cet aperçu reproduit fidèlement l’espace vendeur — même largeur, même charte visuelle.',
                'This preview faithfully mirrors the seller space — same width, same visual charter.'
              )}
            </p>
          </div>
        ) : null}

        <section className={cn(institutionalListingsCardShellClass, 'bg-white p-6 dark:bg-primexpert-cardDark')}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <motion.div className="min-w-0 flex-1">
              <p className={institutionalListingsCardTitleClass}>
                {buildContactDisplayName(vm.contact)}
              </p>
              <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-3xl dark:text-slate-900">
                {vm.propertyLabel}
              </h1>
            </motion.div>
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
              <div className="inline-flex items-center gap-1.5 self-start rounded-full border-2 border-emerald-400 bg-emerald-50 px-3 py-1.5 sm:self-end dark:bg-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-900" aria-hidden />
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-900">
                  {mode === 'client'
                    ? t('Connexion sécurisée', 'Secure connection')
                    : t('Aperçu interne', 'Internal preview')}
                </span>
              </div>
              {brokerContact ? (
                <VendorResponsibleBrokerContact contact={brokerContact} t={t} />
              ) : null}
            </div>
          </div>
          {mode === 'broker' ? (
            <button
              type="button"
              disabled={inviteBusy}
              onClick={() => void handleCreateInvite()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border-2 border-primexpert-dark bg-primexpert-dark px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primexpert-blue disabled:opacity-60"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              {inviteBusy
                ? t('Génération…', 'Generating…')
                : t('Créer un lien vendeur', 'Create seller link')}
            </button>
          ) : null}
        </section>

        <VendorPortalTabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          t={t}
          language={language}
        />

        {activeTab === 'overview' ? (
          <VendorPortalOverview
            vm={vm}
            catalogueCompliance={catalogueCompliance}
            complianceSublabel={complianceSublabel}
            t={t}
            locale={locale}
            showWelcome={isClientMode}
            language={language}
          />
        ) : null}

        {activeTab === 'declaration' ? (
          <DeclarationVendeurTab
            variant={isClientMode ? 'vendor' : 'broker'}
            vendorPortalTheme
            vendorSubmittedBy={vendorSubmittedBy}
          />
        ) : null}

        {activeTab === 'identity' ? (
          <div className="rounded-xl border-2 border-primexpert-dark bg-white p-4 dark:bg-primexpert-cardDark">
            <IdentiteImmeubleTab residence={residence} isVendorMode />
          </div>
        ) : null}

        {activeTab === 'finance' ? (
          <div className="overflow-hidden rounded-xl border-2 border-primexpert-dark bg-white dark:bg-primexpert-cardDark">
            <FinanceHubTab residence={residence} isVendorMode />
          </div>
        ) : null}

        {activeTab === 'documents' ? (
          <VendorDocumentDropzone
            propertyId={vm.residenceId}
            brokerId={vm.brokerId}
            orgId={orgId}
            contactId={vm.contact.id}
            contactName={buildContactDisplayName(vm.contact)}
            inviteToken={clientSession?.token}
            uploadSource={mode === 'client' ? 'vendor_portal' : 'broker'}
            t={t}
            locale={locale}
            onDocumentsChange={setPortalDocs}
          />
        ) : null}

        <p className="text-center text-[10px] font-semibold leading-relaxed text-white dark:text-white/90">
          {t(
            'Analyse par algorithme — validation professionnelle du courtier requise avant toute diffusion.',
            'Algorithm-based analysis — broker professional validation required before any release.'
          )}
        </p>
      </motion.div>
    </VendorPortalWorkspace>
  );
}

export function AccesVendeurPage({ forcedMode }: { forcedMode?: VendorPortalDisplayMode }) {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const inviteToken = searchParams.get('token') ?? '';
  const contactIdParam = searchParams.get('contactId') ?? '';
  const residenceIdParam = searchParams.get('residenceId') ?? undefined;

  const [clientSession, setClientSession] = useState<VendorPortalClientSession | null>(null);
  const [clientLoading, setClientLoading] = useState(Boolean(inviteToken));
  const [clientError, setClientError] = useState<string | null>(null);
  const [invitePath, setInvitePath] = useState<string | null>(null);
  const [vm, setVm] = useState<VendorPortalViewModel | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const mode: VendorPortalDisplayMode = forcedMode ?? (inviteToken ? 'client' : 'broker');

  useEffect(() => {
    if (mode !== 'client' || !inviteToken) {
      setClientSession(null);
      setClientLoading(false);
      return;
    }
    let cancelled = false;
    setClientLoading(true);
    setClientError(null);
    void redeemVendorPortalToken(inviteToken)
      .then((session) => {
        if (!cancelled) setClientSession(session);
      })
      .catch((e) => {
        if (!cancelled) {
          setClientError(e instanceof Error ? e.message : t('Lien invalide.', 'Invalid link.'));
        }
      })
      .finally(() => {
        if (!cancelled) setClientLoading(false);
      });
  }, [inviteToken, mode, t]);

  const brokerCtx = useMemo<ContactServiceContext | null>(() => {
    if (!profile?.uid || !profile.orgId) return null;
    return {
      uid: profile.uid,
      orgId: profile.orgId,
      role:
        profile.role === 'admin_system'
          ? 'admin_system'
          : profile.role === 'admin'
            ? 'admin'
            : 'member',
    };
  }, [profile?.uid, profile?.orgId, profile?.role]);

  const portalCtx = useMemo<ContactServiceContext | null>(() => {
    if (mode === 'client' && clientSession) {
      return {
        orgId: clientSession.orgId,
        uid: clientSession.brokerId,
        role: 'member',
      };
    }
    return brokerCtx;
  }, [mode, clientSession, brokerCtx]);

  const activeContactId =
    mode === 'client' ? clientSession?.contactId ?? '' : contactIdParam;
  const activeResidenceId =
    mode === 'client' ? clientSession?.residenceId : residenceIdParam;
  const orgId = portalCtx?.orgId ?? '';

  useEffect(() => {
    if (!portalCtx || !activeContactId) {
      setVm(null);
      setPortalLoading(false);
      return;
    }
    setPortalLoading(true);
    const unsub = subscribeVendorPortal({
      ctx: portalCtx,
      contactId: activeContactId,
      residenceId: activeResidenceId,
      onUpdate: (next) => {
        setVm(next);
        setPortalLoading(false);
      },
      onError: () => setPortalLoading(false),
    });
    return unsub;
  }, [portalCtx, activeContactId, activeResidenceId]);

  const handleSelectContact = (id: string) => {
    setSearchParams({ contactId: id });
  };

  if (mode === 'client' && clientLoading) {
    return (
      <AccesVendeurShell mode="client">
        <VendorPortalSkeleton />
      </AccesVendeurShell>
    );
  }

  if (mode === 'client' && clientError) {
    return (
      <AccesVendeurShell mode="client">
        <p className="mx-auto max-w-md px-4 py-12 text-center text-sm font-semibold text-white">
          {clientError}
        </p>
      </AccesVendeurShell>
    );
  }

  if (mode === 'broker' && !brokerCtx) {
    return (
      <AccesVendeurShell mode="broker">
        <VendorPortalSkeleton />
      </AccesVendeurShell>
    );
  }

  return (
    <AccesVendeurShell mode={mode}>
      {invitePath ? (
        <div className={cn('pt-4', vendorPortalLayoutShellClass)}>
          <div className="flex items-center gap-2 rounded-xl border-2 border-primexpert-dark/20 bg-white px-4 py-3 dark:bg-primexpert-cardDark">
            <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-900">{invitePath}</p>
            <button
              type="button"
              className="shrink-0 rounded-lg border-2 border-primexpert-dark p-2 text-primexpert-dark"
              onClick={() => {
                const full = `${window.location.origin}${invitePath}`;
                void navigator.clipboard.writeText(full);
              }}
              aria-label={t('Copier le lien', 'Copy link')}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'broker' && !activeContactId ? (
        brokerCtx ? (
          <ContactPicker ctx={brokerCtx} onSelect={handleSelectContact} t={t} />
        ) : (
          <VendorPortalSkeleton />
        )
      ) : portalLoading ? (
        <VendorPortalSkeleton />
      ) : !vm ? (
        <p className="mx-auto max-w-md px-4 py-12 text-center text-sm font-semibold text-white">
          {t(
            'Impossible de charger cette propriété. Vérifiez le lien ou contactez votre courtier.',
            'Unable to load this property. Check the link or contact your broker.'
          )}
        </p>
      ) : (
        <VendorPortalContent
          vm={vm}
          mode={mode}
          clientSession={clientSession}
          orgId={orgId}
          onInviteLink={mode === 'broker' ? setInvitePath : undefined}
        />
      )}
    </AccesVendeurShell>
  );
}

export default AccesVendeurPage;
