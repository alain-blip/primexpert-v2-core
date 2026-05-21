import React, { useCallback, type ReactNode } from 'react';
import type { IdentitySectionView } from '@primexpert/core/identity';
import { IdentitySectionCard } from './IdentitySectionCard';
import { EditableFieldGrid } from './EditableFieldGrid';
import { useIdentityFieldSave } from '../../../hooks/useIdentityFieldSave';

/**
 * Bloc d'édition d'une section d'identité — charte Confort 66+.
 *
 * Le bouton "Modifier" et l'état `editing` ont été supprimés : tous les
 * champs sont éditables en permanence, avec sauvegarde Firestore à la
 * sortie du champ (onBlur) ou sur Enter.
 */
export interface EditableIdentitySectionProps {
  section: IdentitySectionView;
  language: 'fr' | 'en';
  /** Contenu affiché en tête de section (ex. attribution courtier responsable). */
  leadingContent?: ReactNode;
}

export function EditableIdentitySection({
  section,
  language,
  leadingContent,
}: EditableIdentitySectionProps) {
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
    <IdentitySectionCard title={title} accent={section.accent}>
      {leadingContent}
      <EditableFieldGrid
        fields={section.fields}
        language={language}
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
