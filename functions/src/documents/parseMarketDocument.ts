/**
 * Parseur IA — Vault global market_documents (Vertex AI / Gemini).
 * V2.8 : découpage sémantique local + cache MD5 déterministe avant Vertex.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { extractFinancialDocumentWithGemini } from './geminiExtract';
import { sliceMarketPdfForIa } from './marketPdfSlice';
import { getDb } from '../lib/firestore';

const MARKET_DOCUMENTS = 'market_documents';
const PARSEABLE_MIME = new Set(['application/pdf']);

interface ParseCompletionMeta {
  contentHashMd5?: string;
  parseCacheHit?: boolean;
  cacheSourceDocumentId?: string;
  originalPageCount?: number;
  semanticPageCount?: number;
  semanticHit?: boolean;
}

/** Firestore Admin rejette les champs `undefined` dans extractedData. */
function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested !== undefined) out[key] = stripUndefinedDeep(nested);
    }
    return out as T;
  }
  return value;
}

function isEligibleForParse(data: Record<string, unknown>): boolean {
  if (data.virusScanStatus !== 'clean' || data.isValidated === true) return false;
  const status = data.parsingStatus;
  if (status === 'completed' || status === 'verified') return false;
  if (status === 'pending') return true;
  if (status === 'failed') return true;
  return status === 'not_applicable' || status == null || status === '';
}

function adminStorage() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getStorage } = require('firebase-admin/storage') as typeof import('firebase-admin/storage');
  return getStorage();
}

async function downloadPdfBuffer(storagePath: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const file = adminStorage().bucket().file(storagePath);
  const [buffer] = await file.download();
  const [meta] = await file.getMetadata();
  return { buffer, mimeType: meta.contentType ?? 'application/octet-stream' };
}

async function markParseFailed(docRef: DocumentReference, reason: string): Promise<void> {
  await docRef.update({
    parsingStatus: 'failed',
    parsedAtMillis: Date.now(),
    parsingError: reason,
  });
}

async function markParseCompleted(
  docRef: DocumentReference,
  extractedData: Record<string, unknown>,
  meta?: ParseCompletionMeta
): Promise<void> {
  const update: Record<string, unknown> = {
    parsingStatus: 'completed',
    parsedAtMillis: Date.now(),
    extractedData: stripUndefinedDeep(extractedData),
    parsingError: null,
  };
  if (meta?.contentHashMd5) update.contentHashMd5 = meta.contentHashMd5;
  if (meta?.parseCacheHit === true) update.parseCacheHit = true;
  if (meta?.cacheSourceDocumentId) update.cacheSourceDocumentId = meta.cacheSourceDocumentId;
  if (typeof meta?.originalPageCount === 'number') update.originalPageCount = meta.originalPageCount;
  if (typeof meta?.semanticPageCount === 'number') update.semanticPageCount = meta.semanticPageCount;
  if (typeof meta?.semanticHit === 'boolean') update.semanticHit = meta.semanticHit;
  await docRef.update(update);
}

function assertMarketDocAccess(data: Record<string, unknown> | undefined, brokerId: string): void {
  if (String(data?.uploadedBy ?? '') !== brokerId) {
    throw new Error('Accès refusé : document marché non rattaché à votre compte.');
  }
}

function hasUsableExtractedData(data: Record<string, unknown>): boolean {
  const extracted = data.extractedData;
  if (!extracted || typeof extracted !== 'object') return false;
  return Object.keys(extracted as Record<string, unknown>).length > 0;
}

/** Lookup cache — clone extractedData si même empreinte MD5 déjà parsée. */
async function tryCloneFromContentHashCache(
  db: Firestore,
  docRef: DocumentReference,
  documentId: string,
  contentHashMd5: string,
  sliceMeta: Omit<ParseCompletionMeta, 'parseCacheHit' | 'cacheSourceDocumentId'>
): Promise<boolean> {
  const snap = await db
    .collection(MARKET_DOCUMENTS)
    .where('contentHashMd5', '==', contentHashMd5)
    .limit(12)
    .get();

  for (const candidate of snap.docs) {
    if (candidate.id === documentId) continue;
    const data = candidate.data();
    const status = String(data.parsingStatus ?? '');
    if (status !== 'completed' && status !== 'verified') continue;
    if (!hasUsableExtractedData(data)) continue;

    const cloned = stripUndefinedDeep(data.extractedData as Record<string, unknown>);
    await markParseCompleted(docRef, cloned, {
      ...sliceMeta,
      contentHashMd5,
      parseCacheHit: true,
      cacheSourceDocumentId: candidate.id,
    });
    console.info('[marketDocumentParseIA] cache hit', {
      documentId,
      contentHashMd5,
      cacheSourceDocumentId: candidate.id,
    });
    return true;
  }
  return false;
}

/** Analyse IA d'un rapport macro (callable). */
export async function parseSingleMarketDocument(
  documentId: string,
  brokerId: string
): Promise<{ parsingStatus: 'completed' | 'failed' | 'skipped'; cacheHit?: boolean }> {
  const db = getDb();
  const docRef = db.collection(MARKET_DOCUMENTS).doc(documentId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error('Document marché introuvable.');

  const data = docSnap.data() ?? {};
  assertMarketDocAccess(data, brokerId);
  if (!isEligibleForParse(data)) return { parsingStatus: 'skipped' };

  if (data.parsingStatus === 'not_applicable') {
    await docRef.update({ parsingStatus: 'pending' });
  }

  const storagePath = String(data.storagePath ?? '');
  const fileName = String(data.fileName ?? 'document');
  const mimeType = String(data.mimeType ?? 'application/pdf');

  if (!storagePath.startsWith(`primexpert/${brokerId}/market_documents/`)) {
    await markParseFailed(docRef, 'invalid_storage_path');
    return { parsingStatus: 'failed' };
  }

  if (!PARSEABLE_MIME.has(mimeType)) {
    await markParseFailed(docRef, 'mime_not_supported_for_parse');
    return { parsingStatus: 'failed' };
  }

  try {
    const { buffer, mimeType: storageMime } = await downloadPdfBuffer(storagePath);
    const slice = await sliceMarketPdfForIa(buffer);

    const sliceMeta: Omit<ParseCompletionMeta, 'parseCacheHit' | 'cacheSourceDocumentId'> = {
      contentHashMd5: slice.contentHashMd5,
      originalPageCount: slice.originalPageCount,
      semanticPageCount: slice.slicedPageCount,
      semanticHit: slice.semanticHit,
    };

    await docRef.update({
      contentHashMd5: slice.contentHashMd5,
      originalPageCount: slice.originalPageCount,
      semanticPageCount: slice.slicedPageCount,
      semanticHit: slice.semanticHit,
    });

    const cacheHit = await tryCloneFromContentHashCache(
      db,
      docRef,
      documentId,
      slice.contentHashMd5,
      sliceMeta
    );
    if (cacheHit) return { parsingStatus: 'completed', cacheHit: true };

    console.info('[marketDocumentParseIA] semantic slice', {
      documentId,
      originalPageCount: slice.originalPageCount,
      semanticPageCount: slice.slicedPageCount,
      selectedPageIndices: slice.selectedPageIndices,
      payloadReductionPct: Math.round(
        (1 - slice.slicedPageCount / Math.max(slice.originalPageCount, 1)) * 100
      ),
    });

    const extractedData = await extractFinancialDocumentWithGemini(
      storageMime || mimeType,
      slice.slicedPdfBase64,
      fileName,
      { documentCategory: 'MARKET_REPORT' }
    );
    await markParseCompleted(docRef, extractedData, sliceMeta);
    return { parsingStatus: 'completed', cacheHit: false };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error('[marketDocumentParseIA] failed', { documentId, storagePath, reason });
    await markParseFailed(docRef, reason.slice(0, 500));
    return { parsingStatus: 'failed' };
  }
}
