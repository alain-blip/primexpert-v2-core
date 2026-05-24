/**
 * Vault global — market_documents (rapports macro, hors fiche résidence).
 *
 * Storage : primexpert/{brokerId}/market_documents/{fileName}
 * Firestore : market_documents/{docId}
 */

import { ref, uploadBytes } from 'firebase/storage';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, storage, db } from '../lib/firebase';
import type {
  MarketDocumentParsingStatus,
  MarketDocumentRecord,
  MarketDocumentVirusScanStatus,
} from '../types/marketDocument';
import type { MarketReportRegionRow } from '@primexpert/core/documents';
import type { ComparableTransactionRow, OperationalBenchmarkRow } from '@primexpert/core/documents';

const MARKET_DOCUMENTS = 'market_documents';
const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';

function getFunctionsInstance() {
  return getFunctions(app, functionsRegion);
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[^\w.\-àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ ]/gi, '_').trim();
  return base.length > 0 ? base : 'document.pdf';
}

function buildStoragePath(brokerId: string, fileName: string): string {
  return `primexpert/${brokerId}/market_documents/${fileName}`;
}

function parseParsingStatus(value: unknown): MarketDocumentParsingStatus {
  if (
    value === 'not_applicable' ||
    value === 'pending' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'verified'
  ) {
    return value;
  }
  return 'not_applicable';
}

function parseVirusScanStatus(value: unknown): MarketDocumentVirusScanStatus {
  if (value === 'clean' || value === 'infected' || value === 'pending') return value;
  return 'clean';
}

function mapDoc(id: string, data: Record<string, unknown>): MarketDocumentRecord {
  const uploadedAt = data.uploadedAtMillis ?? data.uploadedAt;
  let uploadedAtMillis = Date.now();
  if (typeof uploadedAt === 'number') uploadedAtMillis = uploadedAt;
  else if (uploadedAt && typeof uploadedAt === 'object' && 'toMillis' in uploadedAt) {
    uploadedAtMillis = (uploadedAt as { toMillis: () => number }).toMillis();
  }

  return {
    id,
    fileName: String(data.fileName ?? 'document'),
    mimeType: String(data.mimeType ?? 'application/pdf'),
    sizeBytes: Number(data.sizeBytes ?? 0),
    storagePath: String(data.storagePath ?? ''),
    uploadedBy: String(data.uploadedBy ?? ''),
    uploadedAtMillis,
    documentCategory: 'MARKET_REPORT',
    virusScanStatus: parseVirusScanStatus(data.virusScanStatus),
    parsingStatus: parseParsingStatus(data.parsingStatus),
    parsingError: data.parsingError != null ? String(data.parsingError) : null,
    parsedAtMillis: typeof data.parsedAtMillis === 'number' ? data.parsedAtMillis : undefined,
    isValidated: data.isValidated === true,
    validatedAtMillis:
      typeof data.validatedAtMillis === 'number' ? data.validatedAtMillis : undefined,
    extractedData:
      data.extractedData && typeof data.extractedData === 'object'
        ? (data.extractedData as MarketDocumentRecord['extractedData'])
        : undefined,
  };
}

export async function uploadMarketDocument(
  brokerId: string,
  file: File
): Promise<MarketDocumentRecord> {
  if (file.type !== 'application/pdf') {
    throw new Error('Seuls les fichiers PDF sont acceptés pour la bibliothèque de marché.');
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Fichier trop volumineux (max. 25 Mo).');
  }

  const fileName = sanitizeFileName(file.name);
  const storagePath = buildStoragePath(brokerId, fileName);
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: { courtiersResponsables: brokerId },
  });

  const col = collection(db, MARKET_DOCUMENTS);
  const docRef = await addDoc(col, {
    fileName,
    mimeType: file.type,
    sizeBytes: file.size,
    storagePath,
    uploadedBy: brokerId,
    uploadedAtMillis: Date.now(),
    documentCategory: 'MARKET_REPORT',
    virusScanStatus: 'clean',
    parsingStatus: 'pending',
    parsingEligible: true,
    isValidated: false,
  });

  return mapDoc(docRef.id, {
    fileName,
    mimeType: file.type,
    sizeBytes: file.size,
    storagePath,
    uploadedBy: brokerId,
    uploadedAtMillis: Date.now(),
    documentCategory: 'MARKET_REPORT',
    virusScanStatus: 'clean',
    parsingStatus: 'pending',
  });
}

export function subscribeMarketDocuments(
  brokerId: string,
  onChange: (docs: MarketDocumentRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, MARKET_DOCUMENTS),
    where('uploadedBy', '==', brokerId),
    orderBy('uploadedAtMillis', 'desc')
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>)));
  });
}

export async function parseMarketDocumentNow(documentId: string): Promise<void> {
  const fn = httpsCallable<{ documentId: string }, { ok: boolean; parsingStatus: string }>(
    getFunctionsInstance(),
    'marketDocumentParseIA'
  );
  await fn({ documentId });
}

export async function injectMarketMacroStatsViaCallable(input: {
  documentId: string;
  selectedRegions: MarketReportRegionRow[];
  selectedTransactions?: ComparableTransactionRow[];
  selectedOperationalBenchmarks?: OperationalBenchmarkRow[];
  siloType?: string;
}): Promise<{
  entryIds: string[];
  macroEntryIds: string[];
  analyticsEntryIds: string[];
  snapshotUpdated: boolean;
  macroNewCount: number;
  macroDuplicateCount: number;
  transactionsNewCount: number;
  transactionsDuplicateCount: number;
  benchmarksNewCount: number;
  benchmarksDuplicateCount: number;
}> {
  const fn = httpsCallable<
    {
      documentId: string;
      selectedRegions: MarketReportRegionRow[];
      selectedTransactions: ComparableTransactionRow[];
      selectedOperationalBenchmarks: OperationalBenchmarkRow[];
      siloType?: string;
    },
    {
      ok: boolean;
      entryIds: string[];
      macroEntryIds: string[];
      analyticsEntryIds: string[];
      snapshotUpdated: boolean;
      macroNewCount: number;
      macroDuplicateCount: number;
      transactionsNewCount: number;
      transactionsDuplicateCount: number;
      benchmarksNewCount: number;
      benchmarksDuplicateCount: number;
    }
  >(getFunctionsInstance(), 'injectMarketMacroStats');
  const res = await fn({
    documentId: input.documentId,
    selectedRegions: input.selectedRegions,
    selectedTransactions: input.selectedTransactions ?? [],
    selectedOperationalBenchmarks: input.selectedOperationalBenchmarks ?? [],
    siloType: input.siloType,
  });
  return {
    entryIds: res.data.entryIds,
    macroEntryIds: res.data.macroEntryIds,
    analyticsEntryIds: res.data.analyticsEntryIds,
    snapshotUpdated: res.data.snapshotUpdated,
    macroNewCount: res.data.macroNewCount ?? 0,
    macroDuplicateCount: res.data.macroDuplicateCount ?? 0,
    transactionsNewCount: res.data.transactionsNewCount ?? 0,
    transactionsDuplicateCount: res.data.transactionsDuplicateCount ?? 0,
    benchmarksNewCount: res.data.benchmarksNewCount ?? 0,
    benchmarksDuplicateCount: res.data.benchmarksDuplicateCount ?? 0,
  };
}

export async function markMarketDocumentValidated(documentId: string): Promise<void> {
  const docRef = doc(db, MARKET_DOCUMENTS, documentId);
  await updateDoc(docRef, {
    isValidated: true,
    validatedAtMillis: Date.now(),
    parsingStatus: 'verified',
  });
}
