/**
 * Registre de vérification légale — contacts CRM (OACIQ art. 30 / LCI).
 *
 * SSOT conformité identité : champs LCI (crm) + objet `legalVerification`.
 */

import {
  validateContactLciFields,
  type ContactLciFieldKey,
  type ContactLciValidationResult,
  type OrganizationContact,
} from '../crm/contactTypes';

export const CONTACT_VERIFICATION_MODES = ['EN_PERSONNE', 'A_DISTANCE'] as const;
export type ContactVerificationMode = (typeof CONTACT_VERIFICATION_MODES)[number];

/** Vérification sollicitation — exclusivité ailleurs (art. 30). */
export const CONTACT_SOLICITATION_STATUTS = [
  'NON_VERIFIE',
  'AUCUNE_EXCLUSIVITE_AILLEURS',
  'EXCLUSIVITE_AILLEURS',
] as const;
export type ContactSolicitationStatut = (typeof CONTACT_SOLICITATION_STATUTS)[number];

export interface ContactLegalVerification {
  verificationMode?: ContactVerificationMode;
  /** URL Firebase Storage (preuve ID à distance). */
  idDocumentUrl?: string;
  idDocumentStoragePath?: string;
  capaciteJuridiqueValidee?: boolean;
  statutSollicitation?: ContactSolicitationStatut;
  verifiedAt?: string;
  verifiedByUid?: string;
}

export type ContactLegalMissingKey =
  | ContactLciFieldKey
  | 'verificationMode'
  | 'idDocumentUrl'
  | 'capaciteJuridiqueValidee'
  | 'statutSollicitation';

export type ContactLegalComplianceStatus = 'incomplete' | 'conform';

export interface ContactLegalComplianceResult {
  status: ContactLegalComplianceStatus;
  lci: ContactLciValidationResult;
  missing: ContactLegalMissingKey[];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Nom complet affiché (prénom + nom). */
export function buildContactFullName(contact: Pick<OrganizationContact, 'nom' | 'prenom'>): string {
  const prenom = contact.prenom?.trim();
  const nom = contact.nom?.trim() ?? '';
  if (prenom && nom) return `${prenom} ${nom}`;
  return nom || prenom || '';
}

/**
 * Chemin Storage tenant — preuves d'identité contact.
 * `primexpert/{orgId}/contacts/{contactId}/id_proofs/`
 */
export function buildContactIdProofStoragePath(
  orgId: string,
  contactId: string,
  fileName: string
): string {
  const safeName = fileName.replace(/[^\w.\-]/g, '_');
  const stamp = Date.now();
  return `primexpert/${orgId}/contacts/${contactId}/id_proofs/${stamp}-${safeName}`;
}

/** Types de pièces acheteur / REQ — chemin `buyer_documents/{kind}/`. */
export type ContactBuyerDocumentKind =
  | 'nda'
  | 'proof_of_funds'
  | 'bank_letter'
  | 'mortgage_pre_approval'
  | 'req';

export function buildContactBuyerDocumentStoragePath(
  orgId: string,
  contactId: string,
  kind: ContactBuyerDocumentKind,
  fileName: string
): string {
  const safeName = fileName.replace(/[^\w.\-]/g, '_');
  const stamp = Date.now();
  return `primexpert/${orgId}/contacts/${contactId}/buyer_documents/${kind}/${stamp}-${safeName}`;
}

/** Types de pièces vendeur / REQ — chemin `seller_documents/{kind}/`. */
export type ContactSellerDocumentKind =
  | 'brokerage_contract'
  | 'ownership_proof'
  | 'seller_declaration'
  | 'req';

export function buildContactSellerDocumentStoragePath(
  orgId: string,
  contactId: string,
  kind: ContactSellerDocumentKind,
  fileName: string
): string {
  const safeName = fileName.replace(/[^\w.\-]/g, '_');
  const stamp = Date.now();
  return `primexpert/${orgId}/contacts/${contactId}/seller_documents/${kind}/${stamp}-${safeName}`;
}

function parseLegalVerification(raw: unknown): ContactLegalVerification | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const mode = o.verificationMode;
  const verificationMode =
    mode === 'EN_PERSONNE' || mode === 'A_DISTANCE' ? mode : undefined;
  const stat = o.statutSollicitation;
  const statutSollicitation = CONTACT_SOLICITATION_STATUTS.includes(
    stat as ContactSolicitationStatut
  )
    ? (stat as ContactSolicitationStatut)
    : undefined;
  return {
    verificationMode,
    idDocumentUrl: isNonEmptyString(o.idDocumentUrl) ? o.idDocumentUrl.trim() : undefined,
    idDocumentStoragePath: isNonEmptyString(o.idDocumentStoragePath)
      ? o.idDocumentStoragePath.trim()
      : undefined,
    capaciteJuridiqueValidee:
      typeof o.capaciteJuridiqueValidee === 'boolean' ? o.capaciteJuridiqueValidee : undefined,
    statutSollicitation,
    verifiedAt: isNonEmptyString(o.verifiedAt) ? o.verifiedAt.trim() : undefined,
    verifiedByUid: isNonEmptyString(o.verifiedByUid) ? o.verifiedByUid.trim() : undefined,
  };
}

export function normalizeContactLegalVerification(
  raw: unknown
): ContactLegalVerification | undefined {
  return parseLegalVerification(raw);
}

/** Valide le bloc legalVerification (mode, preuve ID, capacité, sollicitation). */
export function validateContactLegalVerificationBlock(
  legal: ContactLegalVerification | undefined
): { ok: boolean; missing: Exclude<ContactLegalMissingKey, ContactLciFieldKey>[] } {
  const missing: Exclude<ContactLegalMissingKey, ContactLciFieldKey>[] = [];
  if (!legal?.verificationMode) missing.push('verificationMode');
  if (legal?.verificationMode === 'A_DISTANCE' && !isNonEmptyString(legal.idDocumentUrl)) {
    missing.push('idDocumentUrl');
  }
  if (legal?.capaciteJuridiqueValidee !== true) missing.push('capaciteJuridiqueValidee');
  if (legal?.statutSollicitation !== 'AUCUNE_EXCLUSIVITE_AILLEURS') {
    missing.push('statutSollicitation');
  }
  return { ok: missing.length === 0, missing };
}

/**
 * État de conformité global — LCI (4 champs) + registre legalVerification.
 */
export function resolveContactLegalCompliance(
  contact: Partial<OrganizationContact>
): ContactLegalComplianceResult {
  const lci = validateContactLciFields(contact);
  const legal = validateContactLegalVerificationBlock(contact.legalVerification);
  const missing: ContactLegalMissingKey[] = [
    ...lci.missing,
    ...legal.missing,
  ];
  const status: ContactLegalComplianceStatus =
    lci.ok && legal.ok ? 'conform' : 'incomplete';
  return { status, lci, missing };
}

/** Alias explicite pour l’en-tête UI. */
export function isContactLegallyConform(contact: Partial<OrganizationContact>): boolean {
  return resolveContactLegalCompliance(contact).status === 'conform';
}

export const CONTACT_LEGAL_FIELD_LABEL_FR: Record<ContactLegalMissingKey, string> = {
  nom: 'Nom complet',
  adresse: 'Adresse résidentielle',
  dateNaissance: 'Date de naissance',
  occupationProfession: 'Occupation',
  verificationMode: 'Mode de vérification',
  idDocumentUrl: 'Pièce d’identité (à distance)',
  capaciteJuridiqueValidee: 'Capacité juridique',
  statutSollicitation: 'Statut de sollicitation',
};

export const CONTACT_LEGAL_FIELD_LABEL_EN: Record<ContactLegalMissingKey, string> = {
  nom: 'Full legal name',
  adresse: 'Residential address',
  dateNaissance: 'Date of birth',
  occupationProfession: 'Occupation',
  verificationMode: 'Verification mode',
  idDocumentUrl: 'ID document (remote)',
  capaciteJuridiqueValidee: 'Legal capacity',
  statutSollicitation: 'Solicitation status',
};
