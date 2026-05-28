import React from 'react';
import { motion } from 'motion/react';
import { formatCurrency } from '../../lib/utils';
import type { PromesseAchatViewModel } from '@primexpert/core/transaction';
import {
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
} from '../../lib/institutionalTheme';

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

export function VendorOfferPanel({
  promesse,
  locale,
  t,
}: {
  promesse: PromesseAchatViewModel;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
}) {
  const price = promesse.input.prixAccepte ?? promesse.input.prixOffert;
  const inspectionDeadline = promesse.deadlines.dateLimiteInspection;
  const financeDeadline = promesse.deadlines.dateLimiteFinancement;

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
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.08 } },
        }}
      >
        {[
          {
            label: t("Délai d'inspection", 'Inspection deadline'),
            value: formatDateLabel(inspectionDeadline, locale),
          },
          {
            label: t('Délai de financement', 'Financing deadline'),
            value: formatDateLabel(financeDeadline, locale),
          },
        ].map((row) => (
          <motion.div
            key={row.label}
            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            className="rounded-2xl border-2 border-primexpert-dark/20 bg-white px-5 py-4"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">
              {row.label}
            </p>
            <p className="mt-2 text-xl font-black text-black">{row.value}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}
