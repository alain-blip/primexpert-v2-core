import { useCallback, useRef, useState } from 'react';
import {
  buildCapacityFieldSavePatch,
  buildIdentityFieldSavePatch,
  getCapacityFieldDef,
  getIdentityFieldDef,
  resolveIdentityField,
} from '@primexpert/core/identity';
import { useResidenceDocument } from '../context/ResidenceDocumentContext';

export function useIdentityFieldSave() {
  const { residenceDoc, updateResidence } = useResidenceDocument();
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const draftsRef = useRef<Record<string, string>>({});

  const getDraftValue = useCallback(
    (fieldId: string, fallbackDisplay: string) => {
      if (fieldId in draftsRef.current) return draftsRef.current[fieldId];
      return fallbackDisplay === '—' ? '' : fallbackDisplay;
    },
    []
  );

  const setDraft = useCallback((fieldId: string, value: string) => {
    draftsRef.current[fieldId] = value;
  }, []);

  const saveIdentityField = useCallback(
    async (fieldId: string, rawValue: string) => {
      if (!residenceDoc) return;
      setSavingFieldId(fieldId);
      try {
        const patch = buildIdentityFieldSavePatch(residenceDoc, fieldId, rawValue);
        await updateResidence(patch);
        delete draftsRef.current[fieldId];
      } finally {
        setSavingFieldId(null);
      }
    },
    [residenceDoc, updateResidence]
  );

  const saveCapacityField = useCallback(
    async (fieldId: string, rawValue: string) => {
      if (!residenceDoc) return;
      setSavingFieldId(fieldId);
      try {
        const patch = buildCapacityFieldSavePatch(residenceDoc, fieldId, rawValue);
        await updateResidence(patch);
        delete draftsRef.current[fieldId];
      } finally {
        setSavingFieldId(null);
      }
    },
    [residenceDoc, updateResidence]
  );

  const getCapacityDraftValue = useCallback(
    (fieldId: string) => {
      if (fieldId in draftsRef.current) return draftsRef.current[fieldId];
      if (!residenceDoc) return '';
      const def = getCapacityFieldDef(fieldId);
      if (!def) return '';
      const raw = def.nestedPath?.length
        ? resolveIdentityField(residenceDoc, fieldId, def.nestedPath)
        : def.canonicalKey
          ? resolveIdentityField(residenceDoc, def.canonicalKey)
          : undefined;
      if (raw === undefined || raw === null) return '';
      return String(raw);
    },
    [residenceDoc]
  );

  const saveField = useCallback(
    async (fieldId: string, rawValue: string) => {
      if (getCapacityFieldDef(fieldId)) {
        await saveCapacityField(fieldId, rawValue);
      } else {
        await saveIdentityField(fieldId, rawValue);
      }
    },
    [saveIdentityField, saveCapacityField]
  );

  return {
    savingFieldId,
    getDraftValue,
    setDraft,
    saveIdentityField,
    saveCapacityField,
    getCapacityDraftValue,
    saveField,
  };
}
