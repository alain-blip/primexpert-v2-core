/**
 * Import contacts legacy (Copilote `contacts/` + `vendors/`) → V2 `OrganizationContact`.
 * Logique pure — exécution Firestore dans scripts/migrate-legacy-contacts-to-v2.mjs
 */

import type {
  BuyerQualificationStatus,
  BuyerTargetResidenceType,
  ContactAddress,
  ContactAssetNiche,
  ContactBuyerCriteria,
  ContactCommunicationPreferences,
  ContactLciFieldKey,
  ContactRelationRole,
  ContactSilo,
  ContactVisibility,
} from './contactTypes';
import { BUYER_TARGET_RESIDENCE_TYPES } from './contactTypes';

export const LCI_IMPORT_PLACEHOLDER_DATE = '0000-00-00';
export const LCI_IMPORT_PLACEHOLDER_OCCUPATION = 'À compléter (import legacy)';
export const LCI_IMPORT_PLACEHOLDER_ADDRESS_LINE = 'À compléter (import legacy)';
export const LCI_IMPORT_PLACEHOLDER_CITY = 'Non renseigné';
export const LCI_IMPORT_PLACEHOLDER_POSTAL = 'H0H 0H0';

export type LegacyContactSourceCollection = 'contacts' | 'vendors';

export interface LegacyRawContactRow {
  source: LegacyContactSourceCollection;
  legacyId: string;
  data: Record<string, unknown>;
}

/** Entrée historique `buyerPipeline` (collection interdite en V2). */
export interface LegacyPipelineHistoryEntry {
  collection: 'buyerPipeline';
  id: string;
  stage: string | null;
  pipelineOverride?: string | null;
  assignedTo?: string | null;
  capturedAt?: string;
}

export interface LegacyImportMeta {
  legacySources: Array<{ collection: LegacyContactSourceCollection; id: string }>;
  mergedCount: number;
  lciIncomplete: boolean;
  missingLciFields: ContactLciFieldKey[];
  importedAt?: string;
  /** Journal import — pas de collection `buyerPipeline` en V2 (DATA_MAPPING §3.1). */
  pipelineHistory?: LegacyPipelineHistoryEntry[];
  pipelineOverride?: string | null;
}

/** Payload prêt pour `organizations/{orgId}/contacts/{contactId}` (sans id Firestore cible). */
export interface LegacyContactV2Payload {
  orgId: string;
  ownerId: string;
  silo: ContactSilo;
  assetNiche: ContactAssetNiche;
  visibility: ContactVisibility;
  leadSource: 'IMPORT_LEGACY';
  nom: string;
  prenom?: string;
  adresse: ContactAddress;
  dateNaissance: string;
  occupationProfession: string;
  relationRoles?: ContactRelationRole[];
  email?: string;
  telephone?: string;
  residenceIds?: string[];
  buyerQualificationStatus?: BuyerQualificationStatus | null;
  buyerCriteria?: ContactBuyerCriteria;
  communicationPreferences?: ContactCommunicationPreferences;
  notes?: string;
  importMeta: LegacyImportMeta;
}

export interface LegacyContactDedupeStats {
  legacyContactsCount: number;
  legacyVendorsCount: number;
  legacyTotalRaw: number;
  legacyBuyerPipelineCount: number;
  buyerPipelineLinkedCount: number;
  buyerPipelineOrphanCount: number;
  duplicateGroups: number;
  recordsMergedAway: number;
  finalReadyCount: number;
  withEmailKey: number;
  withPhoneKeyOnly: number;
  withoutDedupeKey: number;
  lciIncompleteCount: number;
}

export interface LegacyBuyerPipelineRow {
  legacyId: string;
  data: Record<string, unknown>;
}

export function normalizeImportEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return v.includes('@') ? v : null;
}

export function normalizeImportPhone(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.slice(-10);
}

export function legacyUpdatedAtMillis(data: Record<string, unknown>): number {
  const u = data.updatedAt;
  const c = data.createdAt;
  const toMs = (v: unknown): number => {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const t = Date.parse(v);
      return Number.isNaN(t) ? 0 : t;
    }
    if (typeof v === 'object' && v !== null && 'toMillis' in v) {
      const fn = (v as { toMillis: () => number }).toMillis;
      if (typeof fn === 'function') return fn.call(v);
    }
    if (typeof v === 'object' && v !== null && '_seconds' in v) {
      return Number((v as { _seconds: number })._seconds) * 1000;
    }
    return 0;
  };
  return Math.max(toMs(u), toMs(c));
}

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export function mapLegacyRelationRoles(data: Record<string, unknown>): ContactRelationRole[] {
  const roles = new Set<ContactRelationRole>();
  const typeRaw = pickString(data.type).toLowerCase();
  const roleList = Array.isArray(data.roles) ? data.roles.map(String) : [];

  const addFromToken = (token: string) => {
    const t = token.toLowerCase();
    if (t.includes('blacklist') || t.includes('liste noire')) roles.add('blacklist');
    if (t.includes('former') || t.includes('ancien')) roles.add('former_owner');
    if (t.includes('courtier') || t.includes('broker') || t.includes('collabor')) roles.add('broker');
    if (t.includes('notaire') || t.includes('avocat') || t.includes('profession')) roles.add('professional');
    if (t.includes('vendeur') || t === 'seller') roles.add('seller');
    if (t.includes('acheteur') || t === 'buyer' || t.includes('qualifiedbuyer')) roles.add('buyer');
  };

  addFromToken(typeRaw);
  for (const r of roleList) addFromToken(r);

  if (roles.size === 0) roles.add('buyer');
  return Array.from(roles);
}

export function mapLegacyRelationRolesForSource(
  data: Record<string, unknown>,
  source: LegacyContactSourceCollection
): ContactRelationRole[] {
  const roles = mapLegacyRelationRoles(data);
  if (roles.length === 1 && roles[0] === 'buyer' && source === 'vendors') {
    return ['seller', ...roles.filter((r) => r !== 'buyer')];
  }
  if (source === 'vendors' && !roles.includes('seller')) {
    return [...roles, 'seller'];
  }
  return roles;
}

function finiteNum(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function finiteNumFirst(...sources: unknown[]): number | undefined {
  for (const src of sources) {
    const n = finiteNum(src);
    if (n !== undefined) return n;
  }
  return undefined;
}

function pickStringArray(...sources: unknown[]): string[] {
  const out: string[] = [];
  for (const src of sources) {
    if (Array.isArray(src)) {
      for (const item of src) {
        if (typeof item === 'string' && item.trim()) out.push(item.trim());
      }
    } else if (typeof src === 'string' && src.trim()) {
      out.push(src.trim());
    }
  }
  return [...new Set(out)];
}

function docRefFromUrl(url: unknown): ContactBuyerCriteria['ndaFile'] | undefined {
  if (typeof url !== 'string' || !url.trim()) return undefined;
  const u = url.trim();
  return { url: u, storagePath: u };
}

function normalizePipelineStageKey(stageRaw: unknown): string {
  if (stageRaw == null || stageRaw === '') return '';
  return String(stageRaw).trim().toUpperCase().replace(/\s+/g, '_');
}

/**
 * Stage Kanban explicitement « qualifié » (pas un simple sous-chaîne QUALIF dans SUIVI_NOUVEAUX).
 */
export function isExplicitLegacyQualifiedStage(stageRaw: unknown): boolean {
  const k = normalizePipelineStageKey(stageRaw);
  if (!k) return false;
  const exact = new Set([
    'QUALIFIE',
    'QUALIFIED',
    'ACHETEURS_QUALIFIES',
    'ACHETEUR_QUALIFIE',
    'ACHETEURS_QUALIFIE',
  ]);
  if (exact.has(k)) return true;
  if (/^ACHETEURS?_QUALIFIE(S)?$/.test(k)) return true;
  return false;
}

function hasNdaEvidence(
  data: Record<string, unknown>,
  criteria?: ContactBuyerCriteria
): boolean {
  if (data.ndaSigned === true || data.hasNDASigned === true || data.hasNdaSigned === true) {
    return true;
  }
  return Boolean(criteria?.hasNdaSigned || criteria?.ndaFile?.url);
}

function hasFundsEvidence(
  data: Record<string, unknown>,
  criteria?: ContactBuyerCriteria
): boolean {
  if (data.proofOfFunds === true || data.hasProofOfFunds === true) return true;
  return Boolean(
    criteria?.hasProofOfFunds ||
      criteria?.proofOfFundsFile?.url ||
      criteria?.bankLetterFile?.url ||
      criteria?.mortgagePreApprovalFile?.url ||
      criteria?.hasBankLetter ||
      criteria?.hasMortgagePreApproval
  );
}

/**
 * Indication de stage Legacy → statut V2 (sans forcer QUALIFIED sans preuves).
 */
export function mapBuyerPipelineStageToQualification(
  stageRaw: unknown
): BuyerQualificationStatus | null {
  const k = normalizePipelineStageKey(stageRaw);
  if (!k) return null;
  if (isExplicitLegacyQualifiedStage(stageRaw)) return 'QUALIFIED';
  if (k.includes('SERIEUX')) return 'FUNDS_VERIFIED';
  if (k.includes('SUIVI') || k.includes('NOUVEAU')) return 'PENDING_NDA';
  if (k === 'NON_CLASSE') return null;
  return null;
}

/**
 * Statut qualification final — règle PO : QUALIFIED seulement si NDA + fonds,
 * ou stage Legacy explicitement QUALIFIE.
 */
export function resolveBuyerQualificationFromPipeline(
  contactData: Record<string, unknown>,
  contactPayload: LegacyContactV2Payload,
  pipelineData: Record<string, unknown>,
  stageRaw: unknown
): BuyerQualificationStatus | null {
  const mergedCriteria = mergeBuyerCriteria(
    contactPayload.buyerCriteria,
    mapLegacyBuyerCriteria(pipelineData)
  );

  const nda =
    hasNdaEvidence(contactData, mergedCriteria) || hasNdaEvidence(pipelineData, mergedCriteria);
  const funds =
    hasFundsEvidence(contactData, mergedCriteria) ||
    hasFundsEvidence(pipelineData, mergedCriteria);

  if (isExplicitLegacyQualifiedStage(stageRaw) || (nda && funds)) {
    return 'QUALIFIED';
  }

  const stageHint = mapBuyerPipelineStageToQualification(stageRaw);
  if (stageHint === 'QUALIFIED') {
    if (nda && funds) return 'QUALIFIED';
    if (nda) return 'NDA_SIGNED';
    if (funds) return 'FUNDS_VERIFIED';
    return 'PENDING_NDA';
  }

  if (stageHint) {
    return pickQualificationRank(contactPayload.buyerQualificationStatus, stageHint);
  }

  if (nda && funds) return 'QUALIFIED';
  if (nda) return 'NDA_SIGNED';
  if (funds) return 'FUNDS_VERIFIED';

  return contactPayload.buyerQualificationStatus ?? null;
}

/** Critères acheteur depuis champs plats contact (§1.3 DATA_MAPPING). */
export function mapLegacyBuyerCriteria(data: Record<string, unknown>): ContactBuyerCriteria | undefined {
  const regions = pickStringArray(
    data.regionsRecherchees,
    data.regionPreferee,
    data.region,
    data.regions
  );
  const residenceTypes = pickStringArray(data.typesDeResidence, data.typeResidenceSouhaitee).filter(
    (t): t is BuyerTargetResidenceType =>
      (BUYER_TARGET_RESIDENCE_TYPES as readonly string[]).includes(t)
  );
  const budgetMax = finiteNumFirst(
    data.budgetMax,
    data.budget,
    data.budgetMaxAchat,
    data.capaciteAchat,
    data.montantBudget
  );
  const tgaRaw = finiteNumFirst(
    data.tgaMinimum,
    data.tgaMin,
    data.critereTgaMin,
    data.tgaMinRecherche,
    data.capRateMin,
    data.tgaCible,
    data.capRateTarget
  );
  const tgaMinimum =
    tgaRaw !== undefined ? (tgaRaw > 1 && tgaRaw <= 100 ? tgaRaw / 100 : tgaRaw) : undefined;
  const unitsMin = finiteNum(data.nombreUnitesMin ?? data.unitesMin);
  const unitsMax = finiteNum(data.nombreUnitesMax ?? data.unitesMax);
  const downpaymentAmount = finiteNum(data.miseDeFonds ?? data.downPayment);
  const timeline = pickString(data.etapeDemarches, data.dureeRecherche, data.timeline);
  const experienceDescription = [
    pickString(data.experienceSante),
    pickString(data.autresRpaInteressantes),
    pickString(data.experienceDescription),
  ]
    .filter(Boolean)
    .join(' · ');
  const hasBroker =
    data.travailleAvecCourtier === true ||
    pickString(data.travailleAvecCourtier).toLowerCase() === 'oui' ||
    pickString(data.travailleAvecCourtier).toLowerCase() === 'yes';

  const ndaFile = docRefFromUrl(data.confidentialityAgreementUrl ?? data.ndaUrl);
  const proofOfFundsFile = docRefFromUrl(data.proofOfFundsUrl);
  const bankLetterFile = docRefFromUrl(data.bankLetterUrl);
  const mortgagePreApprovalFile = docRefFromUrl(data.mortgagePreApprovalUrl);
  const companyName = pickString(
    data.entreprise,
    data.company,
    data.companyName,
    data.nomCompagnie,
    data.societe,
    data.organisation
  );
  const neq = pickString(data.neq, data.reqNumber, data.numeroEntreprise);

  const criteria: ContactBuyerCriteria = {
    ...(regions.length ? { regions } : {}),
    ...(residenceTypes.length ? { residenceTypes } : {}),
    ...(budgetMax !== undefined ? { budgetMax } : {}),
    ...(tgaMinimum !== undefined ? { tgaMinimum } : {}),
    ...(unitsMin !== undefined ? { unitsMin } : {}),
    ...(unitsMax !== undefined ? { unitsMax } : {}),
    ...(downpaymentAmount !== undefined ? { downpaymentAmount } : {}),
    ...(timeline ? { timeline } : {}),
    ...(experienceDescription ? { experienceDescription } : {}),
    ...(hasBroker ? { hasBroker: true } : {}),
    ...(ndaFile ? { ndaFile, hasNdaSigned: true } : {}),
    ...(proofOfFundsFile ? { proofOfFundsFile, hasProofOfFunds: true } : {}),
    ...(bankLetterFile ? { bankLetterFile, hasBankLetter: true } : {}),
    ...(mortgagePreApprovalFile
      ? { mortgagePreApprovalFile, hasMortgagePreApproval: true }
      : {}),
    ...(companyName
      ? {
          corporateMandate: {
            isMandatory: false,
            companyName,
            reqNumber: neq || '',
          },
        }
      : {}),
  };

  return Object.keys(criteria).length > 0 ? criteria : undefined;
}

/** Import bucket Storage — NDA signé → QUALIFIED ; sinon file d'attente HITL (PENDING_NDA). */
export function resolveStorageImportQualification(
  data: Record<string, unknown>,
  relationRoles: ContactRelationRole[]
): BuyerQualificationStatus | null {
  if (!relationRoles.includes('buyer')) return null;
  const criteria = mapLegacyBuyerCriteria(data);
  const ndaSigned =
    criteria?.hasNdaSigned === true ||
    data.ndaSigned === true ||
    data.hasNDASigned === true ||
    data.ententeConfidentialiteSignee === true ||
    data.confidentialitySigned === true ||
    ['signe', 'signé', 'signed', 'oui', 'true'].includes(
      pickString(data.statutNda, data.ndaStatus, data.statutNDA).toLowerCase()
    );
  if (ndaSigned) return 'QUALIFIED';
  return 'PENDING_NDA';
}

function mergeBuyerCriteria(
  a?: ContactBuyerCriteria,
  b?: ContactBuyerCriteria
): ContactBuyerCriteria | undefined {
  if (!a && !b) return undefined;
  const regions = [...new Set([...(a?.regions ?? []), ...(b?.regions ?? [])])];
  const residenceTypes = [
    ...new Set([...(a?.residenceTypes ?? []), ...(b?.residenceTypes ?? [])]),
  ] as ContactBuyerCriteria['residenceTypes'];
  return {
    ...b,
    ...a,
    regions: regions.length ? regions : undefined,
    residenceTypes: residenceTypes?.length ? residenceTypes : undefined,
    budgetMax: a?.budgetMax ?? b?.budgetMax,
    unitsMin: a?.unitsMin ?? b?.unitsMin,
    unitsMax: a?.unitsMax ?? b?.unitsMax,
    downpaymentAmount: a?.downpaymentAmount ?? b?.downpaymentAmount,
    timeline: a?.timeline || b?.timeline,
    experienceDescription: [a?.experienceDescription, b?.experienceDescription]
      .filter(Boolean)
      .join(' · ') || undefined,
    hasBroker: a?.hasBroker ?? b?.hasBroker,
    ndaFile: a?.ndaFile ?? b?.ndaFile,
    proofOfFundsFile: a?.proofOfFundsFile ?? b?.proofOfFundsFile,
    bankLetterFile: a?.bankLetterFile ?? b?.bankLetterFile,
    mortgagePreApprovalFile: a?.mortgagePreApprovalFile ?? b?.mortgagePreApprovalFile,
    hasNdaSigned: a?.hasNdaSigned || b?.hasNdaSigned,
    hasProofOfFunds: a?.hasProofOfFunds || b?.hasProofOfFunds,
    hasBankLetter: a?.hasBankLetter || b?.hasBankLetter,
    hasMortgagePreApproval: a?.hasMortgagePreApproval || b?.hasMortgagePreApproval,
  };
}

/** Cloisonnement : owner courtier depuis legacy ou défaut migration. */
export function resolveLegacyOwnerId(
  data: Record<string, unknown>,
  defaultOwnerId: string
): string {
  const candidate = pickString(
    data.courtierResponsable,
    data.courtierResponsableId,
    data.assignedTo,
    data.brokerId,
    data.ownerId
  );
  return candidate || defaultOwnerId;
}

export function mapLegacyBuyerQualification(
  data: Record<string, unknown>,
  relationRoles: ContactRelationRole[]
): BuyerQualificationStatus | null {
  if (!relationRoles.includes('buyer')) return null;
  const roles = Array.isArray(data.roles) ? data.roles.map((r) => String(r).toLowerCase()) : [];
  const type = pickString(data.type).toLowerCase();
  if (
    roles.some((r) => r.includes('qualified')) ||
    type.includes('qualifié') ||
    type.includes('qualified')
  ) {
    return 'QUALIFIED';
  }
  if (data.ndaSigned === true || data.hasNDASigned === true) return 'NDA_SIGNED';
  if (data.proofOfFunds === true || data.hasProofOfFunds === true) return 'FUNDS_VERIFIED';
  if (data.buyerQualificationStatus && typeof data.buyerQualificationStatus === 'string') {
    const v = data.buyerQualificationStatus.trim();
    if (['PENDING_NDA', 'NDA_SIGNED', 'FUNDS_VERIFIED', 'QUALIFIED'].includes(v)) {
      return v as BuyerQualificationStatus;
    }
  }
  return null;
}

function buildAddress(data: Record<string, unknown>): { address: ContactAddress; missing: boolean } {
  const ligne1 = pickString(data.adresse, data.address, data.ligne1);
  const ville = pickString(data.ville, data.city);
  const codePostal = pickString(data.codePostal, data.postalCode);
  const province = pickString(data.province) || 'QC';
  const missing = !ligne1 || !ville || !codePostal;
  return {
    missing,
    address: {
      ligne1: ligne1 || LCI_IMPORT_PLACEHOLDER_ADDRESS_LINE,
      ville: ville || LCI_IMPORT_PLACEHOLDER_CITY,
      codePostal: codePostal || LCI_IMPORT_PLACEHOLDER_POSTAL,
      province,
    },
  };
}

function detectMissingLci(data: Record<string, unknown>, nom: string, address: ContactAddress): ContactLciFieldKey[] {
  const missing: ContactLciFieldKey[] = [];
  if (!nom.trim()) missing.push('nom');
  const dob = pickString(data.dateNaissance, data.dateOfBirth, data.birthDate);
  if (!dob) missing.push('dateNaissance');
  const occ = pickString(data.occupationProfession, data.occupation, data.profession, data.title);
  if (!occ) missing.push('occupationProfession');
  if (
    address.ligne1 === LCI_IMPORT_PLACEHOLDER_ADDRESS_LINE ||
    address.ville === LCI_IMPORT_PLACEHOLDER_CITY ||
    address.codePostal === LCI_IMPORT_PLACEHOLDER_POSTAL
  ) {
    missing.push('adresse');
  }
  return missing;
}

export function legacyRowToV2Payload(
  row: LegacyRawContactRow,
  ctx: { orgId: string; ownerId: string; visibility: ContactVisibility }
): LegacyContactV2Payload {
  const data = row.data;
  const prenom = pickString(data.prenom, data.firstName);
  const nom =
    pickString(data.nom, data.lastName) ||
    pickString(data.displayName, data.companyName, data.nomCompagnie, data.societe) ||
    'Contact (import legacy)';
  const { address, missing: addressMissing } = buildAddress(data);
  const missingLci = detectMissingLci(data, nom, address);
  const dob =
    pickString(data.dateNaissance, data.dateOfBirth, data.birthDate) || LCI_IMPORT_PLACEHOLDER_DATE;
  const occupation =
    pickString(data.occupationProfession, data.occupation, data.profession, data.title) ||
    LCI_IMPORT_PLACEHOLDER_OCCUPATION;

  const relationRoles = mapLegacyRelationRolesForSource(data, row.source);
  const email = normalizeImportEmail(data.courriel ?? data.email) ?? undefined;
  const telephone =
    normalizeImportPhone(data.telephone ?? data.cellulaire ?? data.phone ?? data.mobile) ?? undefined;

  const residenceIds = Array.isArray(data.residenceIds)
    ? [...new Set(data.residenceIds.map(String).filter(Boolean))]
    : undefined;

  const buyerCriteria = mapLegacyBuyerCriteria(data);
  const doNotEmail = data.doNotEmail === true;

  const notesParts = [
    pickString(data.notes, data.note),
    `[Import legacy: ${row.source}/${row.legacyId}]`,
  ].filter(Boolean);

  return {
    orgId: ctx.orgId,
    ownerId: resolveLegacyOwnerId(data, ctx.ownerId),
    silo: 'COMMERCIAL_SPEC',
    assetNiche: 'RPA',
    visibility: ctx.visibility,
    leadSource: 'IMPORT_LEGACY',
    nom,
    prenom: prenom || undefined,
    adresse: address,
    dateNaissance: dob,
    occupationProfession: occupation,
    relationRoles,
    email,
    telephone,
    residenceIds,
    buyerQualificationStatus: mapLegacyBuyerQualification(data, relationRoles),
    ...(buyerCriteria ? { buyerCriteria } : {}),
    ...(doNotEmail
      ? { communicationPreferences: { unsubscribedFromEmails: false, excludedFromMassMailing: true } }
      : {}),
    notes: notesParts.join('\n'),
    importMeta: {
      legacySources: [{ collection: row.source, id: row.legacyId }],
      mergedCount: 1,
      lciIncomplete: missingLci.length > 0 || addressMissing,
      missingLciFields: missingLci,
    },
  };
}

function mergePayloads(
  primary: LegacyContactV2Payload,
  secondary: LegacyContactV2Payload
): LegacyContactV2Payload {
  const roleSet = new Set<ContactRelationRole>([
    ...(primary.relationRoles ?? []),
    ...(secondary.relationRoles ?? []),
  ]);
  const residenceSet = new Set([
    ...(primary.residenceIds ?? []),
    ...(secondary.residenceIds ?? []),
  ]);
  const missingSet = new Set<ContactLciFieldKey>([
    ...primary.importMeta.missingLciFields,
    ...secondary.importMeta.missingLciFields,
  ]);

  let buyerQualificationStatus = primary.buyerQualificationStatus ?? secondary.buyerQualificationStatus;
  const rank: Record<string, number> = {
    QUALIFIED: 4,
    FUNDS_VERIFIED: 3,
    NDA_SIGNED: 2,
    PENDING_NDA: 1,
  };
  const sec = secondary.buyerQualificationStatus;
  if (sec && (!buyerQualificationStatus || (rank[sec] ?? 0) > (rank[buyerQualificationStatus] ?? 0))) {
    buyerQualificationStatus = sec;
  }

  const notes = [primary.notes, secondary.notes].filter(Boolean).join('\n---\n');
  const buyerCriteria = mergeBuyerCriteria(primary.buyerCriteria, secondary.buyerCriteria);
  const excludedFromMassMailing =
    primary.communicationPreferences?.excludedFromMassMailing ||
    secondary.communicationPreferences?.excludedFromMassMailing;

  return {
    ...primary,
    prenom: primary.prenom || secondary.prenom,
    email: primary.email || secondary.email,
    telephone: primary.telephone || secondary.telephone,
    ownerId: primary.ownerId || secondary.ownerId,
    relationRoles: Array.from(roleSet),
    residenceIds: residenceSet.size ? Array.from(residenceSet) : undefined,
    buyerQualificationStatus,
    ...(buyerCriteria ? { buyerCriteria } : {}),
    ...(excludedFromMassMailing
      ? {
          communicationPreferences: {
            unsubscribedFromEmails: false,
            excludedFromMassMailing: true,
          },
        }
      : {}),
    notes,
    importMeta: {
      legacySources: [...primary.importMeta.legacySources, ...secondary.importMeta.legacySources],
      mergedCount: primary.importMeta.mergedCount + secondary.importMeta.mergedCount,
      lciIncomplete: primary.importMeta.lciIncomplete || secondary.importMeta.lciIncomplete,
      missingLciFields: Array.from(missingSet),
    },
  };
}

export function dedupeKeyForRow(row: LegacyRawContactRow): string | null {
  const email = normalizeImportEmail(row.data.courriel ?? row.data.email);
  if (email) return `email:${email}`;
  const phone = normalizeImportPhone(
    row.data.telephone ?? row.data.cellulaire ?? row.data.phone ?? row.data.mobile
  );
  if (phone) return `phone:${phone}`;
  return null;
}

export function storageLegacyRowToV2Payload(
  row: LegacyRawContactRow,
  ctx: { orgId: string; ownerId: string; visibility: ContactVisibility }
): LegacyContactV2Payload {
  const base = legacyRowToV2Payload(row, ctx);
  const roles = base.relationRoles ?? ['buyer'];
  const buyerCriteria = mergeBuyerCriteria(base.buyerCriteria, mapLegacyBuyerCriteria(row.data));
  return {
    ...base,
    relationRoles: roles,
    buyerCriteria,
    buyerQualificationStatus: resolveStorageImportQualification(row.data, roles),
    importMeta: {
      ...base.importMeta,
      legacySources: [
        ...base.importMeta.legacySources,
        { collection: 'contacts', id: `storage:${row.legacyId}` },
      ],
    },
  };
}

export function dedupeLegacyRows(
  rows: LegacyRawContactRow[],
  ctx: { orgId: string; ownerId: string; visibility: ContactVisibility },
  options?: {
    toPayload?: (row: LegacyRawContactRow) => LegacyContactV2Payload;
  }
): { payloads: LegacyContactV2Payload[]; stats: LegacyContactDedupeStats } {
  const toPayload = options?.toPayload ?? ((row) => legacyRowToV2Payload(row, ctx));
  const contacts = rows.filter((r) => r.source === 'contacts');
  const vendors = rows.filter((r) => r.source === 'vendors');

  const byKey = new Map<string, { rows: LegacyRawContactRow[]; latestMs: number }>();
  const orphanRows: LegacyRawContactRow[] = [];

  for (const row of rows) {
    const key = dedupeKeyForRow(row);
    if (!key) {
      orphanRows.push(row);
      continue;
    }
    const ms = legacyUpdatedAtMillis(row.data);
    const bucket = byKey.get(key);
    if (!bucket) {
      byKey.set(key, { rows: [row], latestMs: ms });
    } else {
      bucket.rows.push(row);
      bucket.latestMs = Math.max(bucket.latestMs, ms);
    }
  }

  const payloads: LegacyContactV2Payload[] = [];
  let recordsMergedAway = 0;
  let duplicateGroups = 0;

  for (const { rows: group } of byKey.values()) {
    if (group.length > 1) {
      duplicateGroups += 1;
      recordsMergedAway += group.length - 1;
    }
    const sorted = [...group].sort(
      (a, b) => legacyUpdatedAtMillis(b.data) - legacyUpdatedAtMillis(a.data)
    );
    let merged = toPayload(sorted[0]);
    merged.importMeta.mergedCount = 1;
    for (let i = 1; i < sorted.length; i++) {
      const next = toPayload(sorted[i]);
      merged = mergePayloads(merged, next);
    }
    payloads.push(merged);
  }

  for (const row of orphanRows) {
    payloads.push(toPayload(row));
  }

  const lciIncompleteCount = payloads.filter((p) => p.importMeta.lciIncomplete).length;

  return {
    payloads,
    stats: {
      legacyContactsCount: contacts.length,
      legacyVendorsCount: vendors.length,
      legacyTotalRaw: rows.length,
      legacyBuyerPipelineCount: 0,
      buyerPipelineLinkedCount: 0,
      buyerPipelineOrphanCount: 0,
      duplicateGroups,
      recordsMergedAway,
      finalReadyCount: payloads.length,
      withEmailKey: [...byKey.keys()].filter((k) => k.startsWith('email:')).length,
      withPhoneKeyOnly: [...byKey.keys()].filter((k) => k.startsWith('phone:')).length,
      withoutDedupeKey: orphanRows.length,
      lciIncompleteCount,
    },
  };
}

/** ID déterministe pour ré-import idempotent (même clé dédup → même doc). */
export function deterministicImportContactId(payload: LegacyContactV2Payload): string {
  const email = payload.email?.toLowerCase();
  const phone = payload.telephone;
  const seed =
    email ||
    (phone ? `phone:${phone}` : null) ||
    payload.importMeta.legacySources.map((s) => `${s.collection}_${s.id}`).join('|');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const primaryLegacy = payload.importMeta.legacySources[0]?.id?.slice(0, 12) || 'x';
  return `imp_${hash.toString(16)}_${primaryLegacy}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48);
}

function pickQualificationRank(
  a: BuyerQualificationStatus | null | undefined,
  b: BuyerQualificationStatus | null | undefined
): BuyerQualificationStatus | null {
  const rank: Record<string, number> = {
    QUALIFIED: 4,
    FUNDS_VERIFIED: 3,
    NDA_SIGNED: 2,
    PENDING_NDA: 1,
  };
  if (!a) return b ?? null;
  if (!b) return a;
  return (rank[b] ?? 0) > (rank[a] ?? 0) ? b : a;
}

/**
 * Aplatit `buyerPipeline/{id}` sur les payloads contact (pas de nouvelle collection).
 * Jointure par `buyerId` = id legacy `contacts/{id}`.
 */
export function enrichPayloadsWithBuyerPipeline(
  payloads: LegacyContactV2Payload[],
  pipelineRows: LegacyBuyerPipelineRow[],
  contactDataByLegacyId: Map<string, Record<string, unknown>> = new Map()
): { payloads: LegacyContactV2Payload[]; linked: number; orphans: number } {
  if (pipelineRows.length === 0) {
    return { payloads, linked: 0, orphans: 0 };
  }

  const enriched = payloads.map((p) => ({ ...p }));
  let linked = 0;
  let orphans = 0;

  for (const row of pipelineRows) {
    const data = row.data;
    const buyerId = pickString(data.buyerId, data.contactId, data.buyerContactId);
    if (!buyerId) {
      orphans += 1;
      continue;
    }

    const indices: number[] = [];
    enriched.forEach((p, i) => {
      const match = p.importMeta.legacySources.some(
        (src) => src.collection === 'contacts' && src.id === buyerId
      );
      if (match) indices.push(i);
    });

    if (indices.length === 0) {
      orphans += 1;
      continue;
    }

    const stageRaw = data.stage ?? data.pipelineStage ?? data.pipelineColumn;
    const override = pickString(data.pipelineOverrideColumn, data.pipelineColumn);

    const historyEntry: LegacyPipelineHistoryEntry = {
      collection: 'buyerPipeline',
      id: row.legacyId,
      stage: stageRaw != null ? String(stageRaw) : null,
      pipelineOverride: override || null,
      assignedTo: pickString(data.assignedTo) || null,
    };

    for (const idx of indices) {
      linked += 1;
      const cur = enriched[idx];
      const contactData = contactDataByLegacyId.get(buyerId) ?? {};
      const buyerQualificationStatus = resolveBuyerQualificationFromPipeline(
        contactData,
        cur,
        data,
        stageRaw
      );

      const pipelineOwner = pickString(data.assignedTo, data.courtierResponsable, data.brokerId);
      const pipelineCriteria = mapLegacyBuyerCriteria(data);
      const leadFromPipeline = pickString(data.source, data.provenance);

      const relationRoles: ContactRelationRole[] = cur.relationRoles?.includes('buyer')
        ? cur.relationRoles
        : [...(cur.relationRoles ?? []), 'buyer'];

      enriched[idx] = {
        ...cur,
        relationRoles,
        ownerId: pipelineOwner || cur.ownerId,
        buyerQualificationStatus,
        buyerCriteria: mergeBuyerCriteria(cur.buyerCriteria, pipelineCriteria),
        notes: [cur.notes, leadFromPipeline ? `[Pipeline: ${leadFromPipeline}]` : null]
          .filter(Boolean)
          .join('\n'),
        importMeta: {
          ...cur.importMeta,
          pipelineHistory: [...(cur.importMeta.pipelineHistory ?? []), historyEntry],
          pipelineOverride: override || cur.importMeta.pipelineOverride || null,
        },
      };
    }
  }

  return { payloads: enriched, linked, orphans };
}

export interface LegacyContactMigrationPlan {
  payloads: LegacyContactV2Payload[];
  stats: LegacyContactDedupeStats;
}

/**
 * Plan complet : contacts + vendors fusionnés, puis overlay buyerPipeline.
 */
/** Plan migration — fichiers Storage `contacts/` (sans buyerPipeline Firestore). */
export function buildStorageContactsMigrationPlan(
  rows: LegacyRawContactRow[],
  ctx: { orgId: string; ownerId: string; visibility: ContactVisibility }
): LegacyContactMigrationPlan {
  const { payloads: deduped, stats: baseStats } = dedupeLegacyRows(rows, ctx, {
    toPayload: (row) => storageLegacyRowToV2Payload(row, ctx),
  });
  return {
    payloads: deduped,
    stats: {
      ...baseStats,
      legacyBuyerPipelineCount: 0,
      buyerPipelineLinkedCount: 0,
      buyerPipelineOrphanCount: 0,
    },
  };
}

export function buildLegacyContactMigrationPlan(
  rows: LegacyRawContactRow[],
  pipelineRows: LegacyBuyerPipelineRow[],
  ctx: { orgId: string; ownerId: string; visibility: ContactVisibility }
): LegacyContactMigrationPlan {
  const { payloads: deduped, stats: baseStats } = dedupeLegacyRows(rows, ctx);
  const contactDataByLegacyId = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    if (row.source === 'contacts') contactDataByLegacyId.set(row.legacyId, row.data);
  }
  const { payloads, linked, orphans } = enrichPayloadsWithBuyerPipeline(
    deduped,
    pipelineRows,
    contactDataByLegacyId
  );

  return {
    payloads,
    stats: {
      ...baseStats,
      legacyBuyerPipelineCount: pipelineRows.length,
      buyerPipelineLinkedCount: linked,
      buyerPipelineOrphanCount: orphans,
    },
  };
}
