/**
 * ResidenceDataContext — SSOT inter-onglets fiche résidence (prix, adresse, unités).
 * Fusionne la prop liste + listener Firestore `ResidenceDocumentContext`.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getListingPrice,
  getListingPricePerUnit,
  getResidenceTotalUnits,
} from '@primexpert/core/residence';
import type { Residence } from '../services/residences';
import { mergeResidenceWithFirestoreDoc } from '../services/residences';
import { useResidenceDocument } from './ResidenceDocumentContext';

export interface ResidenceDataContextValue {
  residence: Residence;
  residenceId: string;
  residenceRecord: Record<string, unknown>;
  listingPrice: number;
  totalUnits: number;
  pricePerUnit: number | null;
  loading: boolean;
  saving: boolean;
  saveError: string | null;
  error: Error | null;
  isInProvider: boolean;
  updateResidence: (patch: Record<string, unknown>) => Promise<void>;
  applyOptimisticPatch: (patch: Partial<Residence>) => void;
}

const ResidenceDataContext = createContext<ResidenceDataContextValue | null>(null);

function buildResidenceDataValue(input: {
  baseResidence: Residence;
  residenceDoc: Record<string, unknown> | null;
  optimisticPatch: Partial<Residence>;
  loading: boolean;
  saving: boolean;
  saveError: string | null;
  error: Error | null;
  isInProvider: boolean;
  updateResidence: (patch: Record<string, unknown>) => Promise<void>;
  applyOptimisticPatch: (patch: Partial<Residence>) => void;
}): ResidenceDataContextValue {
  const merged = mergeResidenceWithFirestoreDoc(input.baseResidence, input.residenceDoc);
  const residence = { ...merged, ...input.optimisticPatch, id: input.baseResidence.id } as Residence;
  const residenceRecord = { ...merged, ...input.optimisticPatch } as Record<string, unknown>;
  const listingPrice = getListingPrice(residence);
  const canonicalPriceFields = {
    price: listingPrice,
    prixDemande: listingPrice,
    askingPrice: listingPrice,
    prixAnnonce: listingPrice,
  };
  const residenceWithCanonicalPrice = { ...residence, ...canonicalPriceFields } as Residence;
  const recordWithCanonicalPrice = { ...residenceRecord, ...canonicalPriceFields };

  return {
    residence: residenceWithCanonicalPrice,
    residenceId: residence.id,
    residenceRecord: recordWithCanonicalPrice,
    listingPrice,
    totalUnits: getResidenceTotalUnits(residence),
    pricePerUnit: getListingPricePerUnit(residence),
    loading: input.loading,
    saving: input.saving,
    saveError: input.saveError,
    error: input.error,
    isInProvider: input.isInProvider,
    updateResidence: input.updateResidence,
    applyOptimisticPatch: input.applyOptimisticPatch,
  };
}

export interface ResidenceDataProviderProps {
  baseResidence: Residence;
  children: ReactNode;
}

export function ResidenceDataProvider({ baseResidence, children }: ResidenceDataProviderProps) {
  const {
    residenceDoc,
    loading,
    saving,
    saveError,
    error,
    isInProvider,
    updateResidence: updateFirestoreResidence,
  } = useResidenceDocument();
  const [optimisticPatch, setOptimisticPatch] = useState<Partial<Residence>>({});

  const applyOptimisticPatch = useCallback((patch: Partial<Residence>) => {
    setOptimisticPatch((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(
    () =>
      buildResidenceDataValue({
        baseResidence,
        residenceDoc: residenceDoc as Record<string, unknown> | null,
        optimisticPatch,
        loading,
        saving,
        saveError,
        error,
        isInProvider,
        updateResidence: updateFirestoreResidence,
        applyOptimisticPatch,
      }),
    [
      baseResidence,
      residenceDoc,
      optimisticPatch,
      loading,
      saving,
      saveError,
      error,
      isInProvider,
      updateFirestoreResidence,
      applyOptimisticPatch,
    ]
  );

  return (
    <ResidenceDataContext.Provider value={value}>{children}</ResidenceDataContext.Provider>
  );
}

/** SSOT fiche résidence — priorité au Provider, repli prop + Firestore (portail vendeur). */
export function useUnifiedResidence(fallbackResidence: Residence): ResidenceDataContextValue {
  const ctx = useContext(ResidenceDataContext);
  const docCtx = useResidenceDocument();

  return useMemo(() => {
    if (ctx) return ctx;
    return buildResidenceDataValue({
      baseResidence: fallbackResidence,
      residenceDoc: docCtx.residenceDoc as Record<string, unknown> | null,
      optimisticPatch: {},
      loading: docCtx.loading,
      saving: docCtx.saving,
      saveError: docCtx.saveError,
      error: docCtx.error,
      isInProvider: docCtx.isInProvider,
      updateResidence: docCtx.updateResidence,
      applyOptimisticPatch: () => {},
    });
  }, [
    ctx,
    fallbackResidence,
    docCtx.residenceDoc,
    docCtx.loading,
    docCtx.saving,
    docCtx.saveError,
    docCtx.error,
    docCtx.isInProvider,
    docCtx.updateResidence,
  ]);
}

/** En-tête et bannières — requiert le Provider fiche broker. */
export function useResidenceData(): ResidenceDataContextValue {
  const ctx = useContext(ResidenceDataContext);
  if (!ctx) {
    throw new Error(
      'useResidenceData() hors de <ResidenceDataProvider>. Enrobez ResidenceDetail.'
    );
  }
  return ctx;
}

export default ResidenceDataContext;
