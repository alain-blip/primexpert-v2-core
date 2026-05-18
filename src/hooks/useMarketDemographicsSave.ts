import { useCallback, useRef, useState } from 'react';
import {
  buildMarcheDemographiePatch,
  type MarcheDemographie,
} from '@primexpert/core/market';
import { useResidenceDocument } from '../context/ResidenceDocumentContext';

export type DemographicFieldId = 'population15_24' | 'population25_54' | 'population75_plus';

export function useMarketDemographicsSave() {
  const { residenceDoc, updateResidence } = useResidenceDocument();
  const [savingFieldId, setSavingFieldId] = useState<DemographicFieldId | null>(null);
  const draftsRef = useRef<Partial<Record<DemographicFieldId, string>>>({});

  const getCurrentNested = useCallback((): MarcheDemographie => {
    const raw = residenceDoc?.marcheDemographie;
    return raw && typeof raw === 'object' ? (raw as MarcheDemographie) : {};
  }, [residenceDoc]);

  const getDraft = useCallback(
    (fieldId: DemographicFieldId, display: string) => {
      if (fieldId in draftsRef.current) return draftsRef.current[fieldId]!;
      return display === '—' ? '' : display.replace(/\s/g, '');
    },
    []
  );

  const setDraft = useCallback((fieldId: DemographicFieldId, value: string) => {
    draftsRef.current[fieldId] = value;
  }, []);

  const saveDemographicField = useCallback(
    async (fieldId: DemographicFieldId, rawValue: string) => {
      if (!residenceDoc) return;
      setSavingFieldId(fieldId);
      try {
        const patch = buildMarcheDemographiePatch(getCurrentNested(), fieldId, rawValue);
        await updateResidence(patch);
        delete draftsRef.current[fieldId];
      } finally {
        setSavingFieldId(null);
      }
    },
    [residenceDoc, updateResidence, getCurrentNested]
  );

  return { savingFieldId, getDraft, setDraft, saveDemographicField };
}
