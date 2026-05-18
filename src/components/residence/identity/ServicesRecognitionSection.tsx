import React, { useCallback, useState } from 'react';
import type { ServicesRecognitionView } from '@primexpert/core/identity';
import { Pencil, X } from 'lucide-react';
import { IdentitySectionCard } from './IdentitySectionCard';
import { EditableFieldGrid } from './EditableFieldGrid';
import { useIdentityFieldSave } from '../../../hooks/useIdentityFieldSave';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { buildServiceBadgeTogglePatch } from '@primexpert/core/identity';
import { cn } from '../../../lib/utils';

export interface ServicesRecognitionSectionProps {
  services: ServicesRecognitionView;
  language: 'fr' | 'en';
}

export function ServicesRecognitionSection({
  services,
  language,
}: ServicesRecognitionSectionProps) {
  const [editing, setEditing] = useState(false);
  const { residenceDoc, updateResidence } = useResidenceDocument();
  const { savingFieldId, getDraftValue, setDraft, saveIdentityField } = useIdentityFieldSave();

  const t = (fr: string, en: string) => (language === 'fr' ? fr : en);

  const handleSaveField = useCallback(
    async (fieldId: string) => {
      const field = services.fields.find((f) => f.id === fieldId);
      if (!field) return;
      const raw = getDraftValue(fieldId, field.value);
      await saveIdentityField(fieldId, raw);
    },
    [services.fields, getDraftValue, saveIdentityField]
  );

  const toggleBadge = useCallback(
    async (badgeId: string, next: boolean) => {
      if (!residenceDoc || !editing) return;
      const patch = buildServiceBadgeTogglePatch(residenceDoc, badgeId, next);
      await updateResidence(patch);
    },
    [residenceDoc, editing, updateResidence]
  );

  return (
    <IdentitySectionCard
      title={t('Services & Reconnaissance', 'Services & recognition')}
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
      <EditableFieldGrid
        fields={services.fields}
        language={language}
        editing={editing}
        savingFieldId={savingFieldId}
        getDraftValue={(fieldId) => {
          const field = services.fields.find((f) => f.id === fieldId);
          return getDraftValue(fieldId, field?.value ?? '');
        }}
        onDraftChange={setDraft}
        onSaveField={handleSaveField}
      />

      <div className="mt-6 pt-5 border-t border-slate-100">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">
          {t('Puces de services', 'Service badges')}
        </p>
        <div className="flex flex-wrap gap-2">
          {services.badges.map((badge) => (
            <button
              key={badge.id}
              type="button"
              disabled={!editing}
              onClick={() => void toggleBadge(badge.id, !badge.active)}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition',
                badge.active
                  ? 'border-emerald-300 bg-emerald-50 text-[#000000]'
                  : 'border-slate-200 bg-white text-slate-500',
                !editing && 'cursor-default opacity-90',
                editing && 'hover:border-[#D4AF37]/50'
              )}
            >
              {language === 'fr' ? badge.labelFr : badge.labelEn}
            </button>
          ))}
        </div>
      </div>
    </IdentitySectionCard>
  );
}
