/**
 * Modèle Contact CRM — organizations/{orgId}/contacts
 *
 * Silos de confidentialité (PO 2026-05) + LCI minimale (nom obligatoire ; reste optionnel).
 * occupationProfession ≠ taux d’occupation immeuble (résidence).
 */

import type { ContactLegalVerification } from '../identity/contacts';

/** Silo métier courtier (3 silos validés). */
export const CONTACT_SILOS = ['RESIDENTIEL', 'RES_COM', 'COMMERCIAL_SPEC'] as const;
export type ContactSilo = (typeof CONTACT_SILOS)[number];

/** Niche commerciale lorsque silo = COMMERCIAL_SPEC (RPA, multiplex, CPE). */
export const CONTACT_ASSET_NICHES = ['RPA', 'PLEX', 'CPE'] as const;
export type ContactAssetNiche = (typeof CONTACT_ASSET_NICHES)[number];

export const CONTACT_VISIBILITY = ['PRIVATE', 'AGENCY_SHARED'] as const;
export type ContactVisibility = (typeof CONTACT_VISIBILITY)[number];

export const CONTACT_LEAD_SOURCES = [
  'AGENCY_AD',
  'BROKER_GENERATED',
  'REFERRAL',
  'IMPORT_LEGACY',
  'OTHER',
] as const;
export type ContactLeadSource = (typeof CONTACT_LEAD_SOURCES)[number];

/** Rôles relationnels affichés (typologies legacy Copilote). */
export const CONTACT_RELATION_ROLES = [
  'buyer',
  'seller',
  'professional',
  'broker',
  'former_owner',
  'blacklist',
] as const;
export type ContactRelationRole = (typeof CONTACT_RELATION_ROLES)[number];

/** Typologies CRM spécialisées RPA (phase 1). */
export const CONTACT_RPA_TYPOLOGIES = [
  'vendeur_proprietaire',
  'acheteur_investisseur',
  'groupe_rpa',
  'notaire',
  'avocat',
  'courtier_collaborateur',
] as const;
export type ContactRpaTypology = (typeof CONTACT_RPA_TYPOLOGIES)[number];

/** Liaison relationnelle cartographiée entre deux contacts CRM. */
export interface ContactRelationLink {
  contactId: string;
  type: string;
  notes?: string;
}

/** Spécialisation professionnelle (fiche contact `professional`). */
export const PROFESSIONAL_TYPES = [
  'NOTARY',
  'LAWYER',
  'MORTGAGE_BROKER',
  'BANK_REP_DDH',
  'APPRAISER',
  'TAX_SPECIALIST',
  'ACCOUNTANT',
] as const;
export type ProfessionalType = (typeof PROFESSIONAL_TYPES)[number];

/** Critères fiche contact avec rôle courtier (`broker`). */
export interface ContactBrokerCriteria {
  /** Nom de l’agence immobilière. */
  agencyName?: string;
  /** Acheteurs sous la responsabilité de ce courtier (`contactId` acheteur). */
  managedBuyerIds?: string[];
}

/** Liaisons transactionnelles RPA (SSOT CRM, sans sous-collection parallèle). */
export interface ContactTransactionLinks {
  /** Covendeurs liés au dossier (`contactId`). */
  coSellerIds?: string[];
  /** Notaires externes liés (`contactId`). */
  notaryIds?: string[];
  /** Avocats externes liés (`contactId`). */
  lawyerIds?: string[];
  /** Courtiers collaborateurs liés (`contactId`). */
  collaboratorBrokerIds?: string[];
}

/** Pipeline acheteur qualifié — état sur la fiche contact (pas de collection `buyerPipeline`). */
export const BUYER_QUALIFICATION_STATUSES = [
  'PENDING_NDA',
  'NDA_SIGNED',
  'FUNDS_VERIFIED',
  'QUALIFIED',
] as const;
export type BuyerQualificationStatus = (typeof BUYER_QUALIFICATION_STATUSES)[number];

/** Typologie commerciale dérivée (non éditable manuellement). */
export const BUYER_COMMERCIAL_TIERS = ['PRIVILEGED', 'QUALIFIED'] as const;
export type BuyerCommercialTier = (typeof BUYER_COMMERCIAL_TIERS)[number];

/** Types de résidence visés (formulaire web rpaavendre.com). */
export const BUYER_TARGET_RESIDENCE_TYPES = ['RPA', 'RI', 'CHSLD'] as const;
export type BuyerTargetResidenceType = (typeof BUYER_TARGET_RESIDENCE_TYPES)[number];

/** Échéanciers d’acquisition (formulaire web — libellés stockés tels quels). */
export const BUYER_ACQUISITION_TIMELINES = [
  'IMMEDIATE',
  '0_3_MONTHS',
  '3_6_MONTHS',
  '6_12_MONTHS',
  '12_PLUS',
] as const;
export type BuyerAcquisitionTimeline = (typeof BUYER_ACQUISITION_TIMELINES)[number];

/** Préférences de communication — Loi 25 / LCAP (consentements et exclusions). */
export interface ContactCommunicationPreferences {
  unsubscribedFromEmails: boolean;
  excludedFromMassMailing: boolean;
}

/** Référence Firebase Storage d’une pièce justificative (acheteur / vendeur). */
export interface ContactCriteriaDocumentRef {
  url: string;
  storagePath: string;
  uploadedAt?: string;
}

/** @deprecated Alias — utiliser `ContactCriteriaDocumentRef`. */
export type BuyerCriteriaDocumentRef = ContactCriteriaDocumentRef;

/** Mandataire d’une compagnie (Inc.) — NEQ et fiche REQ. */
export interface ContactCorporateMandate {
  /** Le contact agit comme mandataire d’une personne morale. */
  isMandatory: boolean;
  companyName: string;
  /** Numéro d’entreprise du Québec (NEQ). */
  reqNumber: string;
  reqFile?: ContactCriteriaDocumentRef;
}

/** Pièces justificatives vendeur (mandat de vente). */
export interface ContactSellerCriteria {
  /** Contrat de courtage immobilier. */
  brokerageContractFile?: ContactCriteriaDocumentRef;
  /** Titre de propriété. */
  ownershipProofFile?: ContactCriteriaDocumentRef;
  /** Déclaration du vendeur. */
  sellerDeclarationFile?: ContactCriteriaDocumentRef;
  /** Mandataire d’une compagnie (Inc.) + fiche REQ. */
  corporateMandate?: ContactCorporateMandate;
}

export interface ContactBuyerCriteria {
  /** Budget maximal d’acquisition ($). */
  budgetMax?: number;
  /** Régions ou marchés visés (libellés courtier). */
  regions?: string[];
  /** Taux de capitalisation (TGA) minimum acceptable (%). */
  tgaMinimum?: number;
  /** Entente de confidentialité signée (NDA) — fichier téléversé. */
  ndaFile?: BuyerCriteriaDocumentRef;
  /** Preuve de mise de fonds — fichier téléversé. */
  proofOfFundsFile?: BuyerCriteriaDocumentRef;
  /** Lettre bancaire — fichier téléversé. */
  bankLetterFile?: BuyerCriteriaDocumentRef;
  /** Préapprobation hypothécaire — fichier téléversé. */
  mortgagePreApprovalFile?: BuyerCriteriaDocumentRef;
  /** Mandataire d’une compagnie (Inc.) + fiche REQ. */
  corporateMandate?: ContactCorporateMandate;
  /** @deprecated Import legacy — préférer `ndaFile` et téléversements Storage. */
  hasNdaSigned?: boolean;
  /** @deprecated Import legacy — préférer `proofOfFundsFile`. */
  hasProofOfFunds?: boolean;
  /** @deprecated Import legacy — préférer `bankLetterFile`. */
  hasBankLetter?: boolean;
  /** @deprecated Import legacy — préférer `mortgagePreApprovalFile`. */
  hasMortgagePreApproval?: boolean;
  /** Types de résidence recherchés (RPA, RI, CHSLD). */
  residenceTypes?: BuyerTargetResidenceType[];
  /** Nombre d’unités minimum visé. */
  unitsMin?: number;
  /** Nombre d’unités maximum visé. */
  unitsMax?: number;
  /** Expérience en gestion immobilière (texte libre, formulaire web). */
  experienceDescription?: string;
  /** Déjà accompagné par un courtier immobilier. */
  hasBroker?: boolean;
  /** Échéancier d’acquisition (libellé formulaire web). */
  timeline?: string;
  /** Mise de fonds déclarée ($). */
  downpaymentAmount?: number;
}

export interface BuyerTierInput {
  relationRoles?: readonly ContactRelationRole[];
  buyerCriteria?: ContactBuyerCriteria;
}

export interface ContactAddress {
  ligne1: string;
  ligne2?: string;
  ville: string;
  province: string;
  codePostal: string;
}

/** Document Firestore `organizations/{orgId}/contacts/{contactId}`. */
export interface OrganizationContact {
  id: string;
  orgId: string;
  /** Courtier propriétaire du contact (cloison par défaut). */
  ownerId: string;
  silo: ContactSilo;
  /** Requis si silo === COMMERCIAL_SPEC — détermine le partage agence (RPA). */
  assetNiche?: ContactAssetNiche;
  visibility: ContactVisibility;
  leadSource: ContactLeadSource;
  /** LCI — nom complet ou composé via prenom + nom (seul champ obligatoire à la création) */
  nom: string;
  prenom?: string;
  /** Raison sociale / groupe d'investissement (recherche CRM). */
  entreprise?: string;
  /** Optionnel — saisie rapide prospect sans adresse complète */
  adresse?: ContactAddress;
  /** ISO 8601 date (yyyy-mm-dd) — optionnel */
  dateNaissance?: string;
  /** Métier / occupation de la partie — optionnel ; ≠ taux d’occupation immeuble */
  occupationProfession?: string;
  relationRoles?: ContactRelationRole[];
  /** Typologies métier RPA (classification opérationnelle). */
  rpaTypologies?: ContactRpaTypology[];
  email?: string;
  telephone?: string;
  /** Relations cartographiées bidirectionnelles (écrites via writeBatch). */
  relations?: ContactRelationLink[];
  residenceIds?: string[];
  /** Coacheteurs liés (`contactId` dans la même organisation). */
  coBuyerIds?: string[];
  /** Covendeurs liés (`contactId` dans la même organisation). */
  coSellerIds?: string[];
  /** Notaires liés à la transaction (`contactId`). */
  notaryIds?: string[];
  /** Avocats liés à la transaction (`contactId`). */
  lawyerIds?: string[];
  /** Courtiers collaborateurs liés à la transaction (`contactId`). */
  collaboratorBrokerIds?: string[];
  /**
   * Qualification acheteur (null / absent = non renseigné).
   * Remplace le pipeline Firestore legacy sans dupliquer la fiche.
   */
  buyerQualificationStatus?: BuyerQualificationStatus | null;
  /** Niveau commercial dérivé via `deriveBuyerTier()` pour les typologies RPA acheteur. */
  buyerCommercialTier?: BuyerCommercialTier | null;
  buyerCriteria?: ContactBuyerCriteria;
  sellerCriteria?: ContactSellerCriteria;
  /** Agence et acheteurs gérés — rôle `broker`. */
  brokerCriteria?: ContactBrokerCriteria;
  /** Spécialisation — rôle `professional`. */
  professionalType?: ProfessionalType;
  /** Consentements et exclusions courriel (Loi 25 / LCAP). */
  communicationPreferences?: ContactCommunicationPreferences;
  notes?: string;
  /** Registre OACIQ art. 30 — vérification identité / sollicitation. */
  legalVerification?: ContactLegalVerification;
  /** Métadonnées import legacy — complétion LCI requise si `lciIncomplete`. */
  importMeta?: ContactImportMeta;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactImportMeta {
  legacySources?: Array<{ collection: string; id: string }>;
  mergedCount?: number;
  lciIncomplete?: boolean;
  missingLciFields?: ContactLciFieldKey[];
}

export type ContactLciFieldKey =
  | 'nom'
  | 'adresse'
  | 'dateNaissance'
  | 'occupationProfession';

export interface ContactLciValidationResult {
  ok: boolean;
  missing: ContactLciFieldKey[];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidAddress(addr: unknown): boolean {
  if (!addr || typeof addr !== 'object') return false;
  const a = addr as ContactAddress;
  return (
    isNonEmptyString(a.ligne1) &&
    isNonEmptyString(a.ville) &&
    isNonEmptyString(a.codePostal)
  );
}

const LCI_PLACEHOLDER_DATE = '0000-00-00';
const LCI_PLACEHOLDER_OCCUPATION = 'À compléter (import legacy)';
const LCI_PLACEHOLDER_ADDR_LINE = 'À compléter (import legacy)';
const LCI_PLACEHOLDER_CITY = 'Non renseigné';
const LCI_PLACEHOLDER_POSTAL = 'H0H 0H0';

function isPlaceholderDateNaissance(v: unknown): boolean {
  if (!isNonEmptyString(v)) return true;
  return v === LCI_PLACEHOLDER_DATE || v.startsWith('0000-');
}

function isPlaceholderOccupation(v: unknown): boolean {
  if (!isNonEmptyString(v)) return true;
  return v === LCI_PLACEHOLDER_OCCUPATION;
}

function isPlaceholderAddress(addr: unknown): boolean {
  if (!isValidAddress(addr)) return true;
  const a = addr as ContactAddress;
  return (
    a.ligne1 === LCI_PLACEHOLDER_ADDR_LINE ||
    a.ville === LCI_PLACEHOLDER_CITY ||
    a.codePostal === LCI_PLACEHOLDER_POSTAL
  );
}

/** Normalise l’adresse pour persistance (omise si entièrement vide). */
export function normalizeContactAddressForWrite(
  adresse?: Partial<ContactAddress> | null
): ContactAddress | undefined {
  if (!adresse || typeof adresse !== 'object') return undefined;
  const ligne1 = typeof adresse.ligne1 === 'string' ? adresse.ligne1.trim() : '';
  const ville = typeof adresse.ville === 'string' ? adresse.ville.trim() : '';
  const codePostal = typeof adresse.codePostal === 'string' ? adresse.codePostal.trim() : '';
  const province =
    typeof adresse.province === 'string' && adresse.province.trim()
      ? adresse.province.trim()
      : 'QC';
  if (!ligne1 && !ville && !codePostal) return undefined;
  return { ligne1, ville, codePostal, province };
}

function normalizeOptionalLciString(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  return v.length > 0 ? v : undefined;
}

/**
 * Champs LCI secondaires manquants (indicateur UI / import legacy) — ne bloque pas la persistance.
 */
export function getContactLciSecondaryGaps(
  contact: Partial<OrganizationContact>
): ContactLciFieldKey[] {
  const missing: ContactLciFieldKey[] = [];
  if (isPlaceholderAddress(contact.adresse)) missing.push('adresse');
  if (isPlaceholderDateNaissance(contact.dateNaissance)) missing.push('dateNaissance');
  if (isPlaceholderOccupation(contact.occupationProfession)) missing.push('occupationProfession');
  return missing;
}

/** Valide le minimum LCI avant persistance — nom seul obligatoire (création rapide prospect). */
export function validateContactLciFields(
  contact: Partial<OrganizationContact>
): ContactLciValidationResult {
  const missing: ContactLciFieldKey[] = [];
  if (!isNonEmptyString(contact.nom)) missing.push('nom');
  return { ok: missing.length === 0, missing };
}

export function parseContactImportMeta(raw: unknown): ContactImportMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const missingLciFields = Array.isArray(o.missingLciFields)
    ? o.missingLciFields.filter((k): k is ContactLciFieldKey =>
        ['nom', 'adresse', 'dateNaissance', 'occupationProfession'].includes(String(k))
      )
    : undefined;
  return {
    legacySources: Array.isArray(o.legacySources)
      ? o.legacySources.map((s) => {
          const row = s as Record<string, unknown>;
          return { collection: String(row.collection ?? ''), id: String(row.id ?? '') };
        })
      : undefined,
    mergedCount: typeof o.mergedCount === 'number' ? o.mergedCount : undefined,
    lciIncomplete: o.lciIncomplete === true,
    missingLciFields,
  };
}

/**
 * Partage agence autorisé uniquement pour le silo RPA (niche COMMERCIAL_SPEC).
 */
export function isAgencyShareAllowedForContact(
  silo: ContactSilo,
  assetNiche?: ContactAssetNiche
): boolean {
  return silo === 'COMMERCIAL_SPEC' && assetNiche === 'RPA';
}

/** Silo par défaut à la création selon les rôles (courtier → résidentiel). */
export function defaultContactSiloForRoles(
  relationRoles?: readonly ContactRelationRole[],
  explicitSilo?: ContactSilo
): ContactSilo {
  if (explicitSilo) return explicitSilo;
  if (relationRoles?.includes('broker')) return 'RESIDENTIEL';
  return 'RESIDENTIEL';
}

/** Visibilité par défaut à la création selon silo / niche. */
export function defaultContactVisibility(
  silo: ContactSilo,
  assetNiche?: ContactAssetNiche
): ContactVisibility {
  return isAgencyShareAllowedForContact(silo, assetNiche) ? 'AGENCY_SHARED' : 'PRIVATE';
}

/** Un lead publicitaire agence peut être réassigné par un admin. */
export function canAdminReassignContactOwner(leadSource: ContactLeadSource): boolean {
  return leadSource === 'AGENCY_AD';
}

function parseBuyerCriteriaBool(raw: unknown): boolean | undefined {
  if (raw === true) return true;
  if (raw === false) return false;
  return undefined;
}

function parseBuyerCriteriaNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const v = raw.trim().replace(/\s/g, '').replace(',', '.');
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseCriteriaDocumentRef(raw: unknown): ContactCriteriaDocumentRef | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  const storagePath = typeof o.storagePath === 'string' ? o.storagePath.trim() : '';
  if (!url || !storagePath) return undefined;
  const uploadedAt =
    typeof o.uploadedAt === 'string' && o.uploadedAt.trim() ? o.uploadedAt.trim() : undefined;
  return { url, storagePath, ...(uploadedAt ? { uploadedAt } : {}) };
}

/** Présence d’une pièce justificative (fichier ou indicateur legacy import). */
export function buyerCriteriaHasDocument(
  file: ContactCriteriaDocumentRef | undefined,
  legacyFlag?: boolean
): boolean {
  return !!file?.url?.trim() || legacyFlag === true;
}

/**
 * Typologie acheteur dérivée des pièces téléversées (entonnoir documentaire).
 * - Privilégié : entente de confidentialité (NDA) ET preuve financière.
 * - Qualifié : NDA OU preuve financière (exclusivement l’un ou l’autre).
 */
export function deriveBuyerTier(contact: BuyerTierInput): BuyerCommercialTier | null {
  if (!contact.relationRoles?.includes('buyer')) return null;
  const c = contact.buyerCriteria ?? {};
  const hasNDA = buyerCriteriaHasDocument(c.ndaFile, c.hasNdaSigned);
  const hasFinancialProof =
    buyerCriteriaHasDocument(c.proofOfFundsFile, c.hasProofOfFunds) ||
    buyerCriteriaHasDocument(c.bankLetterFile, c.hasBankLetter) ||
    buyerCriteriaHasDocument(c.mortgagePreApprovalFile, c.hasMortgagePreApproval);

  if (hasNDA && hasFinancialProof) return 'PRIVILEGED';
  if (hasNDA !== hasFinancialProof) return 'QUALIFIED';
  return null;
}

/** Vrai si la fiche appartient aux typologies RPA nécessitant la dérivation acheteur. */
export function requiresRpaBuyerTierDerivation(
  rpaTypologies: readonly ContactRpaTypology[] | undefined
): boolean {
  if (!rpaTypologies?.length) return false;
  return (
    rpaTypologies.includes('acheteur_investisseur') || rpaTypologies.includes('groupe_rpa')
  );
}

/**
 * Dérive le tier commercial acheteur pour les typologies RPA ciblées.
 * Force l'appel à `deriveBuyerTier()` avec un rôle `buyer` pour la logique documentaire.
 */
export function deriveRpaBuyerCommercialTier(input: {
  rpaTypologies?: readonly ContactRpaTypology[];
  relationRoles?: readonly ContactRelationRole[];
  buyerCriteria?: ContactBuyerCriteria;
}): BuyerCommercialTier | null {
  if (!requiresRpaBuyerTierDerivation(input.rpaTypologies)) return null;
  const relationRoles = input.relationRoles?.length
    ? input.relationRoles
    : (['buyer'] as const);
  const relationRolesWithBuyer = relationRoles.includes('buyer')
    ? relationRoles
    : ([...relationRoles, 'buyer'] as ContactRelationRole[]);
  return deriveBuyerTier({
    relationRoles: relationRolesWithBuyer,
    buyerCriteria: input.buyerCriteria,
  });
}

/** Map tier commercial dérivé -> statut pipeline acheteur persistant. */
export function mapBuyerTierToQualificationStatus(
  tier: BuyerCommercialTier | null
): BuyerQualificationStatus | null {
  if (!tier) return null;
  return 'QUALIFIED';
}

function parseBuyerQualificationStatus(raw: unknown): BuyerQualificationStatus | null | undefined {
  if (raw == null) return null;
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  return (BUYER_QUALIFICATION_STATUSES as readonly string[]).includes(v)
    ? (v as BuyerQualificationStatus)
    : undefined;
}

/** Normalise `buyerCriteria` depuis Firestore. */
export function parseContactBuyerCriteria(raw: unknown): ContactBuyerCriteria | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const out: ContactBuyerCriteria = {};
  if (typeof o.budgetMax === 'number' && Number.isFinite(o.budgetMax)) {
    out.budgetMax = o.budgetMax;
  }
  if (typeof o.tgaMinimum === 'number' && Number.isFinite(o.tgaMinimum)) {
    out.tgaMinimum = o.tgaMinimum;
  }
  if (Array.isArray(o.regions)) {
    const regions = o.regions
      .map((r) => (typeof r === 'string' ? r.trim() : ''))
      .filter(Boolean);
    if (regions.length) out.regions = regions;
  }
  const ndaFile = parseCriteriaDocumentRef(o.ndaFile);
  const proofOfFundsFile = parseCriteriaDocumentRef(o.proofOfFundsFile);
  const bankLetterFile = parseCriteriaDocumentRef(o.bankLetterFile);
  const mortgagePreApprovalFile = parseCriteriaDocumentRef(o.mortgagePreApprovalFile);
  if (ndaFile) out.ndaFile = ndaFile;
  if (proofOfFundsFile) out.proofOfFundsFile = proofOfFundsFile;
  if (bankLetterFile) out.bankLetterFile = bankLetterFile;
  if (mortgagePreApprovalFile) out.mortgagePreApprovalFile = mortgagePreApprovalFile;

  const hasNdaSigned = parseBuyerCriteriaBool(o.hasNdaSigned);
  const hasProofOfFunds = parseBuyerCriteriaBool(o.hasProofOfFunds);
  const hasBankLetter = parseBuyerCriteriaBool(o.hasBankLetter);
  const hasMortgagePreApproval = parseBuyerCriteriaBool(o.hasMortgagePreApproval);
  if (hasNdaSigned !== undefined) out.hasNdaSigned = hasNdaSigned;
  if (hasProofOfFunds !== undefined) out.hasProofOfFunds = hasProofOfFunds;
  if (hasBankLetter !== undefined) out.hasBankLetter = hasBankLetter;
  if (hasMortgagePreApproval !== undefined) out.hasMortgagePreApproval = hasMortgagePreApproval;

  if (o.corporateMandate && typeof o.corporateMandate === 'object') {
    const cm = o.corporateMandate as Record<string, unknown>;
    const companyName = typeof cm.companyName === 'string' ? cm.companyName.trim() : '';
    const reqNumber = typeof cm.reqNumber === 'string' ? cm.reqNumber.trim() : '';
    const reqFile = parseCriteriaDocumentRef(cm.reqFile);
    out.corporateMandate = {
      isMandatory: cm.isMandatory === true,
      companyName,
      reqNumber,
      ...(reqFile ? { reqFile } : {}),
    };
  }

  if (Array.isArray(o.residenceTypes)) {
    const residenceTypes = o.residenceTypes
      .map((r) => (typeof r === 'string' ? r.trim().toUpperCase() : ''))
      .filter((r): r is BuyerTargetResidenceType =>
        (BUYER_TARGET_RESIDENCE_TYPES as readonly string[]).includes(r)
      );
    if (residenceTypes.length) out.residenceTypes = [...new Set(residenceTypes)];
  }
  const unitsMin = parseBuyerCriteriaNumber(o.unitsMin);
  const unitsMax = parseBuyerCriteriaNumber(o.unitsMax);
  if (unitsMin !== undefined && unitsMin >= 0) out.unitsMin = unitsMin;
  if (unitsMax !== undefined && unitsMax >= 0) out.unitsMax = unitsMax;
  if (typeof o.experienceDescription === 'string' && o.experienceDescription.trim()) {
    out.experienceDescription = o.experienceDescription.trim();
  }
  const hasBroker = parseBuyerCriteriaBool(o.hasBroker);
  if (hasBroker !== undefined) out.hasBroker = hasBroker;
  if (typeof o.timeline === 'string' && o.timeline.trim()) {
    out.timeline = o.timeline.trim();
  }
  const downpaymentAmount = parseBuyerCriteriaNumber(o.downpaymentAmount);
  if (downpaymentAmount !== undefined && downpaymentAmount >= 0) {
    out.downpaymentAmount = downpaymentAmount;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** Lit un tableau d’IDs de contacts partenaires (coacheteurs / covendeurs). */
export function parseContactPartnerIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean);
  return ids.length ? [...new Set(ids)] : undefined;
}

/** Lit les liaisons transactionnelles RPA depuis un document contact. */
export function parseContactTransactionRoleFields(data: Record<string, unknown>): {
  coSellerIds?: string[];
  notaryIds?: string[];
  lawyerIds?: string[];
  collaboratorBrokerIds?: string[];
} {
  const coSellerIds = parseContactPartnerIds(data.coSellerIds);
  const notaryIds = parseContactPartnerIds(data.notaryIds ?? data.notaryId);
  const lawyerIds = parseContactPartnerIds(data.lawyerIds ?? data.lawyerId);
  const collaboratorBrokerIds = parseContactPartnerIds(
    data.collaboratorBrokerIds ?? data.collaboratorBrokerId
  );
  return {
    ...(coSellerIds ? { coSellerIds } : {}),
    ...(notaryIds ? { notaryIds } : {}),
    ...(lawyerIds ? { lawyerIds } : {}),
    ...(collaboratorBrokerIds ? { collaboratorBrokerIds } : {}),
  };
}

/** Lit typologies RPA depuis un document contact. */
export function parseContactRpaTypologies(raw: unknown): ContactRpaTypology[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rows = raw
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v): v is ContactRpaTypology =>
      (CONTACT_RPA_TYPOLOGIES as readonly string[]).includes(v)
    );
  return rows.length ? [...new Set(rows)] : undefined;
}

/** Lit relations cartographiées depuis Firestore. */
export function parseContactRelations(raw: unknown): ContactRelationLink[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ContactRelationLink[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const contactId = typeof o.contactId === 'string' ? o.contactId.trim() : '';
    const type = typeof o.type === 'string' ? o.type.trim() : '';
    const notes = typeof o.notes === 'string' && o.notes.trim() ? o.notes.trim() : undefined;
    if (!contactId || !type) continue;
    out.push({ contactId, type, ...(notes ? { notes } : {}) });
  }
  if (!out.length) return undefined;
  const dedup = new Map<string, ContactRelationLink>();
  for (const rel of out) {
    dedup.set(`${rel.contactId}::${rel.type.toLowerCase()}`, rel);
  }
  return Array.from(dedup.values());
}

/** Normalise et ajoute une relation cartographiée (sans duplication contactId+type). */
export function syncAddContactRelation(
  relations: readonly ContactRelationLink[] | undefined,
  link: ContactRelationLink
): ContactRelationLink[] {
  const contactId = link.contactId.trim();
  const type = link.type.trim();
  const notes = link.notes?.trim();
  if (!contactId || !type) return [...(relations ?? [])];
  const key = `${contactId}::${type.toLowerCase()}`;
  const map = new Map<string, ContactRelationLink>();
  for (const rel of relations ?? []) {
    if (!rel.contactId?.trim() || !rel.type?.trim()) continue;
    map.set(`${rel.contactId.trim()}::${rel.type.trim().toLowerCase()}`, {
      contactId: rel.contactId.trim(),
      type: rel.type.trim(),
      ...(rel.notes?.trim() ? { notes: rel.notes.trim() } : {}),
    });
  }
  map.set(key, { contactId, type, ...(notes ? { notes } : {}) });
  return Array.from(map.values());
}

/** Retire une relation cartographiée (clé composite contactId+type). */
export function syncRemoveContactRelation(
  relations: readonly ContactRelationLink[] | undefined,
  target: { contactId: string; type: string }
): ContactRelationLink[] {
  const contactId = target.contactId.trim();
  const type = target.type.trim().toLowerCase();
  if (!contactId || !type) return [...(relations ?? [])];
  return (relations ?? []).filter(
    (rel) =>
      !(
        rel.contactId?.trim() === contactId &&
        rel.type?.trim().toLowerCase() === type
      )
  );
}

/** @deprecated Alias — `parseContactPartnerIds`. */
export const parseContactCoBuyerIds = parseContactPartnerIds;

/** Normalise `sellerCriteria` depuis Firestore. */
export function parseContactSellerCriteria(raw: unknown): ContactSellerCriteria | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const out: ContactSellerCriteria = {};
  const brokerageContractFile = parseCriteriaDocumentRef(o.brokerageContractFile);
  const ownershipProofFile = parseCriteriaDocumentRef(o.ownershipProofFile);
  const sellerDeclarationFile = parseCriteriaDocumentRef(o.sellerDeclarationFile);
  if (brokerageContractFile) out.brokerageContractFile = brokerageContractFile;
  if (ownershipProofFile) out.ownershipProofFile = ownershipProofFile;
  if (sellerDeclarationFile) out.sellerDeclarationFile = sellerDeclarationFile;
  if (o.corporateMandate && typeof o.corporateMandate === 'object') {
    const cm = o.corporateMandate as Record<string, unknown>;
    const companyName = typeof cm.companyName === 'string' ? cm.companyName.trim() : '';
    const reqNumber = typeof cm.reqNumber === 'string' ? cm.reqNumber.trim() : '';
    const reqFile = parseCriteriaDocumentRef(cm.reqFile);
    out.corporateMandate = {
      isMandatory: cm.isMandatory === true,
      companyName,
      reqNumber,
      ...(reqFile ? { reqFile } : {}),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseProfessionalType(raw: unknown): ProfessionalType | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  return (PROFESSIONAL_TYPES as readonly string[]).includes(v)
    ? (v as ProfessionalType)
    : undefined;
}

/** Normalise `brokerCriteria` depuis Firestore. */
export function parseContactBrokerCriteria(raw: unknown): ContactBrokerCriteria | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const out: ContactBrokerCriteria = {};
  if (typeof o.agencyName === 'string' && o.agencyName.trim()) {
    out.agencyName = o.agencyName.trim();
  }
  const managedBuyerIds = parseContactPartnerIds(o.managedBuyerIds);
  if (managedBuyerIds?.length) out.managedBuyerIds = managedBuyerIds;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Lit critères courtier + acheteurs gérés depuis un document contact. */
export function parseContactBrokerFields(data: Record<string, unknown>): {
  brokerCriteria?: ContactBrokerCriteria;
} {
  const brokerCriteria = parseContactBrokerCriteria(data.brokerCriteria);
  return brokerCriteria ? { brokerCriteria } : {};
}

/** Lit critères vendeur + covendeurs depuis un document contact. */
export function parseContactSellerFields(data: Record<string, unknown>): {
  sellerCriteria?: ContactSellerCriteria;
  coSellerIds?: string[];
} {
  const sellerCriteria = parseContactSellerCriteria(data.sellerCriteria);
  const coSellerIds = parseContactPartnerIds(data.coSellerIds);
  return {
    ...(sellerCriteria ? { sellerCriteria } : {}),
    ...(coSellerIds ? { coSellerIds } : {}),
  };
}

/** Lit qualification + critères acheteur depuis un document contact. */
export function parseContactBuyerFields(data: Record<string, unknown>): {
  buyerQualificationStatus?: BuyerQualificationStatus | null;
  buyerCommercialTier?: BuyerCommercialTier | null;
  buyerCriteria?: ContactBuyerCriteria;
  coBuyerIds?: string[];
} {
  const status = parseBuyerQualificationStatus(data.buyerQualificationStatus);
  const tier =
    typeof data.buyerCommercialTier === 'string' &&
    (BUYER_COMMERCIAL_TIERS as readonly string[]).includes(data.buyerCommercialTier)
      ? (data.buyerCommercialTier as BuyerCommercialTier)
      : data.buyerCommercialTier === null
        ? null
        : undefined;
  const criteria = parseContactBuyerCriteria(data.buyerCriteria);
  const coBuyerIds = parseContactPartnerIds(data.coBuyerIds);
  return {
    ...(status !== undefined ? { buyerQualificationStatus: status } : {}),
    ...(tier !== undefined ? { buyerCommercialTier: tier } : {}),
    ...(criteria ? { buyerCriteria: criteria } : {}),
    ...(coBuyerIds ? { coBuyerIds } : {}),
  };
}

/** Lit `professionalType` depuis un document contact. */
export function parseContactProfessionalFields(data: Record<string, unknown>): {
  professionalType?: ProfessionalType;
} {
  const professionalType = parseProfessionalType(data.professionalType);
  return professionalType ? { professionalType } : {};
}

/** Lit typologies et relations RPA depuis un document contact. */
export function parseContactRpaFields(data: Record<string, unknown>): {
  rpaTypologies?: ContactRpaTypology[];
  relations?: ContactRelationLink[];
} {
  const rpaTypologies = parseContactRpaTypologies(data.rpaTypologies);
  const relations = parseContactRelations(data.relations);
  return {
    ...(rpaTypologies ? { rpaTypologies } : {}),
    ...(relations ? { relations } : {}),
  };
}
