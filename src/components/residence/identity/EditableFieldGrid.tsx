import React, { useCallback, useEffect, useState } from 'react';
import type { IdentityFieldRow } from '@primexpert/core/identity';
import { RaphaelBadge } from '../../msss/RaphaelBadge';
import { cn } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface EditableFieldGridProps {
  fields: IdentityFieldRow[];
  language: 'fr' | 'en';
  editing: boolean;
  savingFieldId: string | null;
  getDraftValue: (fieldId: string) => string;
  onDraftChange: (fieldId: string, value: string) => void;
  onSaveField: (fieldId: string) => void;
}

export function EditableFieldGrid({
  fields,
  language,
  editing,
  savingFieldId,
  getDraftValue,
  onDraftChange,
  onSaveField,
}: EditableFieldGridProps) {
  if (fields.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        {language === 'fr' ? 'Aucune donnée renseignée.' : 'No data on file.'}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
      {fields.map((field) => (
        <FieldCell
          key={field.id}
          field={field}
          language={language}
          editing={editing}
          saving={savingFieldId === field.id}
          draft={getDraftValue(field.id)}
          onDraftChange={(v) => onDraftChange(field.id, v)}
          onSave={() => onSaveField(field.id)}
        />
      ))}
    </div>
  );
}

function FieldCell({
  field,
  language,
  editing,
  saving,
  draft,
  onDraftChange,
  onSave,
}: {
  field: IdentityFieldRow;
  language: 'fr' | 'en';
  editing: boolean;
  saving: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onSave: () => void;
}) {
  const [local, setLocal] = useState(draft);

  useEffect(() => {
    setLocal(draft);
  }, [draft]);

  const handleBlur = useCallback(() => {
    if (local !== draft) {
      onDraftChange(local);
    }
    onSave();
  }, [local, draft, onDraftChange, onSave]);

  const label = language === 'fr' ? field.labelFr : field.labelEn;
  const isSprinkler = field.inputType === 'sprinkler';
  const isNumber =
    field.inputType === 'number' ||
    field.inputType === 'currency' ||
    field.inputType === 'percent';

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
        <span>{label}</span>
        <RaphaelBadge show={field.showRaphaelBadge} />
        {saving ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : null}
      </p>
      {editing ? (
        isSprinkler ? (
          <select
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              onDraftChange(e.target.value);
            }}
            onBlur={handleBlur}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#000000] focus:border-[#D4AF37]/60 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/30"
          >
            <option value="">{language === 'fr' ? '—' : '—'}</option>
            <option value="Oui">{language === 'fr' ? 'Oui' : 'Yes'}</option>
            <option value="Non">{language === 'fr' ? 'Non' : 'No'}</option>
          </select>
        ) : (
          <input
            type={isNumber ? 'number' : 'text'}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#000000] placeholder:text-slate-400 focus:border-[#D4AF37]/60 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/30"
            placeholder={language === 'fr' ? 'Saisir…' : 'Enter…'}
          />
        )
      ) : (
        <p
          className={cn(
            'text-sm font-semibold text-[#000000] break-words',
            field.empty && 'text-slate-400 font-normal italic'
          )}
        >
          {field.value}
        </p>
      )}
    </div>
  );
}
