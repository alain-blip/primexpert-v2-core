import React, { useCallback } from 'react';
import {
  CAPACITY_EDITABLE_FIELDS,
  getNestedValue,
  shouldShowRaphaelForField,
} from '@primexpert/core/identity';
import { Loader2 } from 'lucide-react';
import { IdentitySectionCard } from './IdentitySectionCard';
import { RaphaelBadge } from '../../msss/RaphaelBadge';
import { useIdentityFieldSave } from '../../../hooks/useIdentityFieldSave';

/**
 * Effectifs par quart — charte Confort 66+, édition inline permanente.
 *
 * Les unités sont gérées dans la tarification des loyers ; cette section
 * ne couvre que les ressources humaines (effectifs par poste / quart).
 */
export interface EditableCapacitySectionProps {
  residenceDoc: Record<string, unknown>;
  language: 'fr' | 'en';
}

const CAPACITY_INPUT_CLASSES =
  'h-12 w-full rounded-xl border-2 border-black/30 bg-white px-3 text-[16px] font-black text-black focus:border-[#142c6a] focus:outline-none focus:ring-2 focus:ring-[#142c6a]/30';

export function EditableCapacitySection({
  residenceDoc,
  language,
}: EditableCapacitySectionProps) {
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
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
            <div
              key={def.id}
              className="min-w-0 rounded-xl border-2 border-black/10 bg-white py-4 px-4"
            >
              <p className="mb-2 flex items-center gap-2 text-[13px] font-black uppercase tracking-wider text-[#142c6a]">
                <span>{label}</span>
                <RaphaelBadge show={showBadge} />
                {saving ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
              </p>
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setDraft(def.id, e.target.value)}
                onBlur={(e) => void handleBlur(def.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                className={CAPACITY_INPUT_CLASSES}
                placeholder="0"
              />
            </div>
          );
        })}
      </div>
    </IdentitySectionCard>
  );
}
