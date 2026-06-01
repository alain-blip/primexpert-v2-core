/**
 * Trigger Firestore — journal LegalComplianceLog sur écritures legal_vault.
 * Région : northamerica-northeast1 (Loi 25 — Montréal).
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import type { Change, DocumentSnapshot, FirestoreEvent } from 'firebase-functions/v2/firestore';
import { getDb } from '../lib/firestore';
import {
  appendLegalComplianceLogEntry,
  mapFirestoreRoleToLegalComplianceRole,
} from './legalComplianceLogWriter';
import type { LegalComplianceActionType } from './_vendored/vaultSpecsTypes';

const MONTREAL = 'northamerica-northeast1' as const;

type VaultDocData = {
  brokerId?: string;
  isFinalWormLocked?: boolean;
  lastWriteClientIp?: string;
};

function resolveActionType(
  before: DocumentSnapshot | undefined,
  after: DocumentSnapshot | undefined
): LegalComplianceActionType | null {
  const beforeExists = before?.exists ?? false;
  const afterExists = after?.exists ?? false;

  if (!beforeExists && afterExists) return 'WRITE';

  if (beforeExists && afterExists) {
    const prev = (before?.data() ?? {}) as VaultDocData;
    const next = (after?.data() ?? {}) as VaultDocData;
    if (prev.isFinalWormLocked === false && next.isFinalWormLocked === true) {
      return 'LOCK';
    }
    return 'WRITE';
  }

  return null;
}

async function resolveUserRole(userId: string): Promise<ReturnType<typeof mapFirestoreRoleToLegalComplianceRole>> {
  const snap = await getDb().collection('users').doc(userId).get();
  const role = snap.exists ? String(snap.data()?.role ?? '') : undefined;
  return mapFirestoreRoleToLegalComplianceRole(role);
}

async function handleVaultDocumentWrite(
  event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { orgId: string; documentId: string }>
): Promise<void> {
  const change = event.data;
  if (!change) return;

  const { orgId, documentId } = event.params;
  const actionType = resolveActionType(change.before, change.after);
  if (!actionType) return;

  const afterData = (change.after?.data() ?? {}) as VaultDocData;
  const brokerId = String(afterData.brokerId ?? '').trim();
  if (!brokerId) {
    console.warn('[onVaultDocumentWrite] brokerId absent — journal ignoré', { orgId, documentId });
    return;
  }

  const userRole = await resolveUserRole(brokerId);
  const clientIpAddress = String(afterData.lastWriteClientIp ?? 'cloud-function').trim() || 'cloud-function';

  await appendLegalComplianceLogEntry({
    db: getDb(),
    orgId,
    documentId,
    userId: brokerId,
    userRole,
    actionType,
    clientIpAddress,
  });

  console.info('[onVaultDocumentWrite] LegalComplianceLog append', {
    orgId,
    documentId,
    actionType,
    brokerId,
  });
}

export const onVaultDocumentWrite = onDocumentWritten(
  {
    document: 'organizations/{orgId}/legal_vault/{documentId}',
    region: MONTREAL,
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  handleVaultDocumentWrite
);
