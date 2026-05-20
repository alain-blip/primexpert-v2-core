/**
 * Sprint 5.4 — Délais OACIQ : saisie en jours, dates calculées depuis l'acceptation.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatIsoDateForDisplay } from '@primexpert/core/transaction';
import type { PromesseAchatInput, PromesseAchatViewModel } from '@primexpert/core/transaction';
import {
  PA_INPUT_CLASS,
  PA_LABEL_CLASS,
  PA_VALUE_CLASS,
  PaConfortPanel,
} from './PaConfortPanel';
import { useLanguage } from '../../../lib/i18n';

type DelayKey =
  | 'visiteLieuxJours'
  | 'verificationDocumentsJours'
  | 'inspectionJours'
  | 'financementJours'
  | 'permisJours';

const DELAY_ROWS: readonly {
  key: DelayKey;
  labelFr: string;
  labelEn: string;
  computedKey: keyof PromesseAchatViewModel['deadlines'];
}[] = [
  {
    key: 'visiteLieuxJours',
    labelFr: 'Visite des lieux',
    labelEn: 'Property visit',
    computedKey: 'dateLimiteVisiteLieux',
  },
  {
    key: 'verificationDocumentsJours',
    labelFr: 'Vérification des documents',
    labelEn: 'Document review',
    computedKey: 'dateLimiteVerificationDocuments',
  },
  {
    key: 'inspectionJours',
    labelFr: 'Inspection',
    labelEn: 'Inspection',
    computedKey: 'dateLimiteInspection',
  },
  {
    key: 'financementJours',
    labelFr: 'Financement hypothécaire',
    labelEn: 'Mortgage financing',
    computedKey: 'dateLimiteFinancement',
  },
  {
    key: 'permisJours',
    labelFr: 'Permis',
    labelEn: 'Permit',
    computedKey: 'dateLimitePermis',
  },
];

export interface PromesseDelaisPaSectionProps {
  form: PromesseAchatInput;
  vm: PromesseAchatViewModel;
  locale: string;
  locked: boolean;
  saving: boolean;
  onPersistDelais: (delais: NonNullable<PromesseAchatInput['delais']>) => void;
}

function DelayRow({
  labelFr,
  labelEn,
  days,
  computedIso,
  locale,
  locked,
  saving,
  onSaveDays,
}: {
  labelFr: string;
  labelEn: string;
  days?: number;
  computedIso?: string;
  locale: string;
  locked: boolean;
  saving: boolean;
  onSaveDays: (days: number | undefined) => void;
}) {
  const { language } = useLanguage();
  const [draft, setDraft] = useState(days != null ? String(days) : '');
  const [savingRow, setSavingRow] = useState(false);

  useEffect(() => {
    setDraft(days != null ? String(days) : '');
  }, [days]);

  const handleBlur = useCallback(() => {
    if (locked) return;
    const trimmed = draft.trim();
    const parsed = trimmed === '' ? undefined : Number(trimmed);
    if (parsed !== undefined && !Number.isFinite(parsed)) return;
    if (parsed === days) return;
    setSavingRow(true);
    try {
      onSaveDays(parsed);
    } finally {
      setSavingRow(false);
    }
  }, [days, draft, locked, onSaveDays]);

  return (
    <div className="grid gap-4 rounded-xl border-2 border-black/10 bg-white py-4 px-4 md:grid-cols-2">
      <div>
        <p className={`${PA_LABEL_CLASS} mb-2 flex items-center gap-2`}>
          <span>
            {language === 'fr'
              ? `${labelFr} — nombre de jours`
              : `${labelEn} — number of days`}
          </span>
          {savingRow ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
        </p>
        <input
          type="number"
          min={0}
          disabled={locked || saving}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className={PA_INPUT_CLASS}
          placeholder="0"
        />
      </div>
      <div>
        <p className={`${PA_LABEL_CLASS} mb-2`}>
          {language === 'fr' ? `${labelFr} — date limite` : `${labelEn} — deadline`}
        </p>
        <p className={PA_VALUE_CLASS}>
          {formatIsoDateForDisplay(computedIso, locale)}
        </p>
      </div>
    </div>
  );
}

export function PromesseDelaisPaSection({
  form,
  vm,
  locale,
  locked,
  saving,
  onPersistDelais,
}: PromesseDelaisPaSectionProps) {
  const { language } = useLanguage();
  const t = (fr: string, en: string) => (language === 'fr' ? fr : en);

  const acceptanceRef = form.dateAcceptation;

  return (
    <PaConfortPanel
      titleFr="[ DATES LIMITES & DÉLAIS ]"
      titleEn="[ DEADLINES & DELAYS ]"
      language={language}
      borderAccentClass="border-l-sky-600"
    >
      <div className="mb-5 rounded-xl border-2 border-sky-200 bg-sky-50/50 py-3 px-4">
        <p className={PA_LABEL_CLASS}>
          {t("Date d'acceptation de la PA (point de référence)", 'PA acceptance date (reference)')}
        </p>
        <p className={`${PA_VALUE_CLASS} mt-2`}>
          {formatIsoDateForDisplay(acceptanceRef, locale)}
        </p>
        {!acceptanceRef ? (
          <p className="mt-2 text-[14px] font-semibold text-black">
            {t(
              'Renseignez la date d\'acceptation ci-dessus pour calculer les échéances.',
              'Enter the acceptance date above to compute deadlines.'
            )}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4">
        {DELAY_ROWS.map((row) => (
          <DelayRow
            key={row.key}
            labelFr={row.labelFr}
            labelEn={row.labelEn}
            days={form.delais?.[row.key]}
            computedIso={vm.deadlines[row.computedKey]}
            locale={locale}
            locked={locked}
            saving={saving}
            onSaveDays={(v) =>
              onPersistDelais({
                ...form.delais,
                [row.key]: v,
              })
            }
          />
        ))}
      </div>
    </PaConfortPanel>
  );
}
