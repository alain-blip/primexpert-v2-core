import React, { useCallback, useEffect, useState } from 'react';
import type { IdentityFieldRow } from '@primexpert/core/identity';
import { RaphaelBadge } from '../../msss/RaphaelBadge';
import { Loader2 } from 'lucide-react';

/**
 * Grille de champs éditables — charte Confort 66+ (inline, pas de toggle d'édition).
 *
 * Chaque cellule expose en permanence son <input> ou <select> natif. La
 * sauvegarde Firestore est déclenchée à la sortie du champ (onBlur) ou
 * sur Enter, via le hook `useIdentityFieldSave` (consommé par les
 * sections parentes — pas d'écriture directe ici).
 */
export interface EditableFieldGridProps {
  fields: IdentityFieldRow[];
  language: 'fr' | 'en';
  savingFieldId: string | null;
  getDraftValue: (fieldId: string) => string;
  onDraftChange: (fieldId: string, value: string) => void;
  onSaveField: (fieldId: string) => void;
}

export function EditableFieldGrid({
  fields,
  language,
  savingFieldId,
  getDraftValue,
  onDraftChange,
  onSaveField,
}: EditableFieldGridProps) {
  if (fields.length === 0) {
    return (
      <p className="text-[15px] font-semibold text-slate-500 italic">
        {language === 'fr' ? 'Aucune donnée renseignée.' : 'No data on file.'}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <FieldCell
          key={field.id}
          field={field}
          language={language}
          saving={savingFieldId === field.id}
          draft={getDraftValue(field.id)}
          onDraftChange={(v) => onDraftChange(field.id, v)}
          onSave={() => onSaveField(field.id)}
        />
      ))}
    </div>
  );
}

const TEXT_INPUT_CLASSES =
  'h-12 w-full rounded-xl border-2 border-black/30 bg-white px-3 text-[16px] font-black text-black placeholder-slate-400 focus:border-[#142c6a] focus:outline-none focus:ring-2 focus:ring-[#142c6a]/30';

function FieldCell({
  field,
  language,
  saving,
  draft,
  onDraftChange,
  onSave,
}: {
  field: IdentityFieldRow;
  language: 'fr' | 'en';
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
    <div className="min-w-0 rounded-xl border-2 border-black/10 bg-white py-4 px-4">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-black uppercase tracking-wider text-[#142c6a]">
        <span>{label}</span>
        <RaphaelBadge show={field.showRaphaelBadge} />
        {saving ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
      </p>
      {isSprinkler ? (
        <select
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            onDraftChange(e.target.value);
          }}
          onBlur={handleBlur}
          className={TEXT_INPUT_CLASSES}
        >
          <option value="">—</option>
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
          className={TEXT_INPUT_CLASSES}
          placeholder={language === 'fr' ? 'Saisir…' : 'Enter…'}
        />
      )}
    </div>
  );
}
