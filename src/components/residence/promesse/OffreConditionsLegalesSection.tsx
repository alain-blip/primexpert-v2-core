/**
 * Sprint 5.2 / 5.4 — Conditions suspensives RPA (PA).
 * Dates limites financement / permis : SSOT via promesseAchat.delais (section « Dates limites & délais »).
 */

import React, { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  type OffreConditionsFieldKey,
  type OffreConditionsInput,
  type TernaryBool,
} from '@primexpert/core/transaction';
import { TernaryToggle } from '../../ui/TernaryToggle';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { useLanguage } from '../../../lib/i18n';
import { PA_LABEL_CLASS } from './PaConfortPanel';

export interface OffreConditionsLegalesSectionProps {
  conditions: OffreConditionsInput;
  locked: boolean;
  onPersist: (next: OffreConditionsInput) => Promise<void>;
}

export function OffreConditionsLegalesSection({
  conditions,
  locked,
  onPersist,
}: OffreConditionsLegalesSectionProps) {
  const { language } = useLanguage();
  const { saving } = useResidenceDocument();
  const t = (fr: string, en: string) => (language === 'fr' ? fr : en);

  const [savingField, setSavingField] = useState<OffreConditionsFieldKey | null>(null);

  const saveTernary = useCallback(
    async (key: 'conditionPermisMsss', value: TernaryBool) => {
      if (locked || conditions[key] === value) return;
      setSavingField(key);
      try {
        await onPersist({ ...conditions, [key]: value });
      } finally {
        setSavingField(null);
      }
    },
    [conditions, locked, onPersist]
  );

  return (
    <section className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm border-l-8 border-l-amber-500">
      <header className="border-b-2 border-slate-100 bg-slate-50/80 px-5 py-4">
        <h3 className="text-[13px] font-black uppercase tracking-[0.18em] text-[#142c6a]">
          {t('[ CONDITIONS SUSPENSIVES RPA ]', '[ RPA SUSPENSIVE CONDITIONS ]')}
        </h3>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <p className="lg:col-span-2 text-[14px] font-semibold leading-relaxed text-black rounded-xl border-2 border-amber-100 bg-amber-50/40 py-3 px-4">
          {t(
            'Les dates limites de financement et de permis sont calculées à partir des délais en jours (section « Dates limites & délais ») et de la date d\'acceptation.',
            'Financing and permit deadlines are computed from delay days (« Deadlines & delays ») and the acceptance date.'
          )}
        </p>

        <div className="rounded-xl border-2 border-black/10 bg-white py-4 px-4 lg:col-span-2">
          <p className={`${PA_LABEL_CLASS} mb-2 flex items-center gap-2`}>
            <span>
              {t(
                "Condition — permis d'exploitation MSSS (CIUSSS)",
                'Condition — MSSS operating permit (CIUSSS)'
              )}
            </span>
            {savingField === 'conditionPermisMsss' ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            ) : null}
          </p>
          <TernaryToggle
            value={conditions.conditionPermisMsss ?? null}
            onChange={(v) => void saveTernary('conditionPermisMsss', v)}
            disabled={locked || saving}
            language={language}
            ariaLabel={t('Permis MSSS', 'MSSS permit')}
          />
          <p className="mt-3 text-[14px] font-semibold leading-relaxed text-black">
            {t(
              "Sans levée de cette condition avant la date limite, la promesse d'achat devient caduque — le transfert ne peut pas être complété légalement.",
              'If this condition is not waived before the deadline, the purchase promise becomes void — the transfer cannot be completed legally.'
            )}
          </p>

        </div>
      </div>
    </section>
  );
}
