/**
 * Documents promesse d'achat — sous-dossier transactionnel (même scan sécurité que diligence).
 */

import {
  deletePropertyDocument,
  getPropertyDocumentDownloadUrl,
  subscribeAllPropertyDocuments,
  uploadPropertyDocument,
} from './propertyDocumentsService';
import type { PropertyDocumentRecord } from '../types/propertyDocument';
import type { Unsubscribe } from 'firebase/firestore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const RESIDENCES = 'residences';
const DOCUMENTS = 'documents';

export type PromesseDocumentKind =
  | 'loi'
  | 'contre_proposition'
  | 'modification'
  | 'autre';

export interface PromesseDocumentRecord extends PropertyDocumentRecord {
  promesseScope: true;
  promesseDocKind?: PromesseDocumentKind;
  promesseDocLabel?: string;
}

export function subscribePromesseDocuments(
  propertyId: string,
  onUpdate: (rows: PromesseDocumentRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeAllPropertyDocuments(
    propertyId,
    (all) => {
      onUpdate(
        all
          .filter((d) => d.promesseScope === true)
          .map((d) => ({ ...d, promesseScope: true as const }))
      );
    },
    onError
  );
}

/** Marque un document uploadé comme pièce promesse (après création). */
async function tagPromesseDocument(
  propertyId: string,
  documentId: string,
  kind: PromesseDocumentKind
): Promise<void> {
  const labels: Record<PromesseDocumentKind, string> = {
    loi: 'Lettre d\'intention',
    contre_proposition: 'Contre-proposition',
    modification: 'Modification',
    autre: 'Autre',
  };
  await updateDoc(doc(db, RESIDENCES, propertyId, DOCUMENTS, documentId), {
    promesseScope: true,
    promesseDocument: true,
    promesseDocKind: kind,
    promesseDocLabel: labels[kind],
  });
}

export async function uploadPromesseDocument(input: {
  propertyId: string;
  file: File;
  uploadedBy: string;
  kind?: PromesseDocumentKind;
}): Promise<PromesseDocumentRecord> {
  const record = await uploadPropertyDocument({
    propertyId: input.propertyId,
    category: 'legal',
    file: input.file,
    uploadedBy: input.uploadedBy,
  });
  await tagPromesseDocument(input.propertyId, record.id, input.kind ?? 'autre');
  return {
    ...record,
    promesseScope: true,
    promesseDocKind: input.kind,
  };
}

export async function removePromesseDocument(
  propertyId: string,
  document: PromesseDocumentRecord
): Promise<void> {
  await deletePropertyDocument(propertyId, document);
}

export { getPropertyDocumentDownloadUrl };
