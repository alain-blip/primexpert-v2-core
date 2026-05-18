import React, { useCallback, useState } from 'react';
import {
  CAPACITY_EDITABLE_FIELDS,
  getNestedValue,
  shouldShowRaphaelForField,
} from '@primexpert/core/identity';
import { Pencil, X, Loader2 } from 'lucide-react';
import { IdentitySectionCard } from './IdentitySectionCard';
import { RaphaelBadge } from '../../msss/RaphaelBadge';
import { useIdentityFieldSave } from '../../../hooks/useIdentityFieldSave';
import { cn } from '../../../lib/utils';

export interface EditableCapacitySectionProps {
  residenceDoc: Record<string, unknown>;
  language: 'fr' | 'en';
}

/** Effectifs RH — les unités sont gérées dans Tarification des loyers. */
export function EditableCapacitySection({
  residenceDoc,
  language,
}: EditableCapacitySectionProps) {
  const [editing, setEditing] = useState(false);
  const { savingFieldId, getCapacityDraftValue, setDraft, saveCapacityField } =
    useIdentityFieldSave();

  const t = (fr: string, en: string) => (language === 'fr' ? fr : en);

  const handleBlur = useCallback(
    async (fieldId: string, value: string) => {
      setDraft(fieldId, value);
      await saveCapacityField(fieldId, value);
    },
    [setDraft, saveCapacityField]
  );

  return (
    <IdentitySectionCard
      title={t('Effectifs par quart', 'Staffing by shift')}
      accent="#059669"
      headerAction={
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition',
            editing
              ? 'border-slate-300 bg-white text-slate-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-[#D4AF37]/50 hover:text-[#000000]'
          )}
        >
          {editing ? (
            <>
              <X className="h-3 w-3" />
              {t('Terminer', 'Done')}
            </>
          ) : (
            <>
              <Pencil className="h-3 w-3" />
              {t('Modifier', 'Edit')}
            </>
          )}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CAPACITY_EDITABLE_FIELDS.map((def) => {
          const label = language === 'fr' ? def.labelFr : def.labelEn;
          const path = def.nestedPath ?? (def.canonicalKey ? [def.canonicalKey] : [def.id]);
          const raw = getNestedValue(residenceDoc, path);
          const parentKey = def.confirmedPath?.[0];
          const parent = parentKey ? getNestedValue(residenceDoc, [parentKey]) : null;
          const confirmedBy =
            parent && typeof parent === 'object' && !Array.isArray(parent)
              ? (parent as Record<string, unknown>).confirmedBy
              : undefined;
          const showBadge = shouldShowRaphaelForField(residenceDoc, def.id, {
            value: raw,
            confirmedBy,
          });
          const value = getCapacityDraftValue(def.id);
          const saving = savingFieldId === def.id;

          return (
            <div key={def.id} className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <span>{label}</span>
                <RaphaelBadge show={showBadge} />
                {saving ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : null}
              </p>
              {editing ? (
                <input
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) => setDraft(def.id, e.target.value)}
                  onBlur={(e) => void handleBlur(def.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#000000] focus:border-[#D4AF37]/60 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/30"
                  placeholder="0"
                />
              ) : (
                <p
                  className={cn(
                    'text-sm font-semibold text-[#000000]',
                    !value && 'text-slate-400 font-normal italic'
                  )}
                >
                  {value || '—'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </IdentitySectionCard>
  );
}
