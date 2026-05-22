/**
 * Documents généraux agence — SSOT `organizations/{orgId}/agencyDocuments`.
 * Storage : `primexpert/{orgId}/agency_documents/{category}/...`
 */

import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { resolveUploadContentType } from '../lib/propertyDocumentValidation';

export const AGENCY_DOCUMENT_CATEGORIES = [
  { id: 'gabarits', labelFr: 'Gabarits et modèles', labelEn: 'Templates' },
  { id: 'notes', labelFr: 'Notes et références', labelEn: 'Notes & references' },
  { id: 'autre', labelFr: 'Autres documents', labelEn: 'Other documents' },
] as const;

export type AgencyDocumentCategory = (typeof AGENCY_DOCUMENT_CATEGORIES)[number]['id'];

export interface AgencyDocumentRecord {
  id: string;
  orgId: string;
  category: AgencyDocumentCategory;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAtMillis: number;
  uploadedBy: string;
}

function agencyCol(orgId: string) {
  return collection(db, 'organizations', orgId, 'agencyDocuments');
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[^\w.\-àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ ]/gi, '_').trim();
  return base.length > 0 ? base : 'document';
}

function buildStoragePath(
  orgId: string,
  category: AgencyDocumentCategory,
  fileName: string
): string {
  return `primexpert/${orgId}/agency_documents/${category}/${Date.now()}-${fileName}`;
}

function mapDoc(orgId: string, id: string, data: Record<string, unknown>): AgencyDocumentRecord {
  const uploadedAt = data.uploadedAtMillis ?? data.uploadedAt;
  let uploadedAtMillis = Date.now();
  if (typeof uploadedAt === 'number') uploadedAtMillis = uploadedAt;
  else if (uploadedAt && typeof uploadedAt === 'object' && 'toMillis' in uploadedAt) {
    uploadedAtMillis = (uploadedAt as { toMillis: () => number }).toMillis();
  }
  return {
    id,
    orgId,
    category: (data.category as AgencyDocumentCategory) ?? 'autre',
    fileName: String(data.fileName ?? 'document'),
    storagePath: String(data.storagePath ?? ''),
    mimeType: String(data.mimeType ?? 'application/octet-stream'),
    sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : 0,
    uploadedAtMillis,
    uploadedBy: String(data.uploadedBy ?? ''),
  };
}

export function subscribeAgencyDocuments(
  orgId: string,
  onUpdate: (rows: AgencyDocumentRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!orgId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(agencyCol(orgId), orderBy('uploadedAtMillis', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(snap.docs.map((d) => mapDoc(orgId, d.id, d.data() as Record<string, unknown>)));
    },
    (err) => {
      console.error('[agencyDocuments] subscribe failed', err);
      onError?.(err as Error);
      onUpdate([]);
    }
  );
}

export async function uploadAgencyDocument(input: {
  orgId: string;
  category: AgencyDocumentCategory;
  file: File;
  uploadedBy: string;
}): Promise<AgencyDocumentRecord> {
  const { orgId, category, file, uploadedBy } = input;
  if (!orgId || !file || !uploadedBy) {
    throw new Error('orgId, file et uploadedBy requis.');
  }
  const safeName = sanitizeFileName(file.name);
  const storagePath = buildStoragePath(orgId, category, safeName);
  const uploadedAtMillis = Date.now();
  const mimeType = resolveUploadContentType(file);

  const docRef = await addDoc(agencyCol(orgId), {
    orgId,
    category,
    fileName: file.name,
    storagePath,
    mimeType,
    sizeBytes: file.size,
    uploadedAtMillis,
    uploadedAt: serverTimestamp(),
    uploadedBy,
  });

  await uploadBytes(ref(storage, storagePath), file, {
    contentType: mimeType,
    customMetadata: { orgId, scope: 'agency_document', category },
  });

  return {
    id: docRef.id,
    orgId,
    category,
    fileName: file.name,
    storagePath,
    mimeType,
    sizeBytes: file.size,
    uploadedAtMillis,
    uploadedBy,
  };
}

export async function getAgencyDocumentDownloadUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}
