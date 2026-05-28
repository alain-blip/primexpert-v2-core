/**
 * Sprint 5.3 / 5.4 — Clôture & rétribution (PA).
 * Charte Confort 66+ : date de prise de possession, bloc rétribution lecture seule.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { type OffreClotureFieldKey, type OffreClotureInput } from '@primexpert/core/transaction';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { useLanguage } from '../../../lib/i18n';
import {
  institutionalListingsCardHeaderClass,
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
  institutionalListingsInlineInputClass,
} from '../../../lib/institutionalTheme';

const LABEL_CLASS =
  'text-[13px] font-black uppercase tracking-wider text-slate-900';

const DATE_INPUT_CLASS =
  `${institutionalListingsInlineInputClass} h-12 rounded-xl text-[16px] font-black focus:ring-2 focus:ring-primexpert-dark/30`;

export interface OffreClotureRetributionSectionProps {
  cloture: OffreClotureInput;
  locked: boolean;
  onPersist: (next: OffreClotureInput) => Promise<void>;
}

export function OffreClotureRetributionSection({
  cloture,
  locked,
  onPersist,
}: OffreClotureRetributionSectionProps) {
  const { language } = useLanguage();
  const { saving } = useResidenceDocument();
  const t = (fr: string, en: string) => (language === 'fr' ? fr : en);

  const [dateDraft, setDateDraft] = useState(cloture.datePrisePossession ?? '');
  const [savingField, setSavingField] = useState<OffreClotureFieldKey | null>(null);

  useEffect(() => {
    setDateDraft(cloture.datePrisePossession ?? '');
  }, [cloture.datePrisePossession]);

  const saveDate = useCallback(async () => {
    if (locked) return;
    const raw = dateDraft.trim();
    const nextValue = raw.length > 0 ? raw : undefined;
    if (nextValue === cloture.datePrisePossession) return;
    setSavingField('datePrisePossession');
    try {
      await onPersist({ ...cloture, datePrisePossession: nextValue });
    } finally {
      setSavingField(null);
    }
  }, [cloture, dateDraft, locked, onPersist]);

  return (
    <section className={`${institutionalListingsCardShellClass} border-l-8 border-l-indigo-600`}>
      <header className={`${institutionalListingsCardHeaderClass} py-4`}>
        <h3 className={`${institutionalListingsCardTitleClass} text-[13px] tracking-[0.18em]`}>
          {t('[ CLÔTURE & RÉTRIBUTION ]', '[ CLOSING & REMUNERATION ]')}
        </h3>
      </header>

      <div className="grid gap-5 p-5">
        <div className="rounded-xl border-2 border-black/10 bg-white py-4 px-4">
          <p className={`${LABEL_CLASS} mb-2 flex items-center gap-2`}>
            <span>
              {t(
                'Date de prise de possession (jour J — notaire)',
                'Possession date (day D — notary)'
              )}
            </span>
            {savingField === 'datePrisePossession' ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            ) : null}
          </p>
          <input
            type="date"
            disabled={locked || saving}
            value={dateDraft}
            onChange={(e) => setDateDraft(e.target.value)}
            onBlur={() => void saveDate()}
            className={DATE_INPUT_CLASS}
          />
        </div>

        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/40 py-4 px-4">
          <p className={`${LABEL_CLASS} mb-2 flex items-center gap-2`}>
            <Info className="h-4 w-4 text-indigo-700" aria-hidden />
            <span>
              {t(
                'Rétribution applicable (selon mandat)',
                'Applicable remuneration (per listing agreement)'
              )}
            </span>
          </p>
          <p className="text-[15px] font-black leading-relaxed text-black">
            {t(
              "La répartition de la commission est régie par les données validées de l'onglet Finance et du mandat — aucune saisie ici pour éviter les doubles entrées conflictuelles.",
              'Commission allocation is governed by validated data in the Finance tab and listing agreement — no entry here to prevent conflicting duplicate records.'
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
