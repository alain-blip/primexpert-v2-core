/**
 * Parseur IA — Espace Documents (Vertex AI / gemini-2.5-flash).
 * Déclenché lorsque virusScanStatus === 'clean' et parsingStatus === 'pending'.
 */

import type { DocumentReference } from 'firebase-admin/firestore';
import { extractFinancialDocumentWithGemini } from './geminiExtract';
import { getDb } from '../lib/firestore';
import { isDiligenceStoragePath } from './scanPropertyDocument';

const RESIDENCES = 'residences';
const DOCUMENTS = 'documents';

const PARSEABLE_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

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

function assertResidenceAccess(
  residenceData: Record<string, unknown> | undefined,
  brokerId: string
): void {
  if (residenceData?.courtiersResponsables !== brokerId) {
    throw new Error('Accès refusé : vous n’êtes pas le courtier responsable.');
  }
}

function isEligibleForParse(data: Record<string, unknown>): boolean {
  const status = data.parsingStatus;
  return (
    data.virusScanStatus === 'clean' &&
    (status === 'pending' || status === 'failed') &&
    data.isValidated !== true
  );
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
    extractedData,
    parsingError: null,
  });
}

/** Analyse IA d’un document (callable ou chaînage post-scan). */
export async function parseSinglePropertyDocument(
  propertyId: string,
  documentId: string,
  brokerId: string
): Promise<{ parsingStatus: 'completed' | 'failed' | 'skipped' }> {
  const db = getDb();
  const residenceSnap = await db.collection(RESIDENCES).doc(propertyId).get();
  if (!residenceSnap.exists) throw new Error('Fiche résidence introuvable.');
  assertResidenceAccess(residenceSnap.data(), brokerId);

  const docRef = db.collection(RESIDENCES).doc(propertyId).collection(DOCUMENTS).doc(documentId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error('Document introuvable.');

  const data = docSnap.data() ?? {};
  if (!isEligibleForParse(data)) return { parsingStatus: 'skipped' };

  const storagePath = String(data.storagePath ?? '');
  const fileName = String(data.fileName ?? 'document');
  const mimeType = String(data.mimeType ?? 'application/pdf');

  if (!storagePath || !isDiligenceStoragePath(storagePath)) {
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
      fileName
    );
    await markParseCompleted(docRef, extractedData);
    return { parsingStatus: 'completed' };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error('[propertyDocumentParseIA] failed', {
      propertyId,
      documentId,
      storagePath,
      mimeType,
      reason,
      stack: e instanceof Error ? e.stack : undefined,
    });
    await markParseFailed(docRef, reason.slice(0, 500));
    return { parsingStatus: 'failed' };
  }
}

/** Traite tous les documents en attente d’analyse IA pour une fiche. */
export async function reconcilePendingPropertyParses(
  propertyId: string,
  brokerId: string
): Promise<{ processed: number; completed: number; failed: number; skipped: number }> {
  const db = getDb();
  const residenceSnap = await db.collection(RESIDENCES).doc(propertyId).get();
  if (!residenceSnap.exists) throw new Error('Fiche résidence introuvable.');
  assertResidenceAccess(residenceSnap.data(), brokerId);

  const snap = await db.collection(RESIDENCES).doc(propertyId).collection(DOCUMENTS).get();

  let completed = 0;
  let failed = 0;
  let skipped = 0;
  let processed = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!isEligibleForParse(data)) {
      continue;
    }
    processed += 1;
    const result = await parseSinglePropertyDocument(propertyId, docSnap.id, brokerId);
    if (result.parsingStatus === 'completed') completed += 1;
    else if (result.parsingStatus === 'failed') failed += 1;
    else skipped += 1;
  }

  return { processed, completed, failed, skipped };
}

/** Chaînage automatique après scan « clean » + parsing « pending ». */
export function scheduleParseAfterScan(
  propertyId: string,
  documentId: string,
  brokerId: string,
  parsingStatus: string
): void {
  if (parsingStatus !== 'pending' || !brokerId) return;
  void parseSinglePropertyDocument(propertyId, documentId, brokerId).catch((e) => {
    console.error('[propertyDocumentParseIA] schedule after scan failed', e);
  });
}
