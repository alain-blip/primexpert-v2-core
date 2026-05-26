/**
 * Modale d'arrêt — confirmation d'écrasement des données financières SSOT.
 */

import React from 'react';
import type { FinancialOverwriteAssessment } from '@primexpert/core/financial';
import { useLanguage } from '../../../lib/i18n';

export interface FinancialOverwriteStopModalProps {
  open: boolean;
  assessment: FinancialOverwriteAssessment;
  busy?: boolean;
  onConfirmOverwrite: () => void;
  onKeepExisting: () => void;
}

function yearRelationLabel(
  relation: FinancialOverwriteAssessment['yearRelation'],
  locale: 'fr' | 'en'
): string {
  if (relation === 'newer') {
    return locale === 'fr' ? 'plus récent' : 'more recent';
  }
  if (relation === 'same' || relation === 'older' || relation === 'unknown') {
    return locale === 'fr' ? 'de la même année' : 'from the same year';
  }
}

export function FinancialOverwriteStopModal({
  open,
  assessment,
  busy = false,
  onConfirmOverwrite,
  onKeepExisting,
}: FinancialOverwriteStopModalProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';

  if (!open) return null;

  const yearPhrase = yearRelationLabel(assessment.yearRelation, locale);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="financial-overwrite-stop-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border-4 border-red-600 bg-white shadow-2xl overflow-hidden">
        <div className="bg-red-600 px-6 py-8 flex flex-col items-center text-center text-white">
          <span
            className="text-[7rem] leading-none drop-shadow-lg select-none"
            role="img"
            aria-label={t('Panneau d’arrêt', 'Stop sign')}
          >
            🛑
          </span>
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em]">
            {t('Arrêt — décision requise', 'Stop — decision required')}
          </p>
        </div>

        <div className="px-6 py-6 space-y-4 text-[#142c6a]">
          <h2 id="financial-overwrite-stop-title" className="text-lg font-black text-center">
            {t('Conflit avec les données financières', 'Conflict with financial data')}
          </h2>

          <ol className="space-y-3 text-[14px] leading-relaxed list-decimal list-inside">
            <li>
              {locale === 'fr'
                ? `L'IA a détecté que ce document est ${yearPhrase}.`
                : `AI detected that this document is ${yearPhrase}.`}
            </li>
            <li>
              {t(
                'Des données existent déjà dans la fiche.',
                'Data already exists on this listing.'
              )}
            </li>
            <li className="font-semibold">
              {t(
                'Voulez-vous écraser les données actuelles ?',
                'Do you want to overwrite the current data?'
              )}
            </li>
          </ol>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={onKeepExisting}
              className="flex-1 rounded-xl border-2 border-slate-300 bg-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              {t('Non, conserver les anciennes', 'No, keep existing data')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirmOverwrite}
              className="flex-1 rounded-xl border-2 border-red-700 bg-red-600 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white hover:bg-red-700 disabled:opacity-50"
            >
              {t('Oui, écraser les données', 'Yes, overwrite data')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
