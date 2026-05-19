import React, { useCallback, useState } from 'react';
import type { IdentitySectionView } from '@primexpert/core/identity';
import { Pencil, X, Check } from 'lucide-react';
import { IdentitySectionCard } from './IdentitySectionCard';
import { EditableFieldGrid } from './EditableFieldGrid';
import { useIdentityFieldSave } from '../../../hooks/useIdentityFieldSave';
import { cn } from '../../../lib/utils';

export interface EditableIdentitySectionProps {
  section: IdentitySectionView;
  language: 'fr' | 'en';
}

export function EditableIdentitySection({ section, language }: EditableIdentitySectionProps) {
  const [editing, setEditing] = useState(false);
  const { savingFieldId, getDraftValue, setDraft, saveIdentityField } = useIdentityFieldSave();

  const title = language === 'fr' ? section.titleFr : section.titleEn;

  const handleSaveField = useCallback(
    async (fieldId: string) => {
      const field = section.fields.find((f) => f.id === fieldId);
      if (!field) return;
      const raw = getDraftValue(fieldId, field.value);
      await saveIdentityField(fieldId, raw);
    },
    [section.fields, getDraftValue, saveIdentityField]
  );

  return (
    <IdentitySectionCard
      title={title}
      accent={section.accent}
      headerAction={
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition',
            editing
              ? 'border-slate-300 bg-white text-slate-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-[#D4AF37]/50 hover:text-[#142c6a]'
          )}
        >
          {editing ? (
            <>
              <X className="h-3 w-3" />
              {language === 'fr' ? 'Terminer' : 'Done'}
            </>
          ) : (
            <>
              <Pencil className="h-3 w-3" />
              {language === 'fr' ? 'Modifier' : 'Edit'}
            </>
          )}
        </button>
      }
    >
      {editing ? (
        <p className="mb-3 text-[10px] text-slate-500 flex items-center gap-1">
          <Check className="h-3 w-3 text-emerald-600" />
          {language === 'fr'
            ? 'Sauvegarde automatique à la sortie du champ.'
            : 'Auto-saves when you leave a field.'}
        </p>
      ) : null}
      <EditableFieldGrid
        fields={section.fields}
        language={language}
        editing={editing}
        savingFieldId={savingFieldId}
        getDraftValue={(fieldId) => {
          const field = section.fields.find((f) => f.id === fieldId);
          return getDraftValue(fieldId, field?.value ?? '');
        }}
        onDraftChange={setDraft}
        onSaveField={handleSaveField}
      />
    </IdentitySectionCard>
  );
}
