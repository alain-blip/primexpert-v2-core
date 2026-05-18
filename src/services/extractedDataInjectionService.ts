/**
 * Injection courtier — montants validés → fiche financial/dataV2 + Big Data anonymisé.
 */

import {
  doc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FinancialDataV2Doc } from '@primexpert/core/financial';
import type { ExtractedAmountRow } from '../lib/extractedDataInjection';
import {
  inferAnneeDonnees,
  inferProvenanceFromFileName,
  resolveRegionAdministrative,
} from '../lib/extractedDataInjection';
import type { MarketAnalyticsRawEntry } from '../types/marketAnalytics';
import type {
  MarketDataProvenance,
  MarketSiloType,
} from '../types/marketAnalytics';
import type { PropertyDocumentExtractedData, PropertyDocumentRecord } from '../types/propertyDocument';

const MARKET_ANALYTICS_RAW = 'market_analytics_raw';

export interface InjectExtractedDataInput {
  propertyId: string;
  document: PropertyDocumentRecord;
  selectedRows: ExtractedAmountRow[];
  siloType: MarketSiloType;
  brokerId: string;
  residenceCity?: string;
  residenceRegionHint?: string;
}

export interface InjectExtractedDataResult {
  financialUpdated: boolean;
  marketEntryId: string;
}

function buildDepensePatch(rows: ExtractedAmountRow[]): Record<string, number> {
  const patch: Record<string, number> = {};
  for (const row of rows) {
    const key = row.expenseKey ?? 'divers';
    patch[key] = row.value;
  }
  return patch;
}

export async function injectExtractedDataToResidence(
  input: InjectExtractedDataInput
): Promise<InjectExtractedDataResult> {
  const {
    propertyId,
    document,
    selectedRows,
    siloType,
    brokerId,
    residenceCity,
    residenceRegionHint,
  } = input;

  if (!selectedRows.length) {
    throw new Error('Sélectionnez au moins un montant à injecter.');
  }

  const provenance: MarketDataProvenance = inferProvenanceFromFileName(document.fileName);
  const region = resolveRegionAdministrative(residenceCity, residenceRegionHint);
  const anneeDonnees = inferAnneeDonnees(document.extractedData, document.fileName);
  const depensePatch = buildDepensePatch(selectedRows);

  const financialRef = doc(db, 'residences', propertyId, 'financial', 'dataV2');
  const financialSnap = await getDoc(financialRef);

  const existing = (financialSnap.exists()
    ? (financialSnap.data() as FinancialDataV2Doc)
    : { baseData: { depenses: {} } }) as FinancialDataV2Doc;

  const prevDepenses = (existing.baseData?.depenses ?? {}) as Record<string, number>;
  const mergedDepenses = { ...prevDepenses, ...depensePatch };

  await setDoc(
    financialRef,
    {
      baseData: {
        ...(existing.baseData ?? {}),
        depenses: mergedDepenses,
      },
      lastUpdated: serverTimestamp(),
      lastInjection: {
        source: 'document_ia',
        documentId: document.id,
        brokerId,
        atMillis: Date.now(),
      },
    },
    { merge: true }
  );

  const marketPayload: MarketAnalyticsRawEntry = {
    siloType,
    regionAdministrative: region.regionAdministrative,
    regionDisplayName: region.displayName,
    anneeDonnees,
    provenance,
    validatedAmounts: selectedRows.map((r) => ({
      label: r.label,
      value: r.value,
      currency: r.currency,
      expenseKey: r.expenseKey ?? undefined,
    })),
    comparables: extractComparablesForMarket(document.extractedData),
    injectedAtMillis: Date.now(),
  };

  const marketRef = await addDoc(collection(db, MARKET_ANALYTICS_RAW), marketPayload);

  await updateDoc(doc(db, 'residences', propertyId, 'documents', document.id), {
    parsingStatus: 'verified',
    isValidated: true,
    validatedAtMillis: Date.now(),
    validatedBy: brokerId,
    validatedAmountKeys: selectedRows.map((r) => r.id),
    marketAnalyticsEntryId: marketRef.id,
  });

  return { financialUpdated: true, marketEntryId: marketRef.id };
}

function extractComparablesForMarket(
  data: PropertyDocumentExtractedData
): MarketAnalyticsRawEntry['comparables'] {
  const raw = data.raw as { comparables?: unknown } | undefined;
  const list = raw?.comparables ?? (data as { comparables?: unknown }).comparables;
  if (!Array.isArray(list)) return undefined;

  return list
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const row = c as Record<string, unknown>;
      return {
        label: String(row.label ?? row.name ?? 'Comparable'),
        salePrice: typeof row.salePrice === 'number' ? row.salePrice : undefined,
        capRatePct: typeof row.capRatePct === 'number' ? row.capRatePct : undefined,
        regionKey: typeof row.regionKey === 'string' ? row.regionKey : undefined,
      };
    })
    .filter(Boolean) as NonNullable<MarketAnalyticsRawEntry['comparables']>;
}
