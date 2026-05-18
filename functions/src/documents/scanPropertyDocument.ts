import type { DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';
import { getDb } from '../lib/firestore';
import {
  parsingStatusAfterClean,
  validateDocumentFormat,
  validateStorageDocument,
} from './validateStorageDocument';

function adminStorage() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getStorage } = require('firebase-admin/storage') as typeof import('firebase-admin/storage');
  return getStorage();
}

const RESIDENCES = 'residences';
const DOCUMENTS = 'documents';

const PATH_PRIMEXPERT =
  /^primexpert\/[^/]+\/properties\/([^/]+)\/documents\/(financier|technique|legal)\/.+$/;
const PATH_LEGACY = /^properties\/([^/]+)\/documents\/(financier|technique|legal)\/.+$/;

export function isDiligenceStoragePath(storagePath: string): boolean {
  return PATH_PRIMEXPERT.test(storagePath) || PATH_LEGACY.test(storagePath);
}

function isPendingScanStatus(value: unknown): boolean {
  return value === 'pending' || value === undefined || value === null || value === '';
}

/** MVP : validation locale réussie → immédiatement « clean ». */
async function markDocumentClean(
  docRef: DocumentReference,
  category: string,
  ctx: { propertyId: string; documentId: string; brokerId: string }
): Promise<void> {
  const scannedAt = Date.now();
  const parsingStatus = parsingStatusAfterClean(category);
  await docRef.update({
    virusScanStatus: 'clean',
    virusScannedAtMillis: scannedAt,
    virusScanReason: 'mvp_format_validation_passed',
    parsingStatus,
  });

  const { scheduleParseAfterScan } = await import('./parsePropertyDocument');
  scheduleParseAfterScan(ctx.propertyId, ctx.documentId, ctx.brokerId, parsingStatus);
}

async function markDocumentInfected(
  docRef: DocumentReference,
  reason: string
): Promise<void> {
  await docRef.update({
    virusScanStatus: 'infected',
    virusScannedAtMillis: Date.now(),
    virusScanReason: reason,
    parsingStatus: 'not_applicable',
  });
}

async function validateDocSnapshot(
  docSnap: DocumentSnapshot
): Promise<{ ok: true; mimeType: string } | { ok: false; code: string }> {
  const data = docSnap.data() ?? {};
  const storagePath = String(data.storagePath ?? '');
  const displayName = String(data.fileName ?? '');
  let contentType = String(data.mimeType ?? '');

  if (!displayName) {
    return { ok: false, code: 'missing_file_name' };
  }

  if (storagePath && isDiligenceStoragePath(storagePath)) {
    try {
      const [meta] = await adminStorage().bucket().file(storagePath).getMetadata();
      contentType = meta.contentType ?? contentType;
    } catch {
      // Fichier Storage absent : on valide quand même via métadonnées Firestore (upload client validé).
      console.warn('[propertyDocumentScan] Storage object missing, fallback Firestore meta', storagePath);
    }
  }

  const storageSegment = storagePath.split('/').pop() ?? displayName;
  const fromStorage = validateStorageDocument(storageSegment, contentType);
  if (fromStorage.ok) return fromStorage;

  return validateDocumentFormat(displayName, contentType);
}

async function processDocument(
  docSnap: DocumentSnapshot,
  propertyId: string
): Promise<'clean' | 'infected' | 'skipped'> {
  const data = docSnap.data() ?? {};
  if (!isPendingScanStatus(data.virusScanStatus)) return 'skipped';

  const storagePath = String(data.storagePath ?? '');
  if (storagePath && !isDiligenceStoragePath(storagePath)) {
    console.warn('[propertyDocumentScan] chemin hors diligence, ignoré', storagePath);
    return 'skipped';
  }

  const category = String(data.category ?? 'legal');
  const validation = await validateDocSnapshot(docSnap);

  if (!validation.ok) {
    await markDocumentInfected(docSnap.ref, validation.code);
    if (storagePath) {
      try {
        await adminStorage().bucket().file(storagePath).delete({ ignoreNotFound: true });
      } catch {
        /* ignore */
      }
    }
    return 'infected';
  }

  await markDocumentClean(docSnap.ref, category, {
    propertyId,
    documentId: docSnap.id,
    brokerId: String(data.uploadedBy ?? ''),
  });
  return 'clean';
}

function assertResidenceAccess(
  residenceData: Record<string, unknown> | undefined,
  brokerId: string
): void {
  const owner = residenceData?.courtiersResponsables;
  if (owner !== brokerId) {
    throw new Error('Accès refusé : vous n’êtes pas le courtier responsable.');
  }
}

/** Scan d’un document (callable après téléversement). */
export async function scanSinglePropertyDocument(
  propertyId: string,
  documentId: string,
  brokerId: string
): Promise<{ virusScanStatus: 'clean' | 'infected'; parsingStatus: string }> {
  const db = getDb();
  const residenceSnap = await db.collection(RESIDENCES).doc(propertyId).get();
  if (!residenceSnap.exists) throw new Error('Fiche résidence introuvable.');
  assertResidenceAccess(residenceSnap.data(), brokerId);

  const docSnap = await db
    .collection(RESIDENCES)
    .doc(propertyId)
    .collection(DOCUMENTS)
    .doc(documentId)
    .get();
  if (!docSnap.exists) throw new Error('Document introuvable.');

  const category = String(docSnap.data()?.category ?? 'legal');
  const result = await processDocument(docSnap, propertyId);
  const virusScanStatus = result === 'infected' ? 'infected' : 'clean';
  return {
    virusScanStatus,
    parsingStatus: virusScanStatus === 'clean' ? parsingStatusAfterClean(category) : 'not_applicable',
  };
}

/** Réconcilie tous les documents encore en attente (y compris legacy Storage). */
export async function reconcilePendingPropertyDocuments(
  propertyId: string,
  brokerId: string
): Promise<{ processed: number; cleaned: number; infected: number; skipped: number }> {
  const db = getDb();
  const residenceSnap = await db.collection(RESIDENCES).doc(propertyId).get();
  if (!residenceSnap.exists) throw new Error('Fiche résidence introuvable.');
  assertResidenceAccess(residenceSnap.data(), brokerId);

  const allSnap = await db.collection(RESIDENCES).doc(propertyId).collection(DOCUMENTS).get();

  let cleaned = 0;
  let infected = 0;
  let skipped = 0;
  let processed = 0;

  for (const docSnap of allSnap.docs) {
    if (!isPendingScanStatus(docSnap.data()?.virusScanStatus)) continue;
    processed += 1;
    const result = await processDocument(docSnap, propertyId);
    if (result === 'clean') cleaned += 1;
    else if (result === 'infected') infected += 1;
    else skipped += 1;
  }

  return { processed, cleaned, infected, skipped };
}
