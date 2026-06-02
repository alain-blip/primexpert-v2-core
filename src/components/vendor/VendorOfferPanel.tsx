import React from 'react';
import { motion } from 'motion/react';
import { formatCurrency } from '../../lib/utils';
import type { PromesseAchatViewModel } from '@primexpert/core/transaction';
import {
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
} from '../../lib/institutionalTheme';
import { cn } from '../../lib/utils';

function formatDateLabel(iso: string | undefined, locale: 'fr' | 'en'): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Jours civils restants avant l'échéance (inclusif, minuit local). */
export function calendarDaysUntilPaDeadline(
  iso: string | undefined,
  nowMs: number = Date.now()
): number | null {
  if (!iso) return null;
  const end = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date(nowMs);
  today.setHours(12, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

type DeadlineRow = {
  label: string;
  value: string;
  urgent?: boolean;
  urgentBadge?: string;
};

export function VendorOfferPanel({
  promesse,
  locale,
  t,
  showSevenCriticalDeadlines = false,
  stressTestFinancingUrgency = false,
}: {
  promesse: PromesseAchatViewModel;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
  /** Affiche les 7 échéances critiques PA acceptée (accès fantôme résidentiel). */
  showSevenCriticalDeadlines?: boolean;
  /** Alerte clignotante J-3 sur le délai de financement bancaire (stress-test démo). */
  stressTestFinancingUrgency?: boolean;
}) {
  const price = promesse.input.prixAccepte ?? promesse.input.prixOffert;
  const inspectionDeadline = promesse.deadlines.dateLimiteInspection;
  const financeDeadline = promesse.deadlines.dateLimiteFinancement;
  const financeDaysLeft = calendarDaysUntilPaDeadline(financeDeadline);
  const financeUrgent =
    stressTestFinancingUrgency && financeDaysLeft != null && financeDaysLeft === 3;

  const deadlineRows: DeadlineRow[] = showSevenCriticalDeadlines
    ? [
        {
          label: t("Délai de réponse à l'offre", 'Offer response deadline'),
          value: formatDateLabel(promesse.deadlines.dateLimiteReponse, locale),
        },
        {
          label: t('Visite des lieux', 'Property visit'),
          value: formatDateLabel(promesse.deadlines.dateLimiteVisiteLieux, locale),
        },
        {
          label: t('Vérification des documents', 'Document review'),
          value: formatDateLabel(promesse.deadlines.dateLimiteVerificationDocuments, locale),
        },
        {
          label: t("Délai d'inspection", 'Inspection deadline'),
          value: formatDateLabel(inspectionDeadline, locale),
        },
        {
          label: t('Délai de financement bancaire', 'Mortgage financing deadline'),
          value: formatDateLabel(financeDeadline, locale),
          urgent: financeUrgent,
          urgentBadge: t('Urgent — J-3 avant expiration', 'Urgent — 3 days before expiry'),
        },
        {
          label: t('Délai de permis', 'Permit deadline'),
          value: formatDateLabel(promesse.deadlines.dateLimitePermis, locale),
        },
        {
          label: t('Délai de dédit (LCI art. 73.2)', 'Revocation deadline (REB Act s. 73.2)'),
          value: formatDateLabel(promesse.deadlines.dateLimiteDeduitLci, locale),
        },
      ]
    : [
        {
          label: t("Délai d'inspection", 'Inspection deadline'),
          value: formatDateLabel(inspectionDeadline, locale),
        },
        {
          label: t('Délai de financement bancaire', 'Mortgage financing deadline'),
          value: formatDateLabel(financeDeadline, locale),
          urgent: financeUrgent,
          urgentBadge: t('Urgent — J-3 avant expiration', 'Urgent — 3 days before expiry'),
        },
      ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${institutionalListingsCardShellClass} rounded-3xl p-6 sm:p-8`}
    >
      <p className={`${institutionalListingsCardTitleClass} tracking-[0.22em]`}>
        {t("Promesse d'achat active", 'Active purchase promise')}
      </p>
      <p className="mt-3 text-4xl font-black tracking-tight text-black sm:text-5xl">
        {price != null ? formatCurrency(price, { maxDecimals: 0 }) : '—'}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-700">
        {t('Prix offert ou accepté', 'Offered or accepted price')}
      </p>

      <motion.div
        className={`mt-8 grid grid-cols-1 gap-4 ${showSevenCriticalDeadlines ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'}`}
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.08 } },
        }}
      >
        {deadlineRows.map((row) => (
          <motion.div
            key={row.label}
            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            className={cn(
              'rounded-2xl border-2 bg-white px-5 py-4',
              row.urgent
                ? 'animate-pulse border-red-500 bg-red-50 shadow-[0_0_0_2px_rgba(239,68,68,0.35)]'
                : 'border-primexpert-dark/20'
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">
              {row.label}
            </p>
            {row.urgent && row.urgentBadge ? (
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-red-700">
                {row.urgentBadge}
              </p>
            ) : null}
            <p className="mt-2 text-xl font-black text-black">{row.value}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}
