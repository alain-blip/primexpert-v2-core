/**
 * Pont Documents → Hub Finance : pré-remplissage IA sans écriture Firestore.
 * La sauvegarde officielle reste « Enregistrer la saisie » (validation humaine).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PropertyDocumentExtractedData } from '../types/propertyDocument';
import {
  manualFinancialEntryDraftFromExtraction,
  type ManualFinancialEntryDraft,
} from '../services/financialDataService';
import type { ExtractedAmountRow } from '../lib/extractedDataInjection';

export interface IaPrefillMeta {
  documentId: string;
  fileName: string;
}

export interface FinancialHubDraftContextValue {
  pendingIaReview: boolean;
  iaMeta: IaPrefillMeta | null;
  /** Proposition IA en attente d’approbation (non persistée). */
  pendingDraft: ManualFinancialEntryDraft | null;
  expandManualPanel: boolean;
  /** Enregistre une proposition IA et ouvre le Hub Finance. */
  queueIaPrefill: (
    extracted: PropertyDocumentExtractedData,
    meta: IaPrefillMeta,
    options?: { selectedRows?: ExtractedAmountRow[]; nombreUnites?: number | null }
  ) => void;
  clearIaPending: () => void;
  consumeExpandManualPanel: () => boolean;
}

const FinancialHubDraftContext = createContext<FinancialHubDraftContextValue | null>(null);

export interface FinancialHubDraftProviderProps {
  children: ReactNode;
  onOpenFinanceTab?: () => void;
}

export function FinancialHubDraftProvider({
  children,
  onOpenFinanceTab,
}: FinancialHubDraftProviderProps) {
  const [pendingDraft, setPendingDraft] = useState<ManualFinancialEntryDraft | null>(null);
  const [pendingIaReview, setPendingIaReview] = useState(false);
  const [iaMeta, setIaMeta] = useState<IaPrefillMeta | null>(null);
  const [expandManualPanel, setExpandManualPanel] = useState(false);

  const queueIaPrefill = useCallback(
    (
      extracted: PropertyDocumentExtractedData,
      meta: IaPrefillMeta,
      options?: { selectedRows?: ExtractedAmountRow[]; nombreUnites?: number | null }
    ) => {
      const draft = manualFinancialEntryDraftFromExtraction(
        extracted as Record<string, unknown>,
        options?.selectedRows,
        { nombreUnites: options?.nombreUnites }
      );
      if (!draft) return;

      setPendingDraft(draft);
      setPendingIaReview(true);
      setIaMeta(meta);
      setExpandManualPanel(true);
      onOpenFinanceTab?.();
    },
    [onOpenFinanceTab]
  );

  const clearIaPending = useCallback(() => {
    setPendingDraft(null);
    setPendingIaReview(false);
    setIaMeta(null);
    setExpandManualPanel(false);
  }, []);

  const consumeExpandManualPanel = useCallback(() => {
    if (!expandManualPanel) return false;
    setExpandManualPanel(false);
    return true;
  }, [expandManualPanel]);

  const value = useMemo(
    (): FinancialHubDraftContextValue => ({
      pendingIaReview,
      iaMeta,
      pendingDraft,
      expandManualPanel,
      queueIaPrefill,
      clearIaPending,
      consumeExpandManualPanel,
    }),
    [
      pendingIaReview,
      iaMeta,
      pendingDraft,
      expandManualPanel,
      queueIaPrefill,
      clearIaPending,
      consumeExpandManualPanel,
    ]
  );

  return (
    <FinancialHubDraftContext.Provider value={value}>{children}</FinancialHubDraftContext.Provider>
  );
}

export function useFinancialHubDraft(): FinancialHubDraftContextValue {
  const ctx = useContext(FinancialHubDraftContext);
  if (!ctx) {
    throw new Error('useFinancialHubDraft() hors de <FinancialHubDraftProvider>.');
  }
  return ctx;
}

export function useFinancialHubDraftOptional(): FinancialHubDraftContextValue | null {
  return useContext(FinancialHubDraftContext);
}
