/**
 * Vault légal WORM & journal d'adéquation de conformité légale — V2.9
 *
 * Encadre l'intégrité documentaire OACIQ (rétention 6 ans) et la traçabilité
 * des accès (secret professionnel, Loi sur le courtage immobilier).
 *
 * Stockage chiffré cible : bucket AES-256, région Montréal (northamerica-northeast1).
 * Règle #0 : enrichir l'existant — aucune collection parallèle au Vault.
 */

/** Rétention stricte OACIQ après clôture définitive du dossier (6 ans). */
export const OACIQ_VAULT_RETENTION_DAYS = 2190;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const LEGAL_VAULT_DOCUMENT_TYPES = [
  'CONTRAT_COURTAGE',
  'PROMESSE_ACHAT',
  'FICHE_DESCRIPTIVE',
  'ACM_REPORT',
] as const;

export type LegalVaultDocumentType = (typeof LEGAL_VAULT_DOCUMENT_TYPES)[number];

/** Région Storage/Firestore cible pour données soumises à la Loi 25 (Québec). */
export const LEGAL_VAULT_STORAGE_REGION = 'northamerica-northeast1' as const;

export interface LegalVaultMetadataCrossCheck {
  contractPrice: number;
  validatedLicenseName: string;
  licenseType: string;
}

/**
 * Document archivé dans le coffre-fort immuable (WORM).
 * Firestore Rules : si `isFinalWormLocked === true`, interdire update/delete
 * jusqu'à `oaciqRetentionExpiryTimestamp`.
 */
export interface LegalVaultDocument {
  documentId: string;
  documentType: LegalVaultDocumentType;
  /** Pointe vers le bucket chiffré AES-256 à Montréal (northamerica-northeast1). */
  storageUrl: string;
  /** Si true → Firestore Rules bloque toute modification/suppression. */
  isFinalWormLocked: boolean;
  createdAtMillis: number;
  lockedAtMillis?: number;
  brokerId: string;
  orgId: string;
  /** Fin de rétention stricte — 2190 jours après clôture du dossier. */
  oaciqRetentionExpiryTimestamp: number;
  metadataFieldsCrossChecked: LegalVaultMetadataCrossCheck;
}

export const LEGAL_COMPLIANCE_USER_ROLES = [
  'COURTIER',
  'ADJOINT',
  'DIRIGEANT',
  'SUPPORT',
] as const;

export type LegalComplianceUserRole = (typeof LEGAL_COMPLIANCE_USER_ROLES)[number];

export const LEGAL_COMPLIANCE_ACTION_TYPES = [
  'READ',
  'WRITE',
  'LOCK',
  'EXPORT_ZIP',
] as const;

export type LegalComplianceActionType = (typeof LEGAL_COMPLIANCE_ACTION_TYPES)[number];

/**
 * Entrée du registre d'accès — démontre le respect du secret professionnel.
 * Chaîne d'intégrité : `integrityHash` = SHA-256(payload canonique + hash précédent).
 */
export interface LegalComplianceLogEntry {
  entryId: string;
  userId: string;
  userRole: LegalComplianceUserRole;
  actionType: LegalComplianceActionType;
  targetDocumentId: string;
  timestampMillis: number;
  clientIpAddress: string;
  /** SHA-256 liant l'entrée précédente — immuabilité contre la falsification. */
  integrityHash: string;
}

/** Horodatage d'expiration de rétention OACIQ à partir de la clôture du dossier. */
export function computeOaciqVaultRetentionExpiryMillis(
  dossierClosedAtMillis: number
): number {
  if (!Number.isFinite(dossierClosedAtMillis) || dossierClosedAtMillis <= 0) {
    return 0;
  }
  return dossierClosedAtMillis + OACIQ_VAULT_RETENTION_DAYS * MS_PER_DAY;
}

/** Indique si la rétention légale est encore active à l'instant de référence. */
export function isLegalVaultRetentionActive(
  oaciqRetentionExpiryTimestamp: number,
  referenceNowMillis: number = Date.now()
): boolean {
  if (!Number.isFinite(oaciqRetentionExpiryTimestamp) || oaciqRetentionExpiryTimestamp <= 0) {
    return false;
  }
  return referenceNowMillis < oaciqRetentionExpiryTimestamp;
}

/** Payload canonique JSON-stable pour le chaînage SHA-256 du journal de conformité. */
export function buildLegalComplianceLogHashInput(
  entry: Omit<LegalComplianceLogEntry, 'integrityHash' | 'entryId'>,
  previousIntegrityHash: string
): string {
  return JSON.stringify({
    actionType: entry.actionType,
    clientIpAddress: entry.clientIpAddress,
    previousIntegrityHash: previousIntegrityHash.trim(),
    targetDocumentId: entry.targetDocumentId,
    timestampMillis: entry.timestampMillis,
    userId: entry.userId,
    userRole: entry.userRole,
  });
}

/**
 * Calcule le hash d'intégrité SHA-256 d'une entrée de journal.
 * Utilise Web Crypto (navigateur / Node 18+). Cloud Functions : préférer le même
 * format via `buildLegalComplianceLogHashInput` pour garantir la parité.
 */
export async function computeLegalComplianceLogIntegrityHash(
  canonicalPayload: string
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'LEGAL_COMPLIANCE_HASH_UNAVAILABLE: Web Crypto indisponible dans cet environnement.'
    );
  }
  const data = new TextEncoder().encode(canonicalPayload);
  const digest = await subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Construit une entrée de journal avec hash chaîné.
 * `previousIntegrityHash` = hash de l'entrée précédente, ou chaîne vide pour la genesis.
 */
export async function buildLegalComplianceLogEntry(
  params: Omit<LegalComplianceLogEntry, 'integrityHash' | 'entryId'> & {
    entryId: string;
    previousIntegrityHash?: string;
  }
): Promise<LegalComplianceLogEntry> {
  const { entryId, previousIntegrityHash = '', ...rest } = params;
  const payload = buildLegalComplianceLogHashInput(rest, previousIntegrityHash);
  const integrityHash = await computeLegalComplianceLogIntegrityHash(payload);
  return { entryId, ...rest, integrityHash };
}

/** Applique le verrou WORM sur un brouillon de document Vault (transition métier). */
export function applyLegalVaultWormLock(
  draft: LegalVaultDocument,
  lockedAtMillis: number = Date.now()
): LegalVaultDocument {
  if (draft.isFinalWormLocked) {
    return draft;
  }
  return {
    ...draft,
    isFinalWormLocked: true,
    lockedAtMillis,
  };
}

/** Valide la structure minimale d'un document Vault avant persistance. */
export function validateLegalVaultDocument(
  doc: LegalVaultDocument | null | undefined
): { ok: true } | { ok: false; issues: string[] } {
  if (!doc) {
    return { ok: false, issues: ['document Vault absent'] };
  }
  const issues: string[] = [];
  if (!doc.documentId?.trim()) issues.push('documentId requis');
  if (!LEGAL_VAULT_DOCUMENT_TYPES.includes(doc.documentType)) {
    issues.push('documentType invalide');
  }
  if (!doc.storageUrl?.trim()) issues.push('storageUrl requis');
  if (!doc.brokerId?.trim()) issues.push('brokerId requis');
  if (!doc.orgId?.trim()) issues.push('orgId requis');
  if (!Number.isFinite(doc.createdAtMillis) || doc.createdAtMillis <= 0) {
    issues.push('createdAtMillis invalide');
  }
  if (
    !Number.isFinite(doc.oaciqRetentionExpiryTimestamp) ||
    doc.oaciqRetentionExpiryTimestamp <= doc.createdAtMillis
  ) {
    issues.push('oaciqRetentionExpiryTimestamp invalide (attendu > createdAtMillis)');
  }
  const meta = doc.metadataFieldsCrossChecked;
  if (!meta?.validatedLicenseName?.trim()) issues.push('validatedLicenseName requis');
  if (!meta?.licenseType?.trim()) issues.push('licenseType requis');
  if (!Number.isFinite(meta?.contractPrice) || meta.contractPrice < 0) {
    issues.push('contractPrice invalide');
  }
  if (doc.isFinalWormLocked && (!doc.lockedAtMillis || doc.lockedAtMillis <= 0)) {
    issues.push('lockedAtMillis requis lorsque isFinalWormLocked est true');
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
