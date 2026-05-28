/**
 * Accès Vendeur — portail client (jeton) ou aperçu courtier.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, Home, ShieldCheck, Link2, Copy } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useLanguage } from '../../lib/i18n';
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
  type VendorPortalViewModel,
} from '../../services/vendorPortalService';
import {
  createVendorPortalInviteLink,
  redeemVendorPortalToken,
  type VendorPortalClientSession,
} from '../../services/vendorPortalAccessService';
import type { PropertyDocumentRecord } from '../../types/propertyDocument';
import { VendorTimeline } from './VendorTimeline';
import { VendorComplianceGauge } from './VendorComplianceGauge';
import { VendorDocumentDropzone } from './VendorDocumentDropzone';
import { VendorOfferPanel } from './VendorOfferPanel';
import { VendorPortalSkeleton } from './VendorPortalSkeleton';
import {
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
  institutionalListingsPanelClass,
} from '../../lib/institutionalTheme';
import { cn } from '../../lib/utils';

export type VendorPortalDisplayMode = 'broker' | 'client';

function AccesVendeurShell({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: VendorPortalDisplayMode;
}) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-primexpert-blue text-slate-900 dark:bg-primexpert-blueDeep"
    >
      <header className="sticky top-0 z-30 border-b-2 border-primexpert-dark/20 bg-primexpert-blue dark:bg-primexpert-blueDeep">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
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
          <div
            className="flex shrink-0 items-center rounded-lg border border-primexpert-dark/30 bg-white p-0.5 dark:bg-primexpert-cardDark"
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
      className={cn('mx-auto max-w-3xl space-y-6 px-4 py-8', institutionalListingsPanelClass)}
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('mx-auto max-w-3xl space-y-6 px-4 py-8 pb-16', institutionalListingsPanelClass)}
    >
      <section className={cn(institutionalListingsCardShellClass, 'bg-white p-6 dark:bg-primexpert-cardDark')}>
        <div className="flex items-start justify-between gap-4">
          <motion.div>
            <p className={institutionalListingsCardTitleClass}>
              {buildContactDisplayName(vm.contact)}
            </p>
            <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-black sm:text-3xl">
              {vm.propertyLabel}
            </h1>
          </motion.div>
          <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-400 bg-emerald-50 px-3 py-1.5 dark:bg-emerald-100">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-900" aria-hidden />
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-900">
              {mode === 'client'
                ? t('Connexion sécurisée', 'Secure connection')
                : t('Aperçu interne', 'Internal preview')}
            </span>
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

      <p className="text-center text-[10px] font-semibold leading-relaxed text-white dark:text-white/90">
        {t(
          'Analyse par algorithme — validation professionnelle du courtier requise avant toute diffusion.',
          'Algorithm-based analysis — broker professional validation required before any release.'
        )}
      </p>
    </motion.div>
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
        <div className="mx-auto max-w-3xl px-4 pt-4">
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
