/**
 * Sprint 5.2 / 5.4 — Conditions & délais RPA (PA).
 * Charte Confort 66+ : permis MSSS, dates limites, sauvegarde onBlur.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  type OffreConditionsFieldKey,
  type OffreConditionsInput,
  type TernaryBool,
} from '@primexpert/core/transaction';
import { TernaryToggle } from '../../ui/TernaryToggle';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { useLanguage } from '../../../lib/i18n';

const LABEL_CLASS =
  'text-[13px] font-black uppercase tracking-wider text-[#142c6a]';

const DATE_INPUT_CLASS =
  'h-12 w-full rounded-xl border-2 border-black/20 bg-white px-3 text-[16px] font-black text-black focus:border-[#142c6a] focus:outline-none focus:ring-2 focus:ring-[#142c6a]/30';

export interface OffreConditionsLegalesSectionProps {
  conditions: OffreConditionsInput;
  locked: boolean;
  onPersist: (next: OffreConditionsInput) => Promise<void>;
}

type DateField = 'dateLimiteFinancement' | 'dateLimitePermisMsss';

function draftsFromConditions(c: OffreConditionsInput): Record<DateField, string> {
  return {
    dateLimiteFinancement: c.dateLimiteFinancement ?? '',
    dateLimitePermisMsss: c.dateLimitePermisMsss ?? '',
  };
}

export function OffreConditionsLegalesSection({
  conditions,
  locked,
  onPersist,
}: OffreConditionsLegalesSectionProps) {
  const { language } = useLanguage();
  const { saving } = useResidenceDocument();
  const t = (fr: string, en: string) => (language === 'fr' ? fr : en);

  const [dateDrafts, setDateDrafts] = useState(() => draftsFromConditions(conditions));
  const [savingField, setSavingField] = useState<OffreConditionsFieldKey | null>(null);

  useEffect(() => {
    setDateDrafts(draftsFromConditions(conditions));
  }, [conditions]);

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

  const saveDate = useCallback(
    async (key: DateField) => {
      if (locked) return;
      const raw = dateDrafts[key].trim();
      const nextValue = raw.length > 0 ? raw : undefined;
      if (nextValue === conditions[key]) return;
      setSavingField(key);
      try {
        await onPersist({ ...conditions, [key]: nextValue });
      } finally {
        setSavingField(null);
      }
    },
    [conditions, dateDrafts, locked, onPersist]
  );

  return (
    <section className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm border-l-8 border-l-amber-500">
      <header className="border-b-2 border-slate-100 bg-slate-50/80 px-5 py-4">
        <h3 className="text-[13px] font-black uppercase tracking-[0.18em] text-[#142c6a]">
          {t('[ CONDITIONS & DÉLAIS RPA ]', '[ RPA CONDITIONS & DEADLINES ]')}
        </h3>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="rounded-xl border-2 border-black/10 bg-white py-4 px-4">
          <p className={`${LABEL_CLASS} mb-2 flex items-center gap-2`}>
            <span>
              {t(
                'Date limite — financement hypothécaire',
                'Deadline — mortgage financing'
              )}
            </span>
            {savingField === 'dateLimiteFinancement' ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            ) : null}
          </p>
          <input
            type="date"
            disabled={locked || saving}
            value={dateDrafts.dateLimiteFinancement}
            onChange={(e) =>
              setDateDrafts((prev) => ({
                ...prev,
                dateLimiteFinancement: e.target.value,
              }))
            }
            onBlur={() => void saveDate('dateLimiteFinancement')}
            className={DATE_INPUT_CLASS}
          />
        </div>

        <div className="rounded-xl border-2 border-black/10 bg-white py-4 px-4 lg:col-span-2">
          <p className={`${LABEL_CLASS} mb-2 flex items-center gap-2`}>
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

          <div className="mt-4 border-t border-black/10 pt-4">
            <p className={`${LABEL_CLASS} mb-2 flex items-center gap-2`}>
              <span>{t('Date limite — permis MSSS', 'Deadline — MSSS permit')}</span>
              {savingField === 'dateLimitePermisMsss' ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              ) : null}
            </p>
            <input
              type="date"
              disabled={locked || saving}
              value={dateDrafts.dateLimitePermisMsss}
              onChange={(e) =>
                setDateDrafts((prev) => ({
                  ...prev,
                  dateLimitePermisMsss: e.target.value,
                }))
              }
              onBlur={() => void saveDate('dateLimitePermisMsss')}
              className={DATE_INPUT_CLASS}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
