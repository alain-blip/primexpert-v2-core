/**
 * ResidenceDocumentContext — listener temps réel sur residences/{id} (document racine).
 */

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ResidenceFirestoreDoc = Record<string, unknown>;

export interface ResidenceDocumentContextValue {
  residenceDoc: ResidenceFirestoreDoc | null;
  loading: boolean;
  error: Error | null;
  residenceId: string | null;
  isInProvider: boolean;
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
};

export interface ResidenceDocumentProviderProps {
  residenceId: string | null | undefined;
  children: ReactNode;
}

export function ResidenceDocumentProvider({
  residenceId,
  children,
}: ResidenceDocumentProviderProps) {
  const [residenceDoc, setResidenceDoc] = useState<ResidenceFirestoreDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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

  const value: ResidenceDocumentContextValue = {
    residenceDoc,
    loading,
    error,
    residenceId: residenceId ?? null,
    isInProvider: true,
  };

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
