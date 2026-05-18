import { useCallback, useRef, useState } from 'react';
import type { MarketDiagnosticFieldId } from '@primexpert/core/market';
import { useResidenceDocument } from '../context/ResidenceDocumentContext';

const DIAGNOSTIC_FIELDS: MarketDiagnosticFieldId[] = [
  'avantagesConcurrentiels',
  'pointsAmeliorer',
  'positionnementMarche',
];

export function useMarketFieldSave() {
  const { residenceDoc, updateResidence } = useResidenceDocument();
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const draftsRef = useRef<Record<string, string>>({});

  const getFieldValue = useCallback(
    (fieldId: MarketDiagnosticFieldId): string => {
      if (fieldId in draftsRef.current) return draftsRef.current[fieldId];
      const raw = residenceDoc?.[fieldId];
      return typeof raw === 'string' ? raw : '';
    },
    [residenceDoc]
  );

  const setDraft = useCallback((fieldId: string, value: string) => {
    draftsRef.current[fieldId] = value;
  }, []);

  const saveDiagnosticField = useCallback(
    async (fieldId: MarketDiagnosticFieldId, rawValue: string) => {
      if (!residenceDoc) return;
      const stored =
        typeof residenceDoc[fieldId] === 'string' ? (residenceDoc[fieldId] as string) : '';
      if (rawValue === stored) {
        delete draftsRef.current[fieldId];
        return;
      }
      setSavingFieldId(fieldId);
      try {
        await updateResidence({ [fieldId]: rawValue });
        delete draftsRef.current[fieldId];
      } finally {
        setSavingFieldId(null);
      }
    },
    [residenceDoc, updateResidence]
  );

  const isDiagnosticField = (id: string): id is MarketDiagnosticFieldId =>
    (DIAGNOSTIC_FIELDS as readonly string[]).includes(id);

  return {
    savingFieldId,
    getFieldValue,
    setDraft,
    saveDiagnosticField,
    isDiagnosticField,
  };
}
