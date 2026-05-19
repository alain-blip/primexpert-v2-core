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
export type DriveDocumentScope = 'property' | 'contact' | 'broker_tools';
export type DriveItemType = 'folder' | 'file';

/** Phase D-2 — Type de document Drive (recording, upload manuel, etc.) */
export type DriveDocumentType = 'document' | 'recording';

/** E-3 — état persistant sur `drive_documents` pour la transcription Gemini. */
export type DriveTranscriptionStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface DriveDocument {
  id: string;
  courtiersResponsables: string;
  scope: DriveDocumentScope;
  type: DriveItemType;
  parentId?: string;
  residenceId?: string;
  contactId?: string;
  toolFolder?: string;
  fileName: string;
  storagePath: string;
  mime: string;
  size: number;
  uploadedAtMillis: number;
  uploadedBy: string;
  status: DriveDocumentStatus;
  /** Phase D-2 — distingue enregistrement vocal d'un document classique */
  documentType?: DriveDocumentType;
  documentLabel?: string;
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
  scope?: DriveDocumentScope;
  residenceId?: string;
  contactId?: string;
  toolFolder?: string;
  parentId?: string;
  documentLabel?: string;
  ctx: TenantContext;
}

export interface CreateFolderParams {
  name: string;
  scope: DriveDocumentScope;
  parentId?: string;
  residenceId?: string;
  contactId?: string;
  toolFolder?: string;
  ctx: TenantContext;
}

/**
 * Construit le chemin Storage déterministe.
 */
function buildStoragePath(
  brokerId: string,
  scope: DriveDocumentScope,
  ids: { residenceId?: string; contactId?: string; toolFolder?: string },
  fileName: string
): string {
  const safeName = fileName.replace(/[^\w.\-]/g, '_');
  const stamp = Date.now();
  if (scope === 'property' && ids.residenceId) {
    return `primexpert/${brokerId}/residences/${ids.residenceId}/${stamp}-${safeName}`;
  }
  if (scope === 'contact' && ids.contactId) {
    return `primexpert/${brokerId}/contacts/${ids.contactId}/${stamp}-${safeName}`;
  }
  if (scope === 'broker_tools') {
    const folder = (ids.toolFolder || 'modeles').replace(/[^\w.\-]/g, '_');
    return `primexpert/${brokerId}/broker_tools/${folder}/${stamp}-${safeName}`;
  }
  return `primexpert/${brokerId}/general/${stamp}-${safeName}`;
}

/**
 * Téléverse un fichier dans Firebase Storage + crée la métadonnée Firestore.
 * Tout est multi-tenant (brokerId garanti via stampTenant).
 */
export async function uploadDriveDocument({
  file,
  scope = 'property',
  residenceId,
  contactId,
  toolFolder,
  parentId,
  documentLabel,
  ctx,
}: UploadParams): Promise<DriveDocument> {
  if (ctx.mode !== 'strict' || !ctx.tenantId) {
    throw new Error('[driveStorage.upload] Contexte tenant strict requis.');
  }

  const storagePath = buildStoragePath(ctx.tenantId, scope, { residenceId, contactId, toolFolder }, file.name);
  const objectRef = ref(storage, storagePath);

  const uploadResult: UploadResult = await uploadBytes(objectRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      [TENANT_FIELD]: ctx.tenantId,
      scope,
      type: 'file',
      parentId: parentId ?? '',
      residenceId: residenceId ?? '',
      contactId: contactId ?? '',
      toolFolder: toolFolder ?? '',
      documentType: 'document',
      documentLabel: documentLabel ?? '',
      originalName: file.name,
    },
  });

  const metadataPayload = stampTenant(
    {
      scope,
      type: 'file' as DriveItemType,
      parentId: parentId ?? null,
      residenceId: residenceId ?? null,
      contactId: contactId ?? null,
      toolFolder: toolFolder ?? null,
      documentType: 'document' as DriveDocumentType,
      documentLabel: documentLabel ?? '',
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
    scope,
    type: 'file',
    parentId,
    residenceId,
    contactId,
    toolFolder,
    fileName: file.name,
    storagePath,
    mime: file.type || 'application/octet-stream',
    size: uploadResult.metadata.size ?? file.size,
    uploadedAtMillis: Date.now(),
    uploadedBy: ctx.tenantId,
    status: 'ready',
    documentType: 'document',
    documentLabel,
  };
}

export async function createDriveFolder({
  name,
  scope,
  parentId,
  residenceId,
  contactId,
  toolFolder,
  ctx,
}: CreateFolderParams): Promise<DriveDocument> {
  if (ctx.mode !== 'strict' || !ctx.tenantId) {
    throw new Error('[driveStorage.createFolder] Contexte tenant strict requis.');
  }
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nom du dossier requis.');

  const payload = stampTenant(
    {
      scope,
      type: 'folder' as DriveItemType,
      parentId: parentId ?? null,
      residenceId: residenceId ?? null,
      contactId: contactId ?? null,
      toolFolder: toolFolder ?? null,
      fileName: trimmed,
      storagePath: '',
      mime: 'application/vnd.primexpert.folder',
      size: 0,
      uploadedBy: ctx.tenantId,
      uploadedAt: serverTimestamp(),
      status: 'ready' as DriveDocumentStatus,
      documentType: 'document' as DriveDocumentType,
      documentLabel: 'Dossier',
    },
    ctx
  );

  const docRef = await addDoc(collection(db, DRIVE_COLLECTION), payload);
  return {
    id: docRef.id,
    courtiersResponsables: ctx.tenantId,
    scope,
    type: 'folder',
    parentId,
    residenceId,
    contactId,
    toolFolder,
    fileName: trimmed,
    storagePath: '',
    mime: 'application/vnd.primexpert.folder',
    size: 0,
    uploadedAtMillis: Date.now(),
    uploadedBy: ctx.tenantId,
    status: 'ready',
    documentType: 'document',
    documentLabel: 'Dossier',
  };
}

/**
 * Récupère la liste des documents du tenant courant.
 */
export async function listDriveDocuments(
  ctx: TenantContext,
  filters?: { scope?: DriveDocumentScope; residenceId?: string; contactId?: string }
): Promise<DriveDocument[]> {
  const constraints = tenantConstraints(ctx);
  if (filters?.scope) constraints.push({ field: 'scope', op: '==', value: filters.scope });
  if (filters?.residenceId) constraints.push({ field: 'residenceId', op: '==', value: filters.residenceId });
  if (filters?.contactId) constraints.push({ field: 'contactId', op: '==', value: filters.contactId });
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
      scope: (data.scope ?? (data.residenceId ? 'property' : 'broker_tools')) as DriveDocumentScope,
      type: (data.type === 'folder' ? 'folder' : 'file') as DriveItemType,
      parentId: data.parentId ?? undefined,
      residenceId: data.residenceId ?? undefined,
      contactId: data.contactId ?? undefined,
      toolFolder: data.toolFolder ?? undefined,
      fileName: String(data.fileName ?? ''),
      storagePath: String(data.storagePath ?? ''),
      mime: String(data.mime ?? ''),
      size: Number(data.size ?? 0),
      uploadedAtMillis,
      uploadedBy: String(data.uploadedBy ?? ''),
      status: (data.status ?? 'ready') as DriveDocumentStatus,
      documentType: data.documentType as DriveDocumentType | undefined,
      documentLabel: typeof data.documentLabel === 'string' ? data.documentLabel : undefined,
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
