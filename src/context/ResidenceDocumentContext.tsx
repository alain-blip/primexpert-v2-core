/**
 * ResidenceDocumentContext — listener temps réel sur residences/{id} (document racine).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { patchVendorPortalResidence } from '../services/vendorPortalAccessService';

export type ResidenceFirestoreDoc = Record<string, unknown>;

export interface ResidenceDocumentContextValue {
  residenceDoc: ResidenceFirestoreDoc | null;
  loading: boolean;
  error: Error | null;
  residenceId: string | null;
  isInProvider: boolean;
  saving: boolean;
  saveError: string | null;
  updateResidence: (patch: Record<string, unknown>) => Promise<void>;
}

const ResidenceDocumentContext = createContext<ResidenceDocumentContextValue | null>(null);

const DEFAULT_OUTSIDE_PROVIDER: ResidenceDocumentContextValue = {
  residenceDoc: null,
  loading: false,
  error: new Error(
    'useResidenceDocument() hors de <ResidenceDocumentProvider>. Enrobez l’onglet Identité du Provider.'
  ),
  residenceId: null,
  isInProvider: false,
  saving: false,
  saveError: null,
  updateResidence: async () => {
    throw new Error('updateResidence() hors Provider');
  },
};

export interface ResidenceDocumentProviderProps {
  residenceId: string | null | undefined;
  /** Jeton portail vendeur — écritures via Cloud Function patchVendorPortalResidence. */
  vendorPortalToken?: string | null;
  children: ReactNode;
}

export function ResidenceDocumentProvider({
  residenceId,
  vendorPortalToken,
  children,
}: ResidenceDocumentProviderProps) {
  const [residenceDoc, setResidenceDoc] = useState<ResidenceFirestoreDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!residenceId) {
      setResidenceDoc(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const docRef = doc(db, 'residences', residenceId);
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        setResidenceDoc(snap.exists() ? (snap.data() as ResidenceFirestoreDoc) : null);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('[ResidenceDocumentContext] Erreur listener:', err);
        setResidenceDoc(null);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [residenceId]);

  const updateResidence = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!residenceId) {
        throw new Error('residenceId manquant');
      }
      setSaving(true);
      setSaveError(null);
      try {
        if (vendorPortalToken) {
          await patchVendorPortalResidence({
            residenceId,
            patch,
            token: vendorPortalToken,
          });
        } else {
          await updateDoc(doc(db, 'residences', residenceId), patch);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSaveError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [residenceId, vendorPortalToken]
  );

  const value = useMemo(
    (): ResidenceDocumentContextValue => ({
      residenceDoc,
      loading,
      error,
      residenceId: residenceId ?? null,
      isInProvider: true,
      saving,
      saveError,
      updateResidence,
    }),
    [residenceDoc, loading, error, residenceId, saving, saveError, updateResidence]
  );

  return (
    <ResidenceDocumentContext.Provider value={value}>{children}</ResidenceDocumentContext.Provider>
  );
}

export function useResidenceDocument(): ResidenceDocumentContextValue {
  const context = useContext(ResidenceDocumentContext);
  if (!context) {
    if (import.meta.env.DEV) {
      console.warn(
        '[ResidenceDocumentContext] useResidenceDocument() hors Provider — valeurs par défaut.'
      );
    }
    return DEFAULT_OUTSIDE_PROVIDER;
  }
  return context;
}

export default ResidenceDocumentContext;
