/**
 * Import contacts legacy (Copilote `contacts/` + `vendors/`) → V2 `OrganizationContact`.
 * Logique pure — exécution Firestore dans scripts/migrate-legacy-contacts-to-v2.mjs
 */

import type {
  BuyerQualificationStatus,
  ContactAddress,
  ContactAssetNiche,
  ContactBuyerCriteria,
  ContactLciFieldKey,
  ContactRelationRole,
  ContactSilo,
  ContactVisibility,
} from './contactTypes';

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

export interface LegacyImportMeta {
  legacySources: Array<{ collection: LegacyContactSourceCollection; id: string }>;
  mergedCount: number;
  lciIncomplete: boolean;
  missingLciFields: ContactLciFieldKey[];
  importedAt?: string;
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
  notes?: string;
  importMeta: LegacyImportMeta;
}

export interface LegacyContactDedupeStats {
  legacyContactsCount: number;
  legacyVendorsCount: number;
  legacyTotalRaw: number;
  duplicateGroups: number;
  recordsMergedAway: number;
  finalReadyCount: number;
  withEmailKey: number;
  withPhoneKeyOnly: number;
  withoutDedupeKey: number;
  lciIncompleteCount: number;
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

  if (roles.size === 0 && data.source === 'vendors') roles.add('seller');
  if (roles.size === 0) roles.add('buyer');
  return Array.from(roles);
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

  const relationRoles = mapLegacyRelationRoles(data);
  const email = normalizeImportEmail(data.courriel ?? data.email) ?? undefined;
  const telephone =
    normalizeImportPhone(data.telephone ?? data.cellulaire ?? data.phone ?? data.mobile) ?? undefined;

  const residenceIds = Array.isArray(data.residenceIds)
    ? [...new Set(data.residenceIds.map(String).filter(Boolean))]
    : undefined;

  const notesParts = [
    pickString(data.notes, data.note),
    row.source === 'vendors' ? `[Import legacy: vendors/${row.legacyId}]` : `[Import legacy: contacts/${row.legacyId}]`,
  ].filter(Boolean);

  return {
    orgId: ctx.orgId,
    ownerId: ctx.ownerId,
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

  return {
    ...primary,
    prenom: primary.prenom || secondary.prenom,
    email: primary.email || secondary.email,
    telephone: primary.telephone || secondary.telephone,
    relationRoles: Array.from(roleSet),
    residenceIds: residenceSet.size ? Array.from(residenceSet) : undefined,
    buyerQualificationStatus,
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

export function dedupeLegacyRows(
  rows: LegacyRawContactRow[],
  ctx: { orgId: string; ownerId: string; visibility: ContactVisibility }
): { payloads: LegacyContactV2Payload[]; stats: LegacyContactDedupeStats } {
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
    let merged = legacyRowToV2Payload(sorted[0], ctx);
    merged.importMeta.mergedCount = 1;
    for (let i = 1; i < sorted.length; i++) {
      const next = legacyRowToV2Payload(sorted[i], ctx);
      merged = mergePayloads(merged, next);
    }
    payloads.push(merged);
  }

  for (const row of orphanRows) {
    payloads.push(legacyRowToV2Payload(row, ctx));
  }

  const lciIncompleteCount = payloads.filter((p) => p.importMeta.lciIncomplete).length;

  return {
    payloads,
    stats: {
      legacyContactsCount: contacts.length,
      legacyVendorsCount: vendors.length,
      legacyTotalRaw: rows.length,
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
