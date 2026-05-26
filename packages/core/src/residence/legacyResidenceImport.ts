/**
 * Migration résidences Legacy (Copilote) → V2 — Maillon 2 (DATA_MAPPING_LEGACY_V2.md §2).
 *
 * - Statut pipeline → enum canonique Firestore
 * - courtiersResponsables (UID V2)
 * - Liaison vendeur : partiesImpliquees VENDEUR + contact.residenceIds
 */

import { normalizeImportEmail, normalizeImportPhone } from '../crm/legacyContactImport';
import type { PartieImpliquee } from './partiesImpliquees';
import { syncAddResidenceIdToContact } from './partiesImpliquees';

/** Statuts persistés Firestore — aligné `src/config/pipelineStages.ts`. */
export type LegacyResidenceStatus =
  | 'prospect'
  | 'mandate'
  | 'promise'
  | 'expired'
  | 'unsigned'
  | 'sold';

export interface LegacyResidenceRow {
  legacyId: string;
  data: Record<string, unknown>;
}

export interface V2ContactLookupEntry {
  contactId: string;
  email?: string;
  telephone?: string;
  legacyContactIds: string[];
  residenceIds?: string[];
  relationRoles?: string[];
}

export type SellerMatchMethod =
  | 'legacy_contact_id'
  | 'email'
  | 'phone'
  | 'contact_residence_ids'
  | null;

export interface SellerMatchResult {
  contactId: string | null;
  method: SellerMatchMethod;
  /** Indices utilisés (debug dry-run). */
  hints: string[];
}

export interface LegacyResidenceMigrationRow {
  legacyId: string;
  status: LegacyResidenceStatus;
  statusLegacyRaw: string;
  /** Fiche inventaire / référence Copilote (`archive`, `sans status`, etc.). */
  catalogReference: boolean;
  courtiersResponsables: string;
  name: string;
  askingPrice: number | null;
  address?: string;
  city?: string;
  sellerMatch: SellerMatchResult;
  partiesImpliquees: PartieImpliquee[];
  /** Mise à jour bidirectionnelle prévue sur le contact V2. */
  contactResidenceIdsUpdate: { contactId: string; residenceIds: string[] } | null;
  importMeta: {
    legacyResidenceId: string;
    sellerOrphan: boolean;
    brokerResolvedFrom: string;
    catalogReference: boolean;
    nameSource: string;
    priceSource: string | null;
    legacyBrokerToken: string;
  };
}

export interface LegacyResidenceMigrationStats {
  legacyResidenceCount: number;
  sellerMatches: number;
  sellerOrphans: number;
  withOwnerIdsHint: number;
  withEmailHint: number;
  statusCounts: Record<string, number>;
}

export interface LegacyResidenceMigrationPlan {
  rows: LegacyResidenceMigrationRow[];
  stats: LegacyResidenceMigrationStats;
}

const PIPELINE_COLUMN_SET = new Set(['prospect', 'mandate', 'promise', 'sold']);

const LEGACY_STATUT_TO_COLUMN: Record<string, LegacyResidenceStatus> = {
  prospection: 'prospect',
  prospect: 'prospect',
  lead: 'prospect',
  qualification: 'prospect',
  mandat: 'mandate',
  'en-mandat': 'mandate',
  actif: 'mandate',
  listed: 'mandate',
  promesse: 'promise',
  'promesse-achat': 'promise',
  'pa-acceptee': 'promise',
  'due-diligence': 'promise',
  financement: 'promise',
  'transfert-permis': 'promise',
  vendu: 'sold',
  vendue: 'sold',
  cloture: 'sold',
  fermee: 'sold',
  fermée: 'sold',
  clos: 'sold',
  success: 'sold',
  succes: 'sold',
  abandonne: 'expired',
  abandonné: 'expired',
  'hors-marche': 'expired',
  mailling: 'prospect',
};

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function toPositiveNumber(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === 'string') {
    const cleaned = raw
      .trim()
      .replace(/\s/g, '')
      .replace(/[^\d.,-]/g, '')
      .replace(',', '.');
    const n = Number(cleaned);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

const CATALOG_LEGACY_STATUSES = new Set(['archive', 'sans status', 'sans statut']);

/**
 * Identité commerciale + prix demandé (priorités PO / canon V2).
 */
export function mapLegacyResidenceIdentity(data: Record<string, unknown>): {
  name: string;
  askingPrice: number | null;
  address?: string;
  city?: string;
  nameSource: string;
  priceSource: string | null;
} {
  const nameCandidates: { key: string; value: unknown }[] = [
    { key: 'nomResidence', value: data.nomResidence },
    { key: 'nom', value: data.nom },
    { key: 'residenceName', value: data.residenceName },
    { key: 'name', value: data.name },
    { key: 'nomCommercial', value: data.nomCommercial },
    { key: 'commercialName', value: data.commercialName },
  ];
  let name = '';
  let nameSource = '';
  for (const { key, value } of nameCandidates) {
    if (typeof value === 'string' && value.trim()) {
      name = value.trim();
      nameSource = key;
      break;
    }
  }

  const priceCandidates: { key: string; value: unknown }[] = [
    { key: 'prixAnnonce', value: data.prixAnnonce },
    { key: 'askingPrice', value: data.askingPrice },
    { key: 'prixDemande', value: data.prixDemande },
  ];
  let askingPrice: number | null = null;
  let priceSource: string | null = null;
  for (const { key, value } of priceCandidates) {
    const n = toPositiveNumber(value);
    if (n != null) {
      askingPrice = n;
      priceSource = key;
      break;
    }
  }

  const address = pickString(data.adresse, data.address) || undefined;
  const city = pickString(data.ville, data.city, data.municipalite) || undefined;

  return { name, askingPrice, address, city, nameSource, priceSource };
}

/** Extrait le statut pipeline brut (champs hérités Copilote). */
export function extractLegacyPipelineStatusRaw(data: Record<string, unknown>): string {
  return pickString(data.status, data.pipelineStatus, data.etat, data.phase, data.stage, data.statut);
}

/**
 * Résout le statut canonique V2 (migration Maillon 2).
 * `archive` / `sans status` → `prospect` + inventaire catalogue (`catalogReference`).
 */
export function mapLegacyResidenceStatus(data: Record<string, unknown>): {
  status: LegacyResidenceStatus;
  raw: string;
  catalogReference: boolean;
} {
  const raw = extractLegacyPipelineStatusRaw(data);
  const normalized = raw.toLowerCase();

  if (!normalized) {
    return { status: 'prospect', raw, catalogReference: true };
  }

  if (normalized === 'unsigned') return { status: 'unsigned', raw, catalogReference: false };

  if (
    normalized === 'non signé' ||
    stripDiacritics(normalized) === 'non signe'
  ) {
    return { status: 'unsigned', raw, catalogReference: false };
  }

  if (CATALOG_LEGACY_STATUSES.has(normalized)) {
    return { status: 'prospect', raw, catalogReference: true };
  }

  if (
    normalized === 'expired' ||
    normalized === 'expiré' ||
    normalized === 'expirée' ||
    normalized === 'expire' ||
    normalized === 'expires' ||
    stripDiacritics(normalized).includes('expir') ||
    LEGACY_STATUT_TO_COLUMN[normalized] === 'expired'
  ) {
    return { status: 'expired', raw, catalogReference: false };
  }

  if (PIPELINE_COLUMN_SET.has(normalized)) {
    return {
      status: normalized as LegacyResidenceStatus,
      raw,
      catalogReference: false,
    };
  }

  if (LEGACY_STATUT_TO_COLUMN[normalized]) {
    return {
      status: LEGACY_STATUT_TO_COLUMN[normalized],
      raw,
      catalogReference: false,
    };
  }

  const slug = stripDiacritics(normalized).replace(/[^a-z0-9]+/g, '');
  if (slug.includes('mandat')) return { status: 'mandate', raw, catalogReference: false };
  if (slug.includes('promess') || slug.includes('promis')) {
    return { status: 'promise', raw, catalogReference: false };
  }
  if (slug.includes('vendu') || slug.includes('vendue') || slug.includes('sold')) {
    return { status: 'sold', raw, catalogReference: false };
  }
  if (slug.includes('expir') || slug.includes('abandon')) {
    return { status: 'expired', raw, catalogReference: false };
  }
  if (slug.includes('prospect') || slug.includes('prosp') || slug.includes('lead')) {
    return { status: 'prospect', raw, catalogReference: false };
  }

  return { status: 'prospect', raw, catalogReference: false };
}

const UID_LIKE = /^[a-zA-Z0-9]{20,}$/;

/** Noms courtiers legacy → UID V2 (production). */
export function buildDefaultBrokerNameToUid(
  defaultOwnerId: string
): Record<string, string> {
  const norm = (s: string) => stripDiacritics(s).toLowerCase().trim();
  const alain = norm('Alain St-Jean');
  return {
    [alain]: defaultOwnerId,
    [norm('Alain St Jean')]: defaultOwnerId,
    [norm('alain st-jean')]: defaultOwnerId,
  };
}

/**
 * Résout `courtiersResponsables` — UID Firebase V2 (string canonique).
 *
 * Option B (PO) : migration agence — tout rapatrier sous `defaultOwnerId`
 * (anciens UIDs équipe + libellés « Alain St-Jean » inclus).
 */
export function resolveLegacyCourtiersResponsables(
  data: Record<string, unknown>,
  defaultOwnerId: string,
  _brokerNameToUid: Record<string, string> = buildDefaultBrokerNameToUid(defaultOwnerId)
): { uid: string; resolvedFrom: string; legacyBrokerToken: string } {
  const raw =
    data.courtiersResponsables ??
    data.courtierResponsable ??
    data.brokerId ??
    data.assignedTo;
  let token = '';
  if (Array.isArray(raw) && raw[0]) token = String(raw[0]).trim();
  else if (typeof raw === 'string') token = raw.trim();

  if (!token) {
    return {
      uid: defaultOwnerId,
      resolvedFrom: 'migrate_force_owner:empty',
      legacyBrokerToken: '',
    };
  }

  if (token === defaultOwnerId) {
    return {
      uid: defaultOwnerId,
      resolvedFrom: 'migrate_force_owner:already_v2_uid',
      legacyBrokerToken: token,
    };
  }

  if (UID_LIKE.test(token)) {
    return {
      uid: defaultOwnerId,
      resolvedFrom: `migrate_force_owner:legacy_uid:${token}`,
      legacyBrokerToken: token,
    };
  }

  return {
    uid: defaultOwnerId,
    resolvedFrom: `migrate_force_owner:legacy_label:${token}`,
    legacyBrokerToken: token,
  };
}

export interface SellerHints {
  legacyContactIds: string[];
  emails: string[];
  phones: string[];
  hintKeys: string[];
}

/** Indices vendeur extraits d'une résidence legacy (owners, courriels, ownerIds…). */
export function extractLegacySellerHints(data: Record<string, unknown>): SellerHints {
  const legacyContactIds: string[] = [];
  const emails: string[] = [];
  const phones: string[] = [];
  const hintKeys: string[] = [];

  const pushId = (id: unknown, key: string) => {
    if (typeof id !== 'string' || !id.trim()) return;
    legacyContactIds.push(id.trim());
    hintKeys.push(key);
  };

  const pushEmail = (raw: unknown, key: string) => {
    const e = normalizeImportEmail(raw);
    if (!e) return;
    emails.push(e);
    hintKeys.push(key);
  };

  const pushPhone = (raw: unknown, key: string) => {
    const p = normalizeImportPhone(raw);
    if (!p) return;
    phones.push(p);
    hintKeys.push(key);
  };

  if (Array.isArray(data.ownerIds)) {
    for (const id of data.ownerIds) pushId(id, 'ownerIds');
  }
  if (Array.isArray(data.owners)) {
    for (const row of data.owners) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      pushId(o.contactId ?? o.id, 'owners.contactId');
      pushEmail(o.email ?? o.courriel, 'owners.email');
      pushPhone(o.telephone ?? o.phone, 'owners.phone');
    }
  }

  pushId(data.contactPrincipalContactId, 'contactPrincipalContactId');
  pushId(data.contactPrincipalId, 'contactPrincipalId');
  pushId(data.contactSecondaireContactId, 'contactSecondaireContactId');
  pushId(data.vendeurId, 'vendeurId');
  pushId(data.vendeurContactId, 'vendeurContactId');

  pushEmail(data.vendeurEmail, 'vendeurEmail');
  pushEmail(data.ownerEmail, 'ownerEmail');
  pushEmail(data.emailVendeur, 'emailVendeur');
  pushEmail(data.courrielProprietaire, 'courrielProprietaire');
  pushEmail(data.courrielProprietaire2, 'courrielProprietaire2');
  pushEmail(data.coVendeurEmail, 'coVendeurEmail');
  pushEmail(data.coVendeurCourriel, 'coVendeurCourriel');

  pushPhone(data.telephoneProprietaire, 'telephoneProprietaire');
  pushPhone(data.telephoneProprietaire2, 'telephoneProprietaire2');
  pushPhone(data.telephoneVendeur, 'telephoneVendeur');
  pushPhone(data.coVendeurTelephone, 'coVendeurTelephone');

  return {
    legacyContactIds: [...new Set(legacyContactIds)],
    emails: [...new Set(emails)],
    phones: [...new Set(phones)],
    hintKeys,
  };
}

export interface ContactLookupIndex {
  byLegacyContactId: Map<string, string>;
  byEmail: Map<string, string>;
  byPhone: Map<string, string>;
  /** Contact V2 déjà lié via `residenceIds` (Phase 1). */
  byResidenceId: Map<string, string>;
}

export function buildContactLookupIndex(entries: V2ContactLookupEntry[]): ContactLookupIndex {
  const byLegacyContactId = new Map<string, string>();
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  const byResidenceId = new Map<string, string>();

  for (const entry of entries) {
    for (const legacyId of entry.legacyContactIds) {
      if (!byLegacyContactId.has(legacyId)) byLegacyContactId.set(legacyId, entry.contactId);
    }
    const email = normalizeImportEmail(entry.email);
    if (email && !byEmail.has(email)) byEmail.set(email, entry.contactId);
    const phone = normalizeImportPhone(entry.telephone);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, entry.contactId);
    for (const residenceId of entry.residenceIds ?? []) {
      const rid = residenceId.trim();
      if (!rid) continue;
      const existing = byResidenceId.get(rid);
      const isSeller = entry.relationRoles?.includes('seller');
      if (!existing || isSeller) byResidenceId.set(rid, entry.contactId);
    }
  }

  return { byLegacyContactId, byEmail, byPhone, byResidenceId };
}

/** Enrichit les indices vendeur via la collection legacy `contacts/` (courriel / tél.). */
export function enrichSellerHintsWithLegacyContacts(
  hints: SellerHints,
  legacyContactById: Map<string, Record<string, unknown>>
): SellerHints {
  const emails = [...hints.emails];
  const phones = [...hints.phones];
  const hintKeys = [...hints.hintKeys];

  for (const legacyId of hints.legacyContactIds) {
    const data = legacyContactById.get(legacyId);
    if (!data) continue;
    const e = normalizeImportEmail(data.email ?? data.courriel ?? data.courrielContact);
    if (e) {
      emails.push(e);
      hintKeys.push(`contacts/${legacyId}.email`);
    }
    const p = normalizeImportPhone(data.telephone ?? data.phone ?? data.telephoneContact);
    if (p) {
      phones.push(p);
      hintKeys.push(`contacts/${legacyId}.phone`);
    }
  }

  return {
    ...hints,
    emails: [...new Set(emails)],
    phones: [...new Set(phones)],
    hintKeys,
  };
}

export function resolveSellerContactMatch(
  hints: SellerHints,
  index: ContactLookupIndex,
  residenceLegacyId?: string
): SellerMatchResult {
  for (const legacyId of hints.legacyContactIds) {
    const contactId = index.byLegacyContactId.get(legacyId);
    if (contactId) {
      return { contactId, method: 'legacy_contact_id', hints: hints.hintKeys };
    }
  }
  for (const email of hints.emails) {
    const contactId = index.byEmail.get(email);
    if (contactId) {
      return { contactId, method: 'email', hints: hints.hintKeys };
    }
  }
  for (const phone of hints.phones) {
    const contactId = index.byPhone.get(phone);
    if (contactId) {
      return { contactId, method: 'phone', hints: hints.hintKeys };
    }
  }
  if (residenceLegacyId) {
    const contactId = index.byResidenceId.get(residenceLegacyId);
    if (contactId) {
      return {
        contactId,
        method: 'contact_residence_ids',
        hints: [...hints.hintKeys, 'contact.residenceIds'],
      };
    }
  }
  return { contactId: null, method: null, hints: hints.hintKeys };
}

export function buildLegacyResidenceMigrationPlan(
  legacyRows: LegacyResidenceRow[],
  contactEntries: V2ContactLookupEntry[],
  options: {
    defaultOwnerId: string;
    brokerNameToUid?: Record<string, string>;
    legacyContactById?: Map<string, Record<string, unknown>>;
  }
): LegacyResidenceMigrationPlan {
  const index = buildContactLookupIndex(contactEntries);
  const brokerMap =
    options.brokerNameToUid ?? buildDefaultBrokerNameToUid(options.defaultOwnerId);

  const statusCounts: Record<string, number> = {};
  let sellerMatches = 0;
  let sellerOrphans = 0;
  let withOwnerIdsHint = 0;
  let withEmailHint = 0;

  const rows: LegacyResidenceMigrationRow[] = legacyRows.map((row) => {
    const { status, raw, catalogReference } = mapLegacyResidenceStatus(row.data);
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    const identity = mapLegacyResidenceIdentity(row.data);

    const broker = resolveLegacyCourtiersResponsables(
      row.data,
      options.defaultOwnerId,
      brokerMap
    );
    let sellerHints = extractLegacySellerHints(row.data);
    if (options.legacyContactById) {
      sellerHints = enrichSellerHintsWithLegacyContacts(sellerHints, options.legacyContactById);
    }
    if (sellerHints.legacyContactIds.length) withOwnerIdsHint += 1;
    if (sellerHints.emails.length) withEmailHint += 1;

    const sellerMatch = resolveSellerContactMatch(sellerHints, index, row.legacyId);
    const assigneLe = new Date().toISOString();

    let partiesImpliquees: PartieImpliquee[] = [];
    let contactResidenceIdsUpdate: LegacyResidenceMigrationRow['contactResidenceIdsUpdate'] =
      null;

    if (sellerMatch.contactId) {
      sellerMatches += 1;
      partiesImpliquees = [
        {
          contactId: sellerMatch.contactId,
          role: 'VENDEUR',
          assigneLe,
        },
      ];
      const entry = contactEntries.find((c) => c.contactId === sellerMatch.contactId);
      contactResidenceIdsUpdate = {
        contactId: sellerMatch.contactId,
        residenceIds: syncAddResidenceIdToContact(entry?.residenceIds, row.legacyId),
      };
    } else {
      sellerOrphans += 1;
    }

    return {
      legacyId: row.legacyId,
      status,
      statusLegacyRaw: raw,
      catalogReference,
      courtiersResponsables: broker.uid,
      name: identity.name,
      askingPrice: identity.askingPrice,
      address: identity.address,
      city: identity.city,
      sellerMatch,
      partiesImpliquees,
      contactResidenceIdsUpdate,
      importMeta: {
        legacyResidenceId: row.legacyId,
        sellerOrphan: !sellerMatch.contactId,
        brokerResolvedFrom: broker.resolvedFrom,
        catalogReference,
        nameSource: identity.nameSource,
        priceSource: identity.priceSource,
        legacyBrokerToken: broker.legacyBrokerToken,
      },
    };
  });

  return {
    rows,
    stats: {
      legacyResidenceCount: legacyRows.length,
      sellerMatches,
      sellerOrphans,
      withOwnerIdsHint,
      withEmailHint,
      statusCounts,
    },
  };
}
