/**
 * driveStorage.ts — Service Drive PrimeXpert (Firebase Storage + Firestore)
 *
 * Brief « SYSTÈME SILOS 2026 v4 » §4 — Innovation majeure : Drive multi-tenant.
 *
 * Architecture :
 *   - Firebase Storage : stockage binaire des fichiers
 *     primexpert/{brokerId}/residences/{residenceId}/{timestamp}-{fileName}
 *     primexpert/{brokerId}/general/{timestamp}-{fileName}    (sans résidence)
 *
 *   - Firestore : métadonnées + recherche
 *     collection 'drive_documents'
 *     champs : courtiersResponsables, residenceId?, fileName, storagePath,
 *              mime, size, uploadedAt, uploadedBy, status
 *
 * Multi-tenant :
 *   - Toutes les écritures stamped via stampTenant()
 *   - Toutes les lectures filtrées via tenantConstraints()
 *
 * À doubler (Phase C) :
 *   - Firestore Security Rules (lecture/écriture sur drive_documents)
 *   - Storage Security Rules (lecture/écriture sur primexpert/{uid}/**)
 *
 * Phase B = upload + list. Pas d'extraction IA encore (Phase C).
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  type UploadResult,
} from 'firebase/storage';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import {
  tenantConstraints,
  stampTenant,
  TENANT_FIELD,
  type TenantContext,
} from '@primexpert/core/tenant';
import { fetchBinaryAsBase64 } from '../lib/fetchBinaryAsBase64';

const DRIVE_COLLECTION = 'drive_documents';

export type DriveDocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

/** Phase D-2 — Type de document Drive (recording, upload manuel, etc.) */
export type DriveDocumentType = 'document' | 'recording';

/** E-3 — état persistant sur `drive_documents` pour la transcription Gemini. */
export type DriveTranscriptionStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface DriveDocument {
  id: string;
  courtiersResponsables: string;
  residenceId?: string;
  fileName: string;
  storagePath: string;
  mime: string;
  size: number;
  uploadedAtMillis: number;
  uploadedBy: string;
  status: DriveDocumentStatus;
  /** Phase D-2 — distingue enregistrement vocal d'un document classique */
  documentType?: DriveDocumentType;
  /** Phase D-2 — durée du recording en ms (pour les recordings uniquement) */
  durationMs?: number;
  /** E-3 — transcription + résumé (après upload recording) */
  transcriptionStatus?: DriveTranscriptionStatus;
  transcriptionPlain?: string;
  recordingSummary?: {
    keyPoints: string[];
    actionItems: string[];
    clientSentiment: string;
  };
  transcribedAtMillis?: number;
  transcriptionError?: string;
}

export interface UploadParams {
  file: File;
  residenceId?: string;
  ctx: TenantContext;
}

/**
 * Construit le chemin Storage déterministe.
 */
function buildStoragePath(brokerId: string, residenceId: string | undefined, fileName: string): string {
  const safeName = fileName.replace(/[^\w.\-]/g, '_');
  const stamp = Date.now();
  if (residenceId) {
    return `primexpert/${brokerId}/residences/${residenceId}/${stamp}-${safeName}`;
  }
  return `primexpert/${brokerId}/general/${stamp}-${safeName}`;
}

/**
 * Téléverse un fichier dans Firebase Storage + crée la métadonnée Firestore.
 * Tout est multi-tenant (brokerId garanti via stampTenant).
 */
export async function uploadDriveDocument({ file, residenceId, ctx }: UploadParams): Promise<DriveDocument> {
  if (ctx.mode !== 'strict' || !ctx.tenantId) {
    throw new Error('[driveStorage.upload] Contexte tenant strict requis.');
  }

  const storagePath = buildStoragePath(ctx.tenantId, residenceId, file.name);
  const objectRef = ref(storage, storagePath);

  const uploadResult: UploadResult = await uploadBytes(objectRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      [TENANT_FIELD]: ctx.tenantId,
      residenceId: residenceId ?? '',
      originalName: file.name,
    },
  });

  const metadataPayload = stampTenant(
    {
      residenceId: residenceId ?? null,
      fileName: file.name,
      storagePath,
      mime: file.type || 'application/octet-stream',
      size: uploadResult.metadata.size ?? file.size,
      uploadedBy: ctx.tenantId,
      uploadedAt: serverTimestamp(),
      status: 'ready' as DriveDocumentStatus,
    },
    ctx
  );

  const docRef = await addDoc(collection(db, DRIVE_COLLECTION), metadataPayload);

  return {
    id: docRef.id,
    courtiersResponsables: ctx.tenantId,
    residenceId,
    fileName: file.name,
    storagePath,
    mime: file.type || 'application/octet-stream',
    size: uploadResult.metadata.size ?? file.size,
    uploadedAtMillis: Date.now(),
    uploadedBy: ctx.tenantId,
    status: 'ready',
  };
}

/**
 * Récupère la liste des documents du tenant courant.
 */
export async function listDriveDocuments(ctx: TenantContext): Promise<DriveDocument[]> {
  const constraints = tenantConstraints(ctx);
  const baseRef = collection(db, DRIVE_COLLECTION);
  const q = constraints.length === 0
    ? query(baseRef)
    : query(baseRef, ...constraints.map((c) => where(c.field, c.op, c.value)));

  let snapshot: QuerySnapshot<DocumentData>;
  try {
    snapshot = await getDocs(q);
  } catch (error) {
    console.error('[driveStorage.list] Firestore query failed:', error);
    return [];
  }

  return snapshot.docs.map((d) => {
    const data = d.data();
    const uploadedAtAny = data.uploadedAt;
    const uploadedAtMillis =
      typeof uploadedAtAny?.toMillis === 'function'
        ? uploadedAtAny.toMillis()
        : typeof uploadedAtAny === 'number'
        ? uploadedAtAny
        : 0;
    return {
      id: d.id,
      courtiersResponsables: String(data[TENANT_FIELD] ?? ''),
      residenceId: data.residenceId ?? undefined,
      fileName: String(data.fileName ?? ''),
      storagePath: String(data.storagePath ?? ''),
      mime: String(data.mime ?? ''),
      size: Number(data.size ?? 0),
      uploadedAtMillis,
      uploadedBy: String(data.uploadedBy ?? ''),
      status: (data.status ?? 'ready') as DriveDocumentStatus,
      documentType: data.documentType as DriveDocumentType | undefined,
      durationMs: typeof data.durationMs === 'number' ? data.durationMs : undefined,
      transcriptionStatus: data.transcriptionStatus as DriveTranscriptionStatus | undefined,
      transcriptionPlain:
        typeof data.transcriptionPlain === 'string' ? data.transcriptionPlain : undefined,
      recordingSummary:
        data.recordingSummary && typeof data.recordingSummary === 'object'
          ? (data.recordingSummary as DriveDocument['recordingSummary'])
          : undefined,
      transcribedAtMillis:
        typeof data.transcribedAtMillis === 'number' ? data.transcribedAtMillis : undefined,
      transcriptionError:
        typeof data.transcriptionError === 'string' ? data.transcriptionError : undefined,
    } satisfies DriveDocument;
  });
}

/**
 * URL signée de téléchargement (court terme).
 */
export async function getDriveDocumentUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}

/**
 * Télécharge un objet Storage (URL signée) en base64 — pour pipeline IA (E-3, Drive C).
 */
export async function fetchStoragePathAsBase64(
  storagePath: string
): Promise<{ data: string; mime: string }> {
  const url = await getDriveDocumentUrl(storagePath);
  return fetchBinaryAsBase64(url);
}

// ============================================================================
// Phase D-2 — RECORDINGS (Softphone Lite, MediaRecorder du navigateur)
// ============================================================================

export interface UploadRecordingParams {
  /** Blob audio capturé par MediaRecorder (typiquement audio/webm) */
  blob: Blob;
  /** Résidence rattachée — obligatoire pour un recording (Brief D-2 Auto) */
  residenceId: string;
  /** Durée enregistrée en ms */
  durationMs: number;
  /** Numéro composé (optionnel — journal de conformité / auditLog) */
  dialedNumber?: string;
  ctx: TenantContext;
}

/**
 * Téléverse un enregistrement audio dans :
 *   primexpert/{brokerId}/residences/{residenceId}/recordings/{timestamp}.webm
 *
 * Et crée la métadonnée Firestore avec `documentType: 'recording'` pour
 * que le Drive et les fiches résidence puissent filtrer dessus.
 *
 * Brief « SYSTÈME SILOS 2026 v4 » D-2 :
 *   « Click-to-Call Natif (tel:) + MediaRecorder + injection Drive directe »
 */
export async function uploadDriveRecording({
  blob,
  residenceId,
  durationMs,
  dialedNumber,
  ctx,
}: UploadRecordingParams): Promise<DriveDocument> {
  if (ctx.mode !== 'strict' || !ctx.tenantId) {
    throw new Error('[driveStorage.uploadRecording] Contexte tenant strict requis.');
  }
  if (!residenceId) {
    throw new Error('[driveStorage.uploadRecording] residenceId requis pour un recording.');
  }

  const stamp = Date.now();
  const isoDate = new Date(stamp).toISOString().replace(/[:.]/g, '-');
  const ext = blob.type.includes('webm') ? 'webm'
            : blob.type.includes('mp4')  ? 'mp4'
            : blob.type.includes('ogg')  ? 'ogg'
            : 'bin';
  const fileName = `Appel_${isoDate}.${ext}`;
  const storagePath = `primexpert/${ctx.tenantId}/residences/${residenceId}/recordings/${stamp}-${fileName}`;
  const objectRef = ref(storage, storagePath);

  const uploadResult: UploadResult = await uploadBytes(objectRef, blob, {
    contentType: blob.type || 'audio/webm',
    customMetadata: {
      [TENANT_FIELD]: ctx.tenantId,
      residenceId,
      documentType: 'recording',
      durationMs: String(durationMs),
      ...(dialedNumber ? { dialedNumber } : {}),
    },
  });

  const metadataPayload = stampTenant(
    {
      residenceId,
      fileName,
      storagePath,
      mime: blob.type || 'audio/webm',
      size: uploadResult.metadata.size ?? blob.size,
      uploadedBy: ctx.tenantId,
      uploadedAt: serverTimestamp(),
      status: 'ready' as DriveDocumentStatus,
      documentType: 'recording' as DriveDocumentType,
      durationMs,
      ...(dialedNumber ? { dialedNumber } : {}),
    },
    ctx
  );

  const docRef = await addDoc(collection(db, DRIVE_COLLECTION), metadataPayload);

  return {
    id: docRef.id,
    courtiersResponsables: ctx.tenantId,
    residenceId,
    fileName,
    storagePath,
    mime: blob.type || 'audio/webm',
    size: uploadResult.metadata.size ?? blob.size,
    uploadedAtMillis: stamp,
    uploadedBy: ctx.tenantId,
    status: 'ready',
    documentType: 'recording',
    durationMs,
  };
}
