/**
 * Accès Vendeur — portail client externe (mobile-first, premium).
 * Données : organizations/{orgId}/contacts + residences via residenceIds.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, Home, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useLanguage } from '../../lib/i18n';
import { buildContactDisplayName } from '@primexpert/core/crm';
import {
  listOrganizationContacts,
  type ContactServiceContext,
} from '../../services/contacts';
import {
  subscribeVendorPortal,
  type VendorPortalViewModel,
} from '../../services/vendorPortalService';
import { mandateMissingFieldLabels } from '@primexpert/core/residence';
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

function AccesVendeurShell({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-primexpert-blue text-slate-900"
    >
      <header className="sticky top-0 z-30 border-b-2 border-primexpert-dark/20 bg-primexpert-blue/95 backdrop-blur-md">
        <motion.div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/workhub"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primexpert-dark/20 bg-white px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              {t('Retour', 'Back')}
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-widest text-white">
                {t('Accès Vendeur', 'Seller access')}
              </p>
              <p className="truncate text-[10px] font-medium text-white/90">
                {t('Espace client sécurisé', 'Secure client space')}
              </p>
            </div>
          </div>
          <motion.div
            className="flex shrink-0 items-center rounded-lg border border-primexpert-dark/30 bg-white p-0.5"
            role="group"
            aria-label={t('Langue', 'Language')}
          >
            {(['fr', 'en'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase ${
                  language === lang ? 'bg-primexpert-dark text-white' : 'text-slate-700'
                }`}
              >
                {lang}
              </button>
            ))}
          </motion.div>
        </motion.div>
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
  const [sellers, setSellers] = useState<
    { id: string; name: string; residences: number }[]
  >([]);

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
      className={`mx-auto max-w-3xl space-y-6 px-4 py-8 ${institutionalListingsPanelClass}`}
    >
      <section className={`${institutionalListingsCardShellClass} p-6`}>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          {t('Accès Vendeur', 'Seller access')}
        </h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">
          {t(
            'Sélectionnez un vendeur pour ouvrir son espace de suivi de propriété.',
            'Select a seller to open their property follow-up space.'
          )}
        </p>
      </section>

      {sellers.length === 0 ? (
        <p className="rounded-xl border-2 border-primexpert-dark/20 bg-white px-5 py-4 text-sm text-slate-700">
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
                className="flex w-full items-center justify-between gap-4 rounded-2xl border-2 border-primexpert-dark/20 bg-white px-5 py-4 text-left shadow-md transition hover:border-primexpert-dark/40 hover:bg-primexpert-light"
              >
                <div>
                  <p className="font-black text-slate-900">{s.name}</p>
                  <p className="mt-1 text-xs text-slate-700">
                    {s.residences}{' '}
                    {t(
                      s.residences === 1 ? 'propriété liée' : 'propriétés liées',
                      s.residences === 1 ? 'linked property' : 'linked properties'
                    )}
                  </p>
                </div>
                <Home className="h-5 w-5 shrink-0 text-slate-600" aria-hidden />
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

function VendorPortalContent({ vm }: { vm: VendorPortalViewModel }) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const missingLabels = mandateMissingFieldLabels(vm.mandateResult, locale);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mx-auto max-w-3xl space-y-6 px-4 py-8 pb-16 ${institutionalListingsPanelClass}`}
    >
      <section className={`${institutionalListingsCardShellClass} p-6`}>
        <div className="flex items-start justify-between gap-4">
          <motion.div>
            <p className={`${institutionalListingsCardTitleClass} tracking-[0.2em]`}>
              {buildContactDisplayName(vm.contact)}
            </p>
            <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-3xl">
              {vm.propertyLabel}
            </h1>
          </motion.div>
          <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-300 bg-emerald-50 px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-800" aria-hidden />
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-900">
              {t('Connexion sécurisée', 'Secure connection')}
            </span>
          </div>
        </div>
      </section>

      <section className={`${institutionalListingsCardShellClass} p-6`}>
        <h2 className={`${institutionalListingsCardTitleClass} tracking-[0.2em]`}>
          {t('Progression de la vente', 'Sale progress')}
        </h2>
        <div className="mt-6">
          <VendorTimeline activeStageId={vm.timelineStageId} t={t} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VendorComplianceGauge
          percent={vm.mandatePercent}
          label={t('Preuves de conformité', 'Compliance evidence')}
          sublabel={
            missingLabels.length > 0
              ? t(
                  `Éléments à compléter : ${missingLabels.join(', ')}.`,
                  `Items to complete: ${missingLabels.join(', ')}.`
                )
              : t(
                  'Dossier conforme aux exigences de mise en marché.',
                  'File meets listing requirements.'
                )
          }
        />

        <section className={`${institutionalListingsCardShellClass} p-6`}>
          <h2 className={`${institutionalListingsCardTitleClass} tracking-[0.2em]`}>
            {t('Téléversement — diligence', 'Upload — diligence')}
          </h2>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-700">
            {t(
              'Déposez une pièce manquante pour accélérer la vérification par votre courtier.',
              'Upload a missing document to speed up verification by your broker.'
            )}
          </p>
          <motion.div className="mt-4">
            <VendorDocumentDropzone
              propertyId={vm.residenceId}
              brokerId={vm.brokerId}
              t={t}
            />
          </motion.div>
        </section>
      </div>

      {vm.hasActivePromesse && vm.promesse ? (
        <VendorOfferPanel promesse={vm.promesse} locale={locale} t={t} />
      ) : (
        <section className={`${institutionalListingsCardShellClass} px-6 py-8 text-center`}>
          <p className="text-sm font-semibold text-slate-700">
            {t(
              "Aucune promesse d'achat active pour le moment.",
              'No active purchase promise at this time.'
            )}
          </p>
        </section>
      )}

      <p className="text-center text-[10px] font-medium leading-relaxed text-slate-700">
        {t(
          'Analyse par algorithme — validation professionnelle du courtier requise avant toute diffusion.',
          'Algorithm-based analysis — broker professional validation required before any release.'
        )}
      </p>
    </motion.div>
  );
}

export function AccesVendeurPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const contactId = searchParams.get('contactId') ?? '';
  const residenceId = searchParams.get('residenceId') ?? undefined;

  const ctx = useMemo<ContactServiceContext | null>(() => {
    if (!profile?.uid || !profile.orgId) return null;
    return {
      uid: profile.uid,
      orgId: profile.orgId,
      role: profile.role === 'admin_system' ? 'admin_system' : profile.role === 'admin' ? 'admin' : 'member',
    };
  }, [profile?.uid, profile?.orgId, profile?.role]);

  const [vm, setVm] = useState<VendorPortalViewModel | null>(null);
  const [loading, setLoading] = useState(Boolean(contactId));

  useEffect(() => {
    if (!ctx || !contactId) {
      setVm(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeVendorPortal({
      ctx,
      contactId,
      residenceId,
      onUpdate: (next) => {
        setVm(next);
        setLoading(false);
      },
      onError: () => setLoading(false),
    });
    return unsub;
  }, [ctx, contactId, residenceId]);

  const handleSelectContact = (id: string) => {
    setSearchParams({ contactId: id });
  };

  if (!ctx) {
    return (
      <AccesVendeurShell>
        <VendorPortalSkeleton />
      </AccesVendeurShell>
    );
  }

  return (
    <AccesVendeurShell>
      {!contactId ? (
        <ContactPicker ctx={ctx} onSelect={handleSelectContact} t={t} />
      ) : loading ? (
        <VendorPortalSkeleton />
      ) : !vm ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mx-auto max-w-3xl px-4 py-12 text-center"
        >
          <p className="text-sm font-semibold text-slate-900">
            {t(
              'Impossible de charger cette propriété. Vérifiez le lien ou contactez votre courtier.',
              'Unable to load this property. Check the link or contact your broker.'
            )}
          </p>
        </motion.div>
      ) : (
        <VendorPortalContent vm={vm} />
      )}
    </AccesVendeurShell>
  );
}

export default AccesVendeurPage;
