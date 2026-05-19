/**
 * Espace Documents — diligence raisonnable par fiche résidence.
 *
 * Storage : properties/{propertyId}/documents/{category}/{fileName}
 * Firestore : residences/{propertyId}/documents/{docId}
 *
 * Sécurité : virusScanStatus (pending → clean | infected) — Cloud Function propertyDocumentOnUpload.
 * Analyse : parsingStatus + extractedData — parseur IA après scan clean.
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, storage, db } from '../lib/firebase';

const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';
const functions = getFunctions(app, functionsRegion);
import {
  ensureOriginalFileExtension,
  isPropertyDocumentParseCandidate,
  validatePropertyDocumentFile,
} from '../lib/propertyDocumentValidation';
import type {
  PropertyDocumentCategory,
  PropertyDocumentExtractedData,
  PropertyDocumentRecord,
  ParsingStatus,
  VirusScanStatus,
} from '../types/propertyDocument';
import { inferDocumentCategoryForRecord } from '../lib/propertyDocumentTaxonomy';

const RESIDENCES_COLLECTION = 'residences';
const DOCUMENTS_SUBCOLLECTION = 'documents';

const EMPTY_EXTRACTED_DATA: PropertyDocumentExtractedData = {};

function documentsCol(propertyId: string) {
  return collection(db, RESIDENCES_COLLECTION, propertyId, DOCUMENTS_SUBCOLLECTION);
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[^\w.\-àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ ]/gi, '_').trim();
  return base.length > 0 ? base : 'document';
}

/**
 * Chemin Storage aligné sur le silo courtier (même modèle que driveStorage).
 * Évite firestore.get() dans les règles Storage — source fréquente de 403.
 */
function buildStoragePath(
  brokerId: string,
  propertyId: string,
  category: PropertyDocumentCategory,
  fileName: string
): string {
  return `primexpert/${brokerId}/properties/${propertyId}/documents/${category}/${fileName}`;
}

function parseVirusScanStatus(value: unknown): VirusScanStatus {
  if (value === 'clean' || value === 'infected' || value === 'pending') return value;
  return 'pending';
}

function parseParsingStatus(value: unknown): ParsingStatus {
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

function parseExtractedData(value: unknown): PropertyDocumentExtractedData {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as PropertyDocumentExtractedData;
  }
  return EMPTY_EXTRACTED_DATA;
}

function mapDoc(
  propertyId: string,
  id: string,
  data: Record<string, unknown>
): PropertyDocumentRecord {
  const uploadedAt = data.uploadedAtMillis ?? data.uploadedAt;
  let uploadedAtMillis = Date.now();
  if (typeof uploadedAt === 'number') uploadedAtMillis = uploadedAt;
  else if (uploadedAt && typeof uploadedAt === 'object' && 'toMillis' in uploadedAt) {
    uploadedAtMillis = (uploadedAt as { toMillis: () => number }).toMillis();
  }

  const category = (data.category as PropertyDocumentCategory) ?? 'financier';
  const fileName = String(data.fileName ?? 'document');
  const mimeType = String(data.mimeType ?? 'application/octet-stream');
  const parsingEligible =
    typeof data.parsingEligible === 'boolean'
      ? data.parsingEligible
      : isPropertyDocumentParseCandidate(category, mimeType, fileName);

  return {
    id,
    scope: 'property',
    propertyId,
    category,
    fileName,
    storagePath: String(data.storagePath ?? ''),
    mimeType,
    sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : 0,
    uploadedAtMillis,
    uploadedBy: String(data.uploadedBy ?? ''),
    virusScanStatus: parseVirusScanStatus(data.virusScanStatus),
    parsingStatus: parseParsingStatus(data.parsingStatus),
    parsingError:
      typeof data.parsingError === 'string' && data.parsingError.trim()
        ? data.parsingError.trim()
        : undefined,
    parsingEligible,
    extractedData: parseExtractedData(data.extractedData),
    isValidated: data.isValidated === true,
    validatedAtMillis:
      typeof data.validatedAtMillis === 'number' ? data.validatedAtMillis : undefined,
    promesseScope: data.promesseScope === true || data.promesseDocument === true,
    promesseDocLabel:
      typeof data.promesseDocLabel === 'string' ? data.promesseDocLabel : undefined,
  };
}

/** Écoute temps réel de tous les documents (compteurs par dossier). */
export function subscribeAllPropertyDocuments(
  propertyId: string,
  onUpdate: (rows: PropertyDocumentRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!propertyId) {
    onUpdate([]);
    return () => {};
  }

  const q = query(documentsCol(propertyId), orderBy('uploadedAtMillis', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      onUpdate(
        snap.docs.map((d) => mapDoc(propertyId, d.id, d.data() as Record<string, unknown>))
      );
    },
    (err) => {
      console.error('[propertyDocuments] subscribeAll failed', err);
      onError?.(err as Error);
      onUpdate([]);
    }
  );
}

/** Reclasse le vrac Alain au chargement (Firestore category uniquement, Storage inchangé). */
export async function reconcilePropertyDocumentCategories(
  propertyId: string,
  docs: PropertyDocumentRecord[]
): Promise<number> {
  if (!propertyId || !docs.length) return 0;

  const updates = docs
    .map((d) => ({ doc: d, target: inferDocumentCategoryForRecord(d) }))
    .filter(({ doc: d, target }) => !d.promesseScope && target !== d.category);

  await Promise.all(
    updates.map(({ doc: d, target }) =>
      updateDoc(doc(db, RESIDENCES_COLLECTION, propertyId, DOCUMENTS_SUBCOLLECTION, d.id), {
        category: target,
        categoryReconciledAtMillis: Date.now(),
        categoryReconciledReason: 'taxonomy_alain_documents_acheteurs',
      })
    )
  );

  return updates.length;
}

/** Écoute temps réel des documents d'une catégorie. */
export function subscribePropertyDocuments(
  propertyId: string,
  category: PropertyDocumentCategory,
  onUpdate: (rows: PropertyDocumentRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!propertyId) {
    onUpdate([]);
    return () => {};
  }

  const q = query(
    documentsCol(propertyId),
    where('category', '==', category),
    orderBy('uploadedAtMillis', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      onUpdate(
        snap.docs.map((d) => mapDoc(propertyId, d.id, d.data() as Record<string, unknown>))
      );
    },
    (err) => {
      console.error('[propertyDocuments] subscribe failed', err);
      onError?.(err as Error);
      onUpdate([]);
    }
  );
}

export interface UploadPropertyDocumentInput {
  propertyId: string;
  category: PropertyDocumentCategory;
  file: File;
  uploadedBy: string;
  /** Onglet Promesses d'achat — pièce rattachée au dossier PA. */
  promesseScope?: boolean;
  promesseDocLabel?: string;
}

/** Téléverse vers Storage + métadonnées Firestore (après validation stricte). */
export async function uploadPropertyDocument(
  input: UploadPropertyDocumentInput
): Promise<PropertyDocumentRecord> {
  const { propertyId, category, file, uploadedBy, promesseScope, promesseDocLabel } = input;
  if (!propertyId || !file || !uploadedBy) {
    throw new Error('propertyId, file et uploadedBy requis.');
  }

  const validation = validatePropertyDocumentFile(file);
  if (!validation.ok) {
    throw new Error(`VALIDATION_${validation.code}`);
  }

  const mimeType = validation.mimeType;
  const parsingEligible = isPropertyDocumentParseCandidate(category, mimeType, file.name);

  const stamp = Date.now();
  const safeOriginal = sanitizeFileName(file.name);
  const storageFileName = `${stamp}-${safeOriginal}`;
  const storagePath = buildStoragePath(uploadedBy, propertyId, category, storageFileName);
  const uploadedAtMillis = stamp;

  const docRef = await addDoc(documentsCol(propertyId), {
    propertyId,
    scope: 'property',
    category,
    fileName: file.name,
    storagePath,
    mimeType,
    sizeBytes: file.size,
    uploadedAtMillis,
    uploadedAt: serverTimestamp(),
    uploadedBy,
    virusScanStatus: 'pending' satisfies VirusScanStatus,
    parsingStatus: 'not_applicable' satisfies ParsingStatus,
    parsingEligible,
    extractedData: EMPTY_EXTRACTED_DATA,
    ...(promesseScope
      ? {
          promesseScope: true,
          promesseDocument: true,
          ...(promesseDocLabel ? { promesseDocLabel } : {}),
        }
      : {}),
  });

  const objectRef = ref(storage, storagePath);
  await uploadBytes(objectRef, file, {
    contentType: mimeType,
    customMetadata: {
      courtiersResponsables: uploadedBy,
      propertyId,
      category,
      firestoreDocId: docRef.id,
    },
  });

  const record: PropertyDocumentRecord = {
    id: docRef.id,
    propertyId,
    scope: 'property',
    category,
    fileName: file.name,
    storagePath,
    mimeType,
    sizeBytes: file.size,
    uploadedAtMillis,
    uploadedBy,
    virusScanStatus: 'pending',
    parsingStatus: 'not_applicable',
    parsingEligible,
    extractedData: EMPTY_EXTRACTED_DATA,
    promesseScope: promesseScope === true,
    promesseDocLabel,
  };

  try {
    const scanned = await scanPropertyDocumentNow(propertyId, docRef.id);
    let parsingStatus = scanned.parsingStatus;
    if (scanned.virusScanStatus === 'clean' && scanned.parsingStatus === 'pending') {
      try {
        const parsed = await parsePropertyDocumentNow(propertyId, docRef.id);
        parsingStatus = parsed.parsingStatus === 'completed' ? 'completed' : parsed.parsingStatus;
      } catch (parseErr) {
        console.warn('[propertyDocuments] parse after upload failed', parseErr);
      }
    }
    return {
      ...record,
      virusScanStatus: scanned.virusScanStatus,
      parsingStatus,
    };
  } catch (e) {
    console.warn('[propertyDocuments] scan after upload failed, reconcile fallback', e);
    try {
      await reconcilePropertyDocumentScans(propertyId);
    } catch {
      /* listener temps réel rattrapera au prochain passage */
    }
    return record;
  }
}

export async function getPropertyDocumentDownloadUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}

/** Supprime métadonnées Firestore et objet Storage. */
/** Lance le scan serveur pour un document précis. */
export async function scanPropertyDocumentNow(
  propertyId: string,
  documentId: string
): Promise<{ virusScanStatus: VirusScanStatus; parsingStatus: ParsingStatus }> {
  const callable = httpsCallable<
    { propertyId: string; documentId: string },
    { ok: boolean; virusScanStatus: VirusScanStatus; parsingStatus: ParsingStatus }
  >(functions, 'propertyDocumentScanDocument');
  const res = await callable({ propertyId, documentId });
  const data = res.data;
  return {
    virusScanStatus: data.virusScanStatus ?? 'infected',
    parsingStatus: data.parsingStatus ?? 'not_applicable',
  };
}

/** Lance l’analyse IA Gemini sur un document (dossier Financier). */
export async function parsePropertyDocumentNow(
  propertyId: string,
  documentId: string
): Promise<{ parsingStatus: ParsingStatus }> {
  const callable = httpsCallable<
    { propertyId: string; documentId: string },
    { ok: boolean; parsingStatus: 'completed' | 'failed' | 'skipped' }
  >(functions, 'propertyDocumentParseIA');
  const res = await callable({ propertyId, documentId });
  const status = res.data.parsingStatus;
  if (status === 'completed') return { parsingStatus: 'completed' };
  if (status === 'failed') return { parsingStatus: 'failed' };
  return { parsingStatus: 'not_applicable' };
}

/** Réconcilie les analyses IA en attente (`parsingStatus: pending`). */
export async function reconcilePropertyDocumentParses(
  propertyId: string
): Promise<{ processed: number; completed: number; failed: number; skipped: number }> {
  const callable = httpsCallable<
    { propertyId: string },
    { ok: boolean; processed: number; completed: number; failed: number; skipped: number }
  >(functions, 'propertyDocumentsReconcileParse');
  const res = await callable({ propertyId });
  const data = res.data;
  return {
    processed: data.processed ?? 0,
    completed: data.completed ?? 0,
    failed: data.failed ?? 0,
    skipped: data.skipped ?? 0,
  };
}

/** Relance le scan pour les documents bloqués en `pending`. */
export async function reconcilePropertyDocumentScans(
  propertyId: string
): Promise<{ processed: number; cleaned: number; infected: number }> {
  const callable = httpsCallable<
    { propertyId: string },
    { ok: boolean; processed: number; cleaned: number; infected: number }
  >(functions, 'propertyDocumentsReconcileScan');
  const res = await callable({ propertyId });
  const data = res.data;
  return {
    processed: data.processed ?? 0,
    cleaned: data.cleaned ?? 0,
    infected: data.infected ?? 0,
  };
}

/** Renomme l’affichage du document (Firestore `fileName` — le chemin Storage reste inchangé). */
export async function renamePropertyDocument(
  propertyId: string,
  documentId: string,
  newDisplayName: string,
  originalFileName: string
): Promise<string> {
  if (!propertyId || !documentId) {
    throw new Error('propertyId et documentId requis.');
  }

  const fileName = ensureOriginalFileExtension(newDisplayName, originalFileName);
  const safeName = sanitizeFileName(fileName);

  await updateDoc(doc(db, RESIDENCES_COLLECTION, propertyId, DOCUMENTS_SUBCOLLECTION, documentId), {
    fileName: safeName,
    renamedAtMillis: Date.now(),
  });

  return safeName;
}

export async function deletePropertyDocument(
  propertyId: string,
  record: PropertyDocumentRecord
): Promise<void> {
  await deleteDoc(doc(db, RESIDENCES_COLLECTION, propertyId, DOCUMENTS_SUBCOLLECTION, record.id));
  try {
    await deleteObject(ref(storage, record.storagePath));
  } catch (e) {
    console.warn('[propertyDocuments] storage delete skipped', e);
  }
}
