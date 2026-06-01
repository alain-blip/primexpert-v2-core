/**
 * Coffre-fort légal WORM — organizations/{orgId}/legal_vault/{documentId}
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  computeOaciqVaultRetentionExpiryMillis,
  type LegalVaultDocument,
  type LegalVaultMetadataCrossCheck,
} from '@primexpert/core/security';
import { db } from '../lib/firebase';
import {
  buildLegalVaultDocumentId,
  buildLegalVaultStorageUrl,
  resolveLegalVaultDocumentType,
} from '../lib/legalVaultDocumentMapping';
import type { PropertyDocumentRecord } from '../types/propertyDocument';

export type LegalVaultFirestoreRecord = LegalVaultDocument & {
  propertyId: string;
  propertyDocumentId: string;
};

export function isFirestorePermissionDenied(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === 'permission-denied' || code === 'PERMISSION_DENIED';
}

export function formatLegalVaultPermissionError(locale: 'fr' | 'en'): string {
  return locale === 'fr'
    ? 'Accès refusé (403) — le verrouillage légal OACIQ a été rejeté par les règles de sécurité Firestore. Vérifiez votre organisation et le statut du document.'
    : 'Access denied (403) — OACIQ legal lock was rejected by Firestore security rules. Check your organization and document status.';
}

export async function resolveClientIpAddress(): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    window.clearTimeout(timer);
    if (!res.ok) return '0.0.0.0';
    const json = (await res.json()) as { ip?: string };
    return json.ip?.trim() || '0.0.0.0';
  } catch {
    return '0.0.0.0';
  }
}

function legalVaultCol(orgId: string) {
  return collection(db, 'organizations', orgId, 'legal_vault');
}

function legalVaultRef(orgId: string, vaultDocumentId: string) {
  return doc(db, 'organizations', orgId, 'legal_vault', vaultDocumentId);
}

/** Écoute tous les coffres WORM rattachés à une fiche résidence. */
export function subscribeLegalVaultByProperty(
  orgId: string,
  propertyId: string,
  onData: (byPropertyDocumentId: Record<string, LegalVaultFirestoreRecord>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!orgId || !propertyId) {
    onData({});
    return () => undefined;
  }

  const q = query(legalVaultCol(orgId), where('propertyId', '==', propertyId));
  return onSnapshot(
    q,
    (snap) => {
      const map: Record<string, LegalVaultFirestoreRecord> = {};
      for (const d of snap.docs) {
        const data = d.data() as LegalVaultFirestoreRecord;
        const key = data.propertyDocumentId || d.id;
        map[key] = { ...data, documentId: data.documentId || d.id };
      }
      onData(map);
    },
    (err) => onError?.(err)
  );
}

export function subscribeLegalVaultDocument(
  orgId: string,
  vaultDocumentId: string,
  onData: (record: LegalVaultFirestoreRecord | null) => void
): Unsubscribe {
  if (!orgId || !vaultDocumentId) {
    onData(null);
    return () => undefined;
  }
  return onSnapshot(legalVaultRef(orgId, vaultDocumentId), (snap) => {
    if (!snap.exists()) {
      onData(null);
      return;
    }
    onData({ ...(snap.data() as LegalVaultFirestoreRecord), documentId: snap.id });
  });
}

export interface EnsureLegalVaultDraftParams {
  orgId: string;
  brokerId: string;
  propertyId: string;
  propertyDocument: PropertyDocumentRecord;
  metadataFieldsCrossChecked: LegalVaultMetadataCrossCheck;
}

export async function ensureLegalVaultDraft(
  params: EnsureLegalVaultDraftParams
): Promise<LegalVaultFirestoreRecord> {
  const vaultDocumentId = buildLegalVaultDocumentId(
    params.propertyId,
    params.propertyDocument.id
  );
  const ref = legalVaultRef(params.orgId, vaultDocumentId);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const data = existing.data() as LegalVaultFirestoreRecord;
    return { ...data, documentId: data.documentId || vaultDocumentId };
  }

  const createdAtMillis = Date.now();

  const payload: LegalVaultFirestoreRecord = {
    documentId: vaultDocumentId,
    documentType: resolveLegalVaultDocumentType(params.propertyDocument),
    storageUrl: buildLegalVaultStorageUrl(params.propertyDocument.storagePath),
    isFinalWormLocked: false,
    createdAtMillis,
    brokerId: params.brokerId,
    orgId: params.orgId,
    oaciqRetentionExpiryTimestamp: computeOaciqVaultRetentionExpiryMillis(createdAtMillis),
    metadataFieldsCrossChecked: params.metadataFieldsCrossChecked,
    propertyId: params.propertyId,
    propertyDocumentId: params.propertyDocument.id,
  };

  await setDoc(ref, payload);
  return payload;
}

export interface LockLegalVaultDocumentParams {
  orgId: string;
  brokerId: string;
  propertyId: string;
  propertyDocument: PropertyDocumentRecord;
  metadataFieldsCrossChecked: LegalVaultMetadataCrossCheck;
}

/** Crée le brouillon si absent, puis applique le verrou WORM définitif. */
export async function lockLegalVaultDocument(
  params: LockLegalVaultDocumentParams
): Promise<void> {
  const vaultDocumentId = buildLegalVaultDocumentId(
    params.propertyId,
    params.propertyDocument.id
  );
  await ensureLegalVaultDraft({
    orgId: params.orgId,
    brokerId: params.brokerId,
    propertyId: params.propertyId,
    propertyDocument: params.propertyDocument,
    metadataFieldsCrossChecked: params.metadataFieldsCrossChecked,
  });

  const clientIp = await resolveClientIpAddress();
  await updateDoc(legalVaultRef(params.orgId, vaultDocumentId), {
    isFinalWormLocked: true,
    lockedAtMillis: Date.now(),
    lastWriteClientIp: clientIp,
    metadataFieldsCrossChecked: params.metadataFieldsCrossChecked,
  });
}
