/**
 * FinancialDataContext — listener unique Firestore financial/dataV2 (SSOT).
 */

import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { FinancialDataV2Doc } from '@primexpert/core/financial';
import { db } from '../lib/firebase';

export interface FinancialDataContextValue {
  financialData: FinancialDataV2Doc | null;
  loading: boolean;
  error: Error | null;
  residenceId: string | null;
  isInProvider: boolean;
}

const FinancialDataContext = createContext<FinancialDataContextValue | null>(null);

const DEFAULT_OUTSIDE_PROVIDER: FinancialDataContextValue = {
  financialData: null,
  loading: false,
  error: new Error(
    'useFinancialData() hors de <FinancialDataProvider>. Enrobez le hub Finance du Provider.'
  ),
  residenceId: null,
  isInProvider: false,
};

export interface FinancialDataProviderProps {
  residenceId: string | null | undefined;
  children: ReactNode;
}

export function FinancialDataProvider({ residenceId, children }: FinancialDataProviderProps) {
  const [financialData, setFinancialData] = useState<FinancialDataV2Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!residenceId) {
      setFinancialData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const docRef = doc(db, 'residences', residenceId, 'financial', 'dataV2');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        setFinancialData(docSnap.exists() ? (docSnap.data() as FinancialDataV2Doc) : null);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('[FinancialDataContext] Erreur listener Firestore:', err);
        setFinancialData(null);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [residenceId]);

  const value = useMemo(
    (): FinancialDataContextValue => ({
      financialData,
      loading,
      error,
      residenceId: residenceId ?? null,
      isInProvider: true,
    }),
    [financialData, loading, error, residenceId]
  );

  return (
    <FinancialDataContext.Provider value={value}>{children}</FinancialDataContext.Provider>
  );
}

export function useFinancialData(): FinancialDataContextValue {
  const context = useContext(FinancialDataContext);
  if (!context) {
    if (import.meta.env.DEV) {
      console.warn(
        '[FinancialDataContext] useFinancialData() utilisé hors Provider — valeurs par défaut.'
      );
    }
    return DEFAULT_OUTSIDE_PROVIDER;
  }
  return context;
}

export default FinancialDataContext;
