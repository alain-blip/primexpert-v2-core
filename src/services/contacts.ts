/**
 * contacts.ts — Service CRM `organizations/{orgId}/contacts`
 *
 * Cloison : ownerId (courtier) + visibility AGENCY_SHARED (pool RPA).
 * Validation LCI via @primexpert/core/crm avant écriture.
 */

import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  buildAddPartiePatch,
  buildRemovePartiePatch,
  syncAddResidenceIdToContact,
  syncRemoveResidenceIdFromContact,
  type ResidencePartyRole,
} from '@primexpert/core/residence';
import { stripUndefinedDeep } from '../lib/firestoreSanitize';
import {
  parseContactBuyerFields,
  parseContactBrokerFields,
  parseContactCommunicationPreferences,
  parseContactProfessionalFields,
  parseContactSellerFields,
  defaultContactSiloForRoles,
  syncAddCoBuyerId,
  syncAddCoSellerId,
  syncAddManagedBuyerId,
  syncRemoveCoBuyerId,
  syncRemoveCoSellerId,
  syncRemoveManagedBuyerId,
  buildContactDisplayName,
  buildContactIdProofStoragePath,
  buildContactBuyerDocumentStoragePath,
  buildContactSellerDocumentStoragePath,
  canAdminReassignContactOwner,
  defaultContactVisibility,
  normalizeContactLegalVerification,
  getContactLciSecondaryGaps,
  normalizeContactAddressForWrite,
  validateContactLciFields,
  parseContactImportMeta,
  type ContactCriteriaDocumentRef,
  type BuyerQualificationStatus,
  type ContactBuyerCriteria,
  type ContactBrokerCriteria,
  type ContactCommunicationPreferences,
  type ContactSellerCriteria,
  type ProfessionalType,
  type ContactAssetNiche,
  type ContactLeadSource,
  type ContactLegalVerification,
  type ContactRelationRole,
  type ContactSilo,
  type ContactVisibility,
  type ContactBuyerDocumentKind,
  type ContactSellerDocumentKind,
  type OrganizationContact,
} from '@primexpert/core/crm';
import { findContactsByEmail, normalizeMailAddress } from '@primexpert/core/mail';
import { db } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

export type {
  ContactAssetNiche,
  ContactLeadSource,
  ContactLegalVerification,
  ContactRelationRole,
  ContactSilo,
  ContactVisibility,
  OrganizationContact,
} from '@primexpert/core/crm';

export interface ContactServiceContext {
  uid: string;
  orgId: string;
  role: 'admin' | 'admin_system' | 'member';
}

export interface CreateOrganizationContactInput {
  silo: ContactSilo;
  assetNiche?: ContactAssetNiche;
  visibility?: ContactVisibility;
  leadSource?: ContactLeadSource;
  nom: string;
  prenom?: string;
  adresse?: Partial<OrganizationContact['adresse']>;
  dateNaissance?: string;
  occupationProfession?: string;
  relationRoles?: ContactRelationRole[];
  email?: string;
  telephone?: string;
  residenceIds?: string[];
  buyerQualificationStatus?: BuyerQualificationStatus | null;
  buyerCriteria?: ContactBuyerCriteria;
  communicationPreferences?: ContactCommunicationPreferences;
  /** Admin ou création — sinon `ctx.uid` par défaut. */
  ownerId?: string;
  coBuyerIds?: string[];
  sellerCriteria?: ContactSellerCriteria;
  coSellerIds?: string[];
  brokerCriteria?: ContactBrokerCriteria;
  professionalType?: ProfessionalType;
  notes?: string;
  legalVerification?: ContactLegalVerification;
}

function canWriteOrganizationContact(
  ctx: ContactServiceContext,
  contact: OrganizationContact
): boolean {
  return isContactAdmin(ctx) || contact.ownerId === ctx.uid;
}

/** Lecture contact CRM (Accès Vendeur, fiche détail). */
export async function getOrganizationContact(
  ctx: ContactServiceContext,
  contactId: string
): Promise<OrganizationContact | null> {
  return getOrganizationContactDoc(ctx, contactId);
}

/** Écoute temps réel d'un contact CRM (Accès Vendeur). */
export function subscribeOrganizationContact(
  ctx: ContactServiceContext,
  contactId: string,
  onUpdate: (contact: OrganizationContact | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!ctx.orgId || !contactId) {
    onUpdate(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'organizations', ctx.orgId, 'contacts', contactId),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(mapContactDoc(ctx.orgId, snap.id, snap.data()));
    },
    (err) => {
      console.error('[contacts.subscribeOrganizationContact] failed', err);
      onError?.(err as Error);
      onUpdate(null);
    }
  );
}

async function getOrganizationContactDoc(
  ctx: ContactServiceContext,
  contactId: string
): Promise<OrganizationContact | null> {
  if (!ctx.orgId || !contactId) return null;
  const snap = await getDoc(doc(db, 'organizations', ctx.orgId, 'contacts', contactId));
  if (!snap.exists()) return null;
  return mapContactDoc(ctx.orgId, snap.id, snap.data());
}

function isContactAdmin(ctx: ContactServiceContext): boolean {
  return ctx.role === 'admin' || ctx.role === 'admin_system';
}

function contactsCollection(orgId: string) {
  return collection(db, 'organizations', orgId, 'contacts');
}

function pickContactString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function mapContactDoc(orgId: string, id: string, data: DocumentData): OrganizationContact {
  const prenom = pickContactString(data.prenom, data.firstName);
  const nom =
    pickContactString(data.nom, data.lastName, data.nomComplet, data.displayName) ?? '';
  const entreprise = pickContactString(
    data.entreprise,
    data.company,
    data.organisation,
    data.companyName,
    data.nomCompagnie,
    data.societe
  );

  return {
    id,
    orgId,
    ownerId: String(data.ownerId ?? ''),
    silo: data.silo as ContactSilo,
    assetNiche: data.assetNiche as ContactAssetNiche | undefined,
    visibility: (data.visibility as ContactVisibility) ?? 'PRIVATE',
    leadSource: (data.leadSource as ContactLeadSource) ?? 'BROKER_GENERATED',
    nom,
    prenom,
    ...(entreprise ? { entreprise } : {}),
    ...(data.adresse ? { adresse: data.adresse as OrganizationContact['adresse'] } : {}),
    ...(data.dateNaissance != null && String(data.dateNaissance).trim()
      ? { dateNaissance: String(data.dateNaissance).trim() }
      : {}),
    ...(data.occupationProfession != null && String(data.occupationProfession).trim()
      ? { occupationProfession: String(data.occupationProfession).trim() }
      : {}),
    relationRoles: Array.isArray(data.relationRoles)
      ? (data.relationRoles as ContactRelationRole[])
      : undefined,
    email: data.email ? String(data.email) : undefined,
    telephone: data.telephone ? String(data.telephone) : undefined,
    residenceIds: Array.isArray(data.residenceIds)
      ? data.residenceIds.map(String)
      : undefined,
    ...parseContactBuyerFields(data as Record<string, unknown>),
    ...parseContactSellerFields(data as Record<string, unknown>),
    ...parseContactBrokerFields(data as Record<string, unknown>),
    ...parseContactProfessionalFields(data as Record<string, unknown>),
    notes: data.notes ? String(data.notes) : undefined,
    legalVerification: normalizeContactLegalVerification(data.legalVerification),
    importMeta: parseContactImportMeta(data.importMeta),
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  };
}

/**
 * Liste les contacts visibles : propriétaire + partagés agence (AGENCY_SHARED).
 */
export async function listOrganizationContacts(
  ctx: ContactServiceContext
): Promise<OrganizationContact[]> {
  if (!ctx.orgId) return [];

  const col = contactsCollection(ctx.orgId);
  const [ownedSnap, sharedSnap] = await Promise.all([
    getDocs(query(col, where('ownerId', '==', ctx.uid))),
    getDocs(query(col, where('visibility', '==', 'AGENCY_SHARED'))),
  ]);

  const byId = new Map<string, OrganizationContact>();
  for (const d of ownedSnap.docs) {
    byId.set(d.id, mapContactDoc(ctx.orgId, d.id, d.data()));
  }
  for (const d of sharedSnap.docs) {
    if (!byId.has(d.id)) {
      byId.set(d.id, mapContactDoc(ctx.orgId, d.id, d.data()));
    }
  }
  return Array.from(byId.values());
}

/** Recherche contacts par courriel exact (pool owner + AGENCY_SHARED). */
export async function findOrganizationContactsByEmail(
  ctx: ContactServiceContext,
  emailRaw: string
): Promise<OrganizationContact[]> {
  const email = normalizeMailAddress(emailRaw);
  if (!email) return [];
  const rows = await listOrganizationContacts(ctx);
  return findContactsByEmail(
    rows.map((c) => ({
      ...c,
      displayName: buildContactDisplayName(c),
    })),
    email
  );
}

export async function getOrganizationContactById(
  ctx: ContactServiceContext,
  contactId: string
): Promise<OrganizationContact | null> {
  if (!ctx.orgId || !contactId) return null;
  const ref = doc(db, 'organizations', ctx.orgId, 'contacts', contactId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const row = mapContactDoc(ctx.orgId, snap.id, snap.data());
  if (row.ownerId === ctx.uid || row.visibility === 'AGENCY_SHARED') {
    return row;
  }
  return null;
}

export async function createOrganizationContact(
  ctx: ContactServiceContext,
  input: CreateOrganizationContactInput,
  contactId?: string
): Promise<{ ok: true; id: string } | { ok: false; error: string; missing?: string[] }> {
  const lci = validateContactLciFields(input);
  if (!lci.ok) {
    return { ok: false, error: 'lci_incomplete', missing: lci.missing };
  }

  const id = contactId ?? doc(contactsCollection(ctx.orgId)).id;
  const visibility =
    input.visibility ?? defaultContactVisibility(input.silo, input.assetNiche);
  const now = new Date().toISOString();

  const ownerId =
    isContactAdmin(ctx) && input.ownerId?.trim() && input.ownerId.trim() !== ctx.uid
      ? input.ownerId.trim()
      : ctx.uid;
  const silo = defaultContactSiloForRoles(input.relationRoles, input.silo);

  const adresse = normalizeContactAddressForWrite(input.adresse);
  const dateNaissance = input.dateNaissance?.trim();
  const occupationProfession = input.occupationProfession?.trim();

  const lciGaps = getContactLciSecondaryGaps({
    nom: input.nom,
    adresse: normalizeContactAddressForWrite(input.adresse),
    dateNaissance: input.dateNaissance?.trim(),
    occupationProfession: input.occupationProfession?.trim(),
  });

  const payload: Omit<OrganizationContact, 'id'> & { id?: string } = {
    orgId: ctx.orgId,
    ownerId,
    silo,
    assetNiche: input.assetNiche,
    visibility,
    leadSource: input.leadSource ?? 'BROKER_GENERATED',
    nom: input.nom.trim(),
    prenom: input.prenom?.trim(),
    ...(adresse ? { adresse } : {}),
    ...(dateNaissance ? { dateNaissance } : {}),
    ...(occupationProfession ? { occupationProfession } : {}),
    relationRoles: input.relationRoles,
    email: input.email?.trim(),
    telephone: input.telephone?.trim(),
    residenceIds: input.residenceIds,
    ...(input.buyerQualificationStatus !== undefined
      ? { buyerQualificationStatus: input.buyerQualificationStatus }
      : {}),
    ...(input.buyerCriteria ? { buyerCriteria: input.buyerCriteria } : {}),
    ...(input.coBuyerIds?.length ? { coBuyerIds: input.coBuyerIds } : {}),
    ...(input.sellerCriteria ? { sellerCriteria: input.sellerCriteria } : {}),
    ...(input.coSellerIds?.length ? { coSellerIds: input.coSellerIds } : {}),
    ...(input.brokerCriteria ? { brokerCriteria: input.brokerCriteria } : {}),
    ...(input.professionalType ? { professionalType: input.professionalType } : {}),
    notes: input.notes?.trim(),
    ...(input.legalVerification ? { legalVerification: input.legalVerification } : {}),
    ...(lciGaps.length > 0
      ? {
          importMeta: {
            lciIncomplete: true,
            missingLciFields: lciGaps,
          },
        }
      : {}),
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(
    doc(db, 'organizations', ctx.orgId, 'contacts', id),
    stripUndefinedDeep(payload)
  );
  return { ok: true, id };
}

export async function updateOrganizationContact(
  ctx: ContactServiceContext,
  contactId: string,
  patch: Partial<CreateOrganizationContactInput>
): Promise<{ ok: true } | { ok: false; error: string; missing?: string[] }> {
  const existing = await getOrganizationContactById(ctx, contactId);
  if (!existing) {
    return { ok: false, error: 'forbidden' };
  }
  const admin = isContactAdmin(ctx);
  if (!admin && existing.ownerId !== ctx.uid) {
    return { ok: false, error: 'forbidden' };
  }
  if (patch.ownerId !== undefined && !admin) {
    return { ok: false, error: 'forbidden' };
  }

  const normalizedAdresse =
    patch.adresse !== undefined ? normalizeContactAddressForWrite(patch.adresse) : undefined;
  const merged: Partial<OrganizationContact> = {
    ...existing,
    ...patch,
    ...(patch.adresse !== undefined ? { adresse: normalizedAdresse } : {}),
    ...(patch.dateNaissance !== undefined
      ? { dateNaissance: patch.dateNaissance?.trim() || undefined }
      : {}),
    ...(patch.occupationProfession !== undefined
      ? { occupationProfession: patch.occupationProfession?.trim() || undefined }
      : {}),
  };
  const lci = validateContactLciFields(merged);
  if (!lci.ok) {
    return { ok: false, error: 'lci_incomplete', missing: lci.missing };
  }

  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      updatePayload[key] = value;
    }
  }
  if (patch.adresse !== undefined) {
    updatePayload.adresse = normalizedAdresse ?? deleteField();
  }
  if (patch.dateNaissance !== undefined) {
    const dob = patch.dateNaissance?.trim();
    updatePayload.dateNaissance = dob ? dob : deleteField();
  }
  if (patch.occupationProfession !== undefined) {
    const occ = patch.occupationProfession?.trim();
    updatePayload.occupationProfession = occ ? occ : deleteField();
  }
  if (patch.legalVerification !== undefined) {
    const legal = normalizeContactLegalVerification(patch.legalVerification);
    if (legal && Object.keys(stripUndefinedDeep(legal)).length > 0) {
      updatePayload.legalVerification = stripUndefinedDeep(legal);
    } else {
      delete updatePayload.legalVerification;
    }
  }
  if (admin && patch.ownerId?.trim()) {
    updatePayload.ownerId = patch.ownerId.trim();
  }
  if (lci.ok && existing.importMeta) {
    const secondaryMissing = getContactLciSecondaryGaps(merged);
    updatePayload.importMeta = {
      ...existing.importMeta,
      lciIncomplete: secondaryMissing.length > 0,
      missingLciFields: secondaryMissing,
    };
  }
  await updateDoc(
    doc(db, 'organizations', ctx.orgId, 'contacts', contactId),
    stripUndefinedDeep(updatePayload)
  );
  return { ok: true };
}

/**
 * Téléverse une preuve d’identité (vérification à distance) — chemin tenant orgId.
 */
export async function uploadContactIdProof(
  ctx: ContactServiceContext,
  contactId: string,
  file: File
): Promise<
  | { ok: true; url: string; storagePath: string }
  | { ok: false; error: 'forbidden' | 'not_found' | 'upload_failed' }
> {
  const existing = await getOrganizationContactById(ctx, contactId);
  if (!existing || existing.ownerId !== ctx.uid) {
    return { ok: false, error: 'forbidden' };
  }

  const storagePath = buildContactIdProofStoragePath(ctx.orgId, contactId, file.name);
  try {
    const objectRef = ref(storage, storagePath);
    await uploadBytes(objectRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        orgId: ctx.orgId,
        contactId,
        scope: 'contact_id_proof',
        uploadedBy: ctx.uid,
      },
    });
    const url = await getDownloadURL(objectRef);
    const legalVerification: ContactLegalVerification = {
      ...existing.legalVerification,
      verificationMode: 'A_DISTANCE',
      idDocumentUrl: url,
      idDocumentStoragePath: storagePath,
    };
    await updateDoc(doc(db, 'organizations', ctx.orgId, 'contacts', contactId), {
      legalVerification: stripUndefinedDeep(legalVerification),
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, url, storagePath };
  } catch (e) {
    console.warn('[contacts.uploadContactIdProof] failed:', e);
    return { ok: false, error: 'upload_failed' };
  }
}

function applyBuyerDocumentToCriteria(
  criteria: ContactBuyerCriteria,
  kind: ContactBuyerDocumentKind,
  ref: ContactCriteriaDocumentRef
): ContactBuyerCriteria {
  switch (kind) {
    case 'nda':
      return { ...criteria, ndaFile: ref };
    case 'proof_of_funds':
      return { ...criteria, proofOfFundsFile: ref };
    case 'bank_letter':
      return { ...criteria, bankLetterFile: ref };
    case 'mortgage_pre_approval':
      return { ...criteria, mortgagePreApprovalFile: ref };
    case 'req':
      return {
        ...criteria,
        corporateMandate: {
          isMandatory: criteria.corporateMandate?.isMandatory ?? true,
          companyName: criteria.corporateMandate?.companyName ?? '',
          reqNumber: criteria.corporateMandate?.reqNumber ?? '',
          reqFile: ref,
        },
      };
    default:
      return criteria;
  }
}

/**
 * Téléverse une pièce justificative acheteur (Storage + référence sur `buyerCriteria`).
 */
export async function uploadContactBuyerDocument(
  ctx: ContactServiceContext,
  contactId: string,
  kind: ContactBuyerDocumentKind,
  file: File
): Promise<
  | { ok: true; ref: BuyerCriteriaDocumentRef }
  | { ok: false; error: 'forbidden' | 'not_found' | 'upload_failed' }
> {
  const existing = await getOrganizationContactById(ctx, contactId);
  if (!existing || !canWriteOrganizationContact(ctx, existing)) {
    return { ok: false, error: 'forbidden' };
  }

  const storagePath = buildContactBuyerDocumentStoragePath(
    ctx.orgId,
    contactId,
    kind,
    file.name
  );
  try {
    const objectRef = ref(storage, storagePath);
    await uploadBytes(objectRef, file, {
      contentType: file.type || 'application/pdf',
      customMetadata: {
        orgId: ctx.orgId,
        contactId,
        scope: 'contact_buyer_document',
        documentKind: kind,
        uploadedBy: ctx.uid,
      },
    });
    const url = await getDownloadURL(objectRef);
    const docRef: ContactCriteriaDocumentRef = {
      url,
      storagePath,
      uploadedAt: new Date().toISOString(),
    };
    const buyerCriteria = applyBuyerDocumentToCriteria(
      existing.buyerCriteria ?? {},
      kind,
      docRef
    );
    await updateDoc(doc(db, 'organizations', ctx.orgId, 'contacts', contactId), {
      buyerCriteria,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, ref: docRef };
  } catch (e) {
    console.warn('[contacts.uploadContactBuyerDocument] failed:', e);
    return { ok: false, error: 'upload_failed' };
  }
}

function applySellerDocumentToCriteria(
  criteria: ContactSellerCriteria,
  kind: ContactSellerDocumentKind,
  ref: ContactCriteriaDocumentRef
): ContactSellerCriteria {
  switch (kind) {
    case 'brokerage_contract':
      return { ...criteria, brokerageContractFile: ref };
    case 'ownership_proof':
      return { ...criteria, ownershipProofFile: ref };
    case 'seller_declaration':
      return { ...criteria, sellerDeclarationFile: ref };
    case 'req':
      return {
        ...criteria,
        corporateMandate: {
          isMandatory: criteria.corporateMandate?.isMandatory ?? true,
          companyName: criteria.corporateMandate?.companyName ?? '',
          reqNumber: criteria.corporateMandate?.reqNumber ?? '',
          reqFile: ref,
        },
      };
    default:
      return criteria;
  }
}

/**
 * Téléverse une pièce justificative vendeur (Storage + référence sur `sellerCriteria`).
 */
export async function uploadContactSellerDocument(
  ctx: ContactServiceContext,
  contactId: string,
  kind: ContactSellerDocumentKind,
  file: File
): Promise<
  | { ok: true; ref: ContactCriteriaDocumentRef }
  | { ok: false; error: 'forbidden' | 'not_found' | 'upload_failed' }
> {
  const existing = await getOrganizationContactById(ctx, contactId);
  if (!existing || !canWriteOrganizationContact(ctx, existing)) {
    return { ok: false, error: 'forbidden' };
  }

  const storagePath = buildContactSellerDocumentStoragePath(
    ctx.orgId,
    contactId,
    kind,
    file.name
  );
  try {
    const objectRef = ref(storage, storagePath);
    await uploadBytes(objectRef, file, {
      contentType: file.type || 'application/pdf',
      customMetadata: {
        orgId: ctx.orgId,
        contactId,
        scope: 'contact_seller_document',
        documentKind: kind,
        uploadedBy: ctx.uid,
      },
    });
    const url = await getDownloadURL(objectRef);
    const docRef: ContactCriteriaDocumentRef = {
      url,
      storagePath,
      uploadedAt: new Date().toISOString(),
    };
    const sellerCriteria = applySellerDocumentToCriteria(
      existing.sellerCriteria ?? {},
      kind,
      docRef
    );
    await updateDoc(doc(db, 'organizations', ctx.orgId, 'contacts', contactId), {
      sellerCriteria,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, ref: docRef };
  } catch (e) {
    console.warn('[contacts.uploadContactSellerDocument] failed:', e);
    return { ok: false, error: 'upload_failed' };
  }
}

/**
 * Liaison coacheteur bidirectionnelle atomique (`coBuyerIds` sur les deux fiches).
 */
export async function linkCoBuyer(
  ctx: ContactServiceContext,
  contactId: string,
  partnerContactId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const aId = contactId.trim();
  const bId = partnerContactId.trim();
  if (!aId || !bId || aId === bId) return { ok: false, error: 'invalid_args' };

  const [contactA, contactB] = await Promise.all([
    getOrganizationContactDoc(ctx, aId),
    getOrganizationContactDoc(ctx, bId),
  ]);
  if (!contactA || !contactB) return { ok: false, error: 'not_found' };
  if (!canWriteOrganizationContact(ctx, contactA)) {
    return { ok: false, error: 'forbidden' };
  }
  if (!canWriteOrganizationContact(ctx, contactB)) {
    return { ok: false, error: 'partner_not_writable' };
  }

  const now = new Date().toISOString();
  const refA = doc(db, 'organizations', ctx.orgId, 'contacts', aId);
  const refB = doc(db, 'organizations', ctx.orgId, 'contacts', bId);
  const batch = writeBatch(db);
  batch.update(refA, {
    coBuyerIds: syncAddCoBuyerId(contactA.coBuyerIds, bId),
    updatedAt: now,
  });
  batch.update(refB, {
    coBuyerIds: syncAddCoBuyerId(contactB.coBuyerIds, aId),
    updatedAt: now,
  });
  try {
    await batch.commit();
    return { ok: true };
  } catch (e) {
    console.warn('[contacts.linkCoBuyer] batch failed:', e);
    return { ok: false, error: 'batch_failed' };
  }
}

/**
 * Retrait coacheteur bidirectionnel atomique.
 */
export async function unlinkCoBuyer(
  ctx: ContactServiceContext,
  contactId: string,
  partnerContactId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const aId = contactId.trim();
  const bId = partnerContactId.trim();
  if (!aId || !bId) return { ok: false, error: 'invalid_args' };

  const [contactA, contactB] = await Promise.all([
    getOrganizationContactDoc(ctx, aId),
    getOrganizationContactDoc(ctx, bId),
  ]);
  if (!contactA || !contactB) return { ok: false, error: 'not_found' };
  if (!canWriteOrganizationContact(ctx, contactA)) {
    return { ok: false, error: 'forbidden' };
  }

  const now = new Date().toISOString();
  const refA = doc(db, 'organizations', ctx.orgId, 'contacts', aId);
  const batch = writeBatch(db);
  batch.update(refA, {
    coBuyerIds: syncRemoveCoBuyerId(contactA.coBuyerIds, bId),
    updatedAt: now,
  });
  if (canWriteOrganizationContact(ctx, contactB)) {
    const refB = doc(db, 'organizations', ctx.orgId, 'contacts', bId);
    batch.update(refB, {
      coBuyerIds: syncRemoveCoBuyerId(contactB.coBuyerIds, aId),
      updatedAt: now,
    });
  }
  try {
    await batch.commit();
    return { ok: true };
  } catch (e) {
    console.warn('[contacts.unlinkCoBuyer] batch failed:', e);
    return { ok: false, error: 'batch_failed' };
  }
}

/**
 * Liaison covendeur bidirectionnelle atomique (`coSellerIds` sur les deux fiches).
 */
export async function linkCoSeller(
  ctx: ContactServiceContext,
  contactId: string,
  partnerContactId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const aId = contactId.trim();
  const bId = partnerContactId.trim();
  if (!aId || !bId || aId === bId) return { ok: false, error: 'invalid_args' };

  const [contactA, contactB] = await Promise.all([
    getOrganizationContactDoc(ctx, aId),
    getOrganizationContactDoc(ctx, bId),
  ]);
  if (!contactA || !contactB) return { ok: false, error: 'not_found' };
  if (!canWriteOrganizationContact(ctx, contactA)) {
    return { ok: false, error: 'forbidden' };
  }
  if (!canWriteOrganizationContact(ctx, contactB)) {
    return { ok: false, error: 'partner_not_writable' };
  }

  const now = new Date().toISOString();
  const refA = doc(db, 'organizations', ctx.orgId, 'contacts', aId);
  const refB = doc(db, 'organizations', ctx.orgId, 'contacts', bId);
  const batch = writeBatch(db);
  batch.update(refA, {
    coSellerIds: syncAddCoSellerId(contactA.coSellerIds, bId),
    updatedAt: now,
  });
  batch.update(refB, {
    coSellerIds: syncAddCoSellerId(contactB.coSellerIds, aId),
    updatedAt: now,
  });
  try {
    await batch.commit();
    return { ok: true };
  } catch (e) {
    console.warn('[contacts.linkCoSeller] batch failed:', e);
    return { ok: false, error: 'batch_failed' };
  }
}

/**
 * Retrait covendeur bidirectionnel atomique.
 */
/**
 * Assigne un acheteur à un courtier (contact `broker`) — writeBatch atomique.
 * Met à jour `brokerCriteria.managedBuyerIds` et `ownerId` de l’acheteur (courtier responsable).
 */
export async function linkBuyerToBroker(
  ctx: ContactServiceContext,
  brokerContactId: string,
  buyerContactId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const brokerId = brokerContactId.trim();
  const buyerId = buyerContactId.trim();
  if (!brokerId || !buyerId || brokerId === buyerId) {
    return { ok: false, error: 'invalid_args' };
  }

  const [brokerContact, buyerContact] = await Promise.all([
    getOrganizationContactDoc(ctx, brokerId),
    getOrganizationContactDoc(ctx, buyerId),
  ]);
  if (!brokerContact || !buyerContact) return { ok: false, error: 'not_found' };
  if (!brokerContact.relationRoles?.includes('broker')) {
    return { ok: false, error: 'not_broker' };
  }
  if (!buyerContact.relationRoles?.includes('buyer')) {
    return { ok: false, error: 'not_buyer' };
  }
  if (!canWriteOrganizationContact(ctx, brokerContact)) {
    return { ok: false, error: 'forbidden' };
  }
  if (!canWriteOrganizationContact(ctx, buyerContact)) {
    return { ok: false, error: 'buyer_not_writable' };
  }

  const responsibleOwnerId = brokerContact.ownerId.trim();
  if (!responsibleOwnerId) return { ok: false, error: 'broker_owner_missing' };

  const now = new Date().toISOString();
  const refBroker = doc(db, 'organizations', ctx.orgId, 'contacts', brokerId);
  const refBuyer = doc(db, 'organizations', ctx.orgId, 'contacts', buyerId);
  const batch = writeBatch(db);
  batch.update(refBroker, {
    brokerCriteria: {
      ...brokerContact.brokerCriteria,
      managedBuyerIds: syncAddManagedBuyerId(
        brokerContact.brokerCriteria?.managedBuyerIds,
        buyerId
      ),
    },
    updatedAt: now,
  });
  batch.update(refBuyer, {
    ownerId: responsibleOwnerId,
    updatedAt: now,
  });
  try {
    await batch.commit();
    return { ok: true };
  } catch (e) {
    console.warn('[contacts.linkBuyerToBroker] batch failed:', e);
    return { ok: false, error: 'batch_failed' };
  }
}

/**
 * Retire un acheteur de la responsabilité d’un courtier (contact `broker`).
 */
export async function unlinkBuyerFromBroker(
  ctx: ContactServiceContext,
  brokerContactId: string,
  buyerContactId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const brokerId = brokerContactId.trim();
  const buyerId = buyerContactId.trim();
  if (!brokerId || !buyerId) return { ok: false, error: 'invalid_args' };

  const brokerContact = await getOrganizationContactDoc(ctx, brokerId);
  if (!brokerContact) return { ok: false, error: 'not_found' };
  if (!canWriteOrganizationContact(ctx, brokerContact)) {
    return { ok: false, error: 'forbidden' };
  }

  const now = new Date().toISOString();
  const refBroker = doc(db, 'organizations', ctx.orgId, 'contacts', brokerId);
  const batch = writeBatch(db);
  batch.update(refBroker, {
    brokerCriteria: {
      ...brokerContact.brokerCriteria,
      managedBuyerIds: syncRemoveManagedBuyerId(
        brokerContact.brokerCriteria?.managedBuyerIds,
        buyerId
      ),
    },
    updatedAt: now,
  });
  try {
    await batch.commit();
    return { ok: true };
  } catch (e) {
    console.warn('[contacts.unlinkBuyerFromBroker] batch failed:', e);
    return { ok: false, error: 'batch_failed' };
  }
}

export async function unlinkCoSeller(
  ctx: ContactServiceContext,
  contactId: string,
  partnerContactId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const aId = contactId.trim();
  const bId = partnerContactId.trim();
  if (!aId || !bId) return { ok: false, error: 'invalid_args' };

  const [contactA, contactB] = await Promise.all([
    getOrganizationContactDoc(ctx, aId),
    getOrganizationContactDoc(ctx, bId),
  ]);
  if (!contactA || !contactB) return { ok: false, error: 'not_found' };
  if (!canWriteOrganizationContact(ctx, contactA)) {
    return { ok: false, error: 'forbidden' };
  }

  const now = new Date().toISOString();
  const refA = doc(db, 'organizations', ctx.orgId, 'contacts', aId);
  const batch = writeBatch(db);
  batch.update(refA, {
    coSellerIds: syncRemoveCoSellerId(contactA.coSellerIds, bId),
    updatedAt: now,
  });
  if (canWriteOrganizationContact(ctx, contactB)) {
    const refB = doc(db, 'organizations', ctx.orgId, 'contacts', bId);
    batch.update(refB, {
      coSellerIds: syncRemoveCoSellerId(contactB.coSellerIds, aId),
      updatedAt: now,
    });
  }
  try {
    await batch.commit();
    return { ok: true };
  } catch (e) {
    console.warn('[contacts.unlinkCoSeller] batch failed:', e);
    return { ok: false, error: 'batch_failed' };
  }
}

/**
 * Réassignation d’un lead publicitaire — admin agence uniquement.
 */
export interface OrgBrokerOption {
  uid: string;
  displayName: string;
  email: string;
}

/** Courtiers de la même organisation (réassignation admin). */
export async function listOrganizationBrokers(orgId: string): Promise<OrgBrokerOption[]> {
  if (!orgId) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'users'), where('orgId', '==', orgId))
    );
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        displayName: String(data.displayName ?? data.email ?? d.id),
        email: String(data.email ?? ''),
      };
    });
  } catch (e) {
    console.warn('[contacts.listOrganizationBrokers] failed:', e);
    return [];
  }
}

export async function reassignContactOwner(
  ctx: ContactServiceContext,
  contactId: string,
  newOwnerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (ctx.role !== 'admin' && ctx.role !== 'admin_system') {
    return { ok: false, error: 'forbidden' };
  }

  const ref = doc(db, 'organizations', ctx.orgId, 'contacts', contactId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, error: 'not_found' };

  const data = snap.data();
  const leadSource = data.leadSource as ContactLeadSource;
  if (!canAdminReassignContactOwner(leadSource)) {
    return { ok: false, error: 'lead_not_redistributable' };
  }

  await updateDoc(ref, {
    ownerId: newOwnerId,
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
}

export interface LinkContactToResidenceParams {
  residenceId: string;
  residenceDoc: Record<string, unknown>;
  contactId: string;
  role: ResidencePartyRole;
}

/**
 * Liaison bidirectionnelle atomique : `partiesImpliquees` + `contact.residenceIds`.
 */
export async function linkContactToResidence(
  ctx: ContactServiceContext,
  params: LinkContactToResidenceParams
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { residenceId, residenceDoc, contactId, role } = params;
  if (!residenceId || !contactId) return { ok: false, error: 'invalid_args' };

  const contact = await getOrganizationContactById(ctx, contactId);
  if (!contact) return { ok: false, error: 'contact_not_found' };
  if (contact.ownerId !== ctx.uid) return { ok: false, error: 'forbidden' };

  const now = new Date().toISOString();
  const residenceRef = doc(db, 'residences', residenceId);
  const contactRef = doc(db, 'organizations', ctx.orgId, 'contacts', contactId);
  const residencePatch = buildAddPartiePatch(residenceDoc, { contactId, role });
  const residenceIds = syncAddResidenceIdToContact(contact.residenceIds, residenceId);

  const batch = writeBatch(db);
  batch.update(residenceRef, { ...residencePatch, updatedAt: now });
  batch.update(contactRef, { residenceIds, updatedAt: now });
  try {
    await batch.commit();
    return { ok: true };
  } catch (e) {
    console.warn('[contacts.linkContactToResidence] batch failed:', e);
    return { ok: false, error: 'batch_failed' };
  }
}

/**
 * Retrait bidirectionnel atomique d’un intervenant sur un dossier.
 */
export async function unlinkContactFromResidence(
  ctx: ContactServiceContext,
  params: Omit<LinkContactToResidenceParams, 'role'>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { residenceId, residenceDoc, contactId } = params;
  if (!residenceId || !contactId) return { ok: false, error: 'invalid_args' };

  const contact = await getOrganizationContactById(ctx, contactId);
  if (!contact) return { ok: false, error: 'contact_not_found' };
  if (contact.ownerId !== ctx.uid) return { ok: false, error: 'forbidden' };

  const now = new Date().toISOString();
  const residenceRef = doc(db, 'residences', residenceId);
  const contactRef = doc(db, 'organizations', ctx.orgId, 'contacts', contactId);
  const residencePatch = buildRemovePartiePatch(residenceDoc, contactId);
  const residenceIds = syncRemoveResidenceIdFromContact(contact.residenceIds, residenceId);

  const batch = writeBatch(db);
  batch.update(residenceRef, { ...residencePatch, updatedAt: now });
  batch.update(contactRef, { residenceIds, updatedAt: now });
  try {
    await batch.commit();
    return { ok: true };
  } catch (e) {
    console.warn('[contacts.unlinkContactFromResidence] batch failed:', e);
    return { ok: false, error: 'batch_failed' };
  }
}
