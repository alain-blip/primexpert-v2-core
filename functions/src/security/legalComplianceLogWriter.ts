/**
 * Persistance LegalComplianceLogEntry — chaînage SHA-256 (V3.0).
 * Écriture Admin SDK uniquement (sous-collection compliance_logs).
 */

import type { Firestore } from 'firebase-admin/firestore';
import {
  buildLegalComplianceLogEntry,
  type LegalComplianceActionType,
  type LegalComplianceLogEntry,
  type LegalComplianceUserRole,
} from './_vendored/vaultSpecsTypes';

export const COMPLIANCE_LOGS_SUBCOLLECTION = 'compliance_logs';

export interface AppendLegalComplianceLogParams {
  db: Firestore;
  orgId: string;
  documentId: string;
  userId: string;
  userRole: LegalComplianceUserRole;
  actionType: LegalComplianceActionType;
  timestampMillis?: number;
  clientIpAddress?: string;
}

export function mapFirestoreRoleToLegalComplianceRole(
  role: string | undefined
): LegalComplianceUserRole {
  switch (role) {
    case 'admin':
    case 'admin_system':
      return 'DIRIGEANT';
    case 'member':
      return 'COURTIER';
    default:
      return 'SUPPORT';
  }
}

async function fetchPreviousIntegrityHash(
  db: Firestore,
  orgId: string,
  documentId: string
): Promise<string> {
  const snap = await db
    .collection('organizations')
    .doc(orgId)
    .collection('legal_vault')
    .doc(documentId)
    .collection(COMPLIANCE_LOGS_SUBCOLLECTION)
    .orderBy('timestampMillis', 'desc')
    .limit(1)
    .get();

  if (snap.empty) return '';
  const prev = snap.docs[0].data() as Partial<LegalComplianceLogEntry>;
  return typeof prev.integrityHash === 'string' ? prev.integrityHash : '';
}

/** Append une entrée immuable dans compliance_logs (hash chaîné). */
export async function appendLegalComplianceLogEntry(
  params: AppendLegalComplianceLogParams
): Promise<LegalComplianceLogEntry> {
  const {
    db,
    orgId,
    documentId,
    userId,
    userRole,
    actionType,
    timestampMillis = Date.now(),
    clientIpAddress = 'cloud-function',
  } = params;

  const logsCol = db
    .collection('organizations')
    .doc(orgId)
    .collection('legal_vault')
    .doc(documentId)
    .collection(COMPLIANCE_LOGS_SUBCOLLECTION);

  const entryId = logsCol.doc().id;
  const previousIntegrityHash = await fetchPreviousIntegrityHash(db, orgId, documentId);

  const entry = await buildLegalComplianceLogEntry({
    entryId,
    userId,
    userRole,
    actionType,
    targetDocumentId: documentId,
    timestampMillis,
    clientIpAddress,
    previousIntegrityHash,
  });

  await logsCol.doc(entryId).set(entry);
  return entry;
}
