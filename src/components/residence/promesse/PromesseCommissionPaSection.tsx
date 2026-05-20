/**
 * Sprint 5.4 — Commission & courtiers (Confort 66+, édition inline onBlur).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatCurrencyCad } from '@primexpert/core/transaction';
import type {
  PromesseAchatInput,
  PromesseAchatViewModel,
  PromesseCollaborator,
  PromesseCommissionInput,
} from '@primexpert/core/transaction';
import {
  PA_INPUT_CLASS,
  PA_LABEL_CLASS,
  PA_VALUE_CLASS,
  PaConfortPanel,
} from './PaConfortPanel';
import { useLanguage } from '../../../lib/i18n';

export interface PromesseCommissionPaSectionProps {
  form: PromesseAchatInput;
  vm: PromesseAchatViewModel;
  locked: boolean;
  saving: boolean;
  onPersistCommission: (commission: PromesseCommissionInput) => void;
  onPersistCollaborateur: (courtier: PromesseCollaborator) => void;
}

function InlineNumberField({
  labelFr,
  labelEn,
  value,
  locked,
  saving,
  onSave,
}: {
  labelFr: string;
  labelEn: string;
  value?: number;
  locked: boolean;
  saving: boolean;
  onSave: (v: number | undefined) => void;
}) {
  const { language } = useLanguage();
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(value != null ? String(value) : '');
  }, [value]);

  const handleBlur = () => {
    if (locked) return;
    const trimmed = draft.trim();
    const parsed = trimmed === '' ? undefined : Number(trimmed.replace(',', '.'));
    if (parsed !== undefined && !Number.isFinite(parsed)) return;
    if (parsed === value) return;
    setBusy(true);
    try {
      onSave(parsed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-black/10 bg-white py-4 px-4">
      <p className={`${PA_LABEL_CLASS} mb-2 flex items-center gap-2`}>
        <span>{language === 'fr' ? labelFr : labelEn}</span>
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
      </p>
      <input
        type="number"
        step="0.01"
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
  );
}

function InlineTextField({
  labelFr,
  labelEn,
  value,
  locked,
  saving,
  onSave,
}: {
  labelFr: string;
  labelEn: string;
  value?: string;
  locked: boolean;
  saving: boolean;
  onSave: (v: string) => void;
}) {
  const { language } = useLanguage();
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const handleBlur = () => {
    if (locked) return;
    const trimmed = draft.trim();
    if (trimmed === (value ?? '')) return;
    setBusy(true);
    try {
      onSave(trimmed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-black/10 bg-white py-4 px-4">
      <p className={`${PA_LABEL_CLASS} mb-2 flex items-center gap-2`}>
        <span>{language === 'fr' ? labelFr : labelEn}</span>
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
      </p>
      <input
        type="text"
        disabled={locked || saving}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={PA_INPUT_CLASS}
      />
    </div>
  );
}

export function PromesseCommissionPaSection({
  form,
  vm,
  locked,
  saving,
  onPersistCommission,
  onPersistCollaborateur,
}: PromesseCommissionPaSectionProps) {
  const { language } = useLanguage();
  const t = (fr: string, en: string) => (language === 'fr' ? fr : en);

  return (
    <PaConfortPanel
      titleFr="[ COMMISSION & COURTIERS COLLABORATEURS ]"
      titleEn="[ COMMISSION & COLLABORATING BROKERS ]"
      language={language}
      borderAccentClass="border-l-violet-600"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <InlineNumberField
          labelFr="Commission totale (%)"
          labelEn="Total commission (%)"
          value={form.commission?.totalePct}
          locked={locked}
          saving={saving}
          onSave={(v) =>
            onPersistCommission({
              ...form.commission,
              totalePct: v,
            })
          }
        />
        <InlineNumberField
          labelFr="Commission courtier inscripteur (%)"
          labelEn="Listing broker commission (%)"
          value={form.commission?.inscripteurPct}
          locked={locked}
          saving={saving}
          onSave={(v) =>
            onPersistCommission({
              ...form.commission,
              inscripteurPct: v,
            })
          }
        />
        <InlineNumberField
          labelFr="Commission courtier collaborateur (%)"
          labelEn="Co-broker commission (%)"
          value={form.commission?.collaborateurPct}
          locked={locked}
          saving={saving}
          onSave={(v) =>
            onPersistCommission({
              ...form.commission,
              collaborateurPct: v,
            })
          }
        />
      </div>

      <div className="mt-5 rounded-xl border-2 border-violet-200 bg-violet-50/40 py-3 px-4">
        <p className={PA_LABEL_CLASS}>
          {t('Montant de la commission totale ($)', 'Total commission amount ($)')}
        </p>
        <p className={`${PA_VALUE_CLASS} mt-2`}>
          {formatCurrencyCad(vm.commission.montantCommissionTotale)}
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <p className={`${PA_LABEL_CLASS} md:col-span-2`}>
          {t('Courtier collaborateur (partie adverse)', 'Collaborating broker (other side)')}
        </p>
        <InlineTextField
          labelFr="Nom"
          labelEn="Name"
          value={form.courtierCollaborateur?.nom}
          locked={locked}
          saving={saving}
          onSave={(v) =>
            onPersistCollaborateur({
              ...form.courtierCollaborateur,
              nom: v,
            })
          }
        />
        <InlineTextField
          labelFr="Téléphone"
          labelEn="Phone"
          value={form.courtierCollaborateur?.telephone}
          locked={locked}
          saving={saving}
          onSave={(v) =>
            onPersistCollaborateur({
              ...form.courtierCollaborateur,
              telephone: v,
            })
          }
        />
        <InlineTextField
          labelFr="Courriel"
          labelEn="Email"
          value={form.courtierCollaborateur?.courriel}
          locked={locked}
          saving={saving}
          onSave={(v) =>
            onPersistCollaborateur({
              ...form.courtierCollaborateur,
              courriel: v,
            })
          }
        />
        <InlineNumberField
          labelFr="Part de commission (%)"
          labelEn="Commission share (%)"
          value={form.courtierCollaborateur?.partCommissionPct}
          locked={locked}
          saving={saving}
          onSave={(v) =>
            onPersistCollaborateur({
              ...form.courtierCollaborateur,
              partCommissionPct: v,
            })
          }
        />
      </div>
    </PaConfortPanel>
  );
}
