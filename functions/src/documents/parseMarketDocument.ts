/**
 * Parseur IA — Vault global market_documents (Vertex AI / Gemini).
 */

import type { DocumentReference } from 'firebase-admin/firestore';
import { extractFinancialDocumentWithGemini } from './geminiExtract';
import { getDb } from '../lib/firestore';

const MARKET_DOCUMENTS = 'market_documents';
const PARSEABLE_MIME = new Set(['application/pdf']);

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

async function downloadAsBase64(storagePath: string): Promise<{ data: string; mimeType: string }> {
  const file = adminStorage().bucket().file(storagePath);
  const [buffer] = await file.download();
  const [meta] = await file.getMetadata();
  return { data: buffer.toString('base64'), mimeType: meta.contentType ?? 'application/octet-stream' };
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
  extractedData: Record<string, unknown>
): Promise<void> {
  await docRef.update({
    parsingStatus: 'completed',
    parsedAtMillis: Date.now(),
    extractedData: stripUndefinedDeep(extractedData),
    parsingError: null,
  });
}

function assertMarketDocAccess(data: Record<string, unknown> | undefined, brokerId: string): void {
  if (String(data?.uploadedBy ?? '') !== brokerId) {
    throw new Error('Accès refusé : document marché non rattaché à votre compte.');
  }
}

/** Analyse IA d'un rapport macro (callable). */
export async function parseSingleMarketDocument(
  documentId: string,
  brokerId: string
): Promise<{ parsingStatus: 'completed' | 'failed' | 'skipped' }> {
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
    const { data: base64, mimeType: storageMime } = await downloadAsBase64(storagePath);
    const extractedData = await extractFinancialDocumentWithGemini(
      storageMime || mimeType,
      base64,
      fileName,
      { documentCategory: 'MARKET_REPORT' }
    );
    await markParseCompleted(docRef, extractedData);
    return { parsingStatus: 'completed' };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error('[marketDocumentParseIA] failed', { documentId, storagePath, reason });
    await markParseFailed(docRef, reason.slice(0, 500));
    return { parsingStatus: 'failed' };
  }
}
