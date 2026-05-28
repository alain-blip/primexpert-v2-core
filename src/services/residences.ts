/**
 * residences.ts — Service multi-tenant pour la collection `residences`
 *
 * Brief « SYSTÈME SILOS 2026 v4 » §5 — preuve de vie multi-tenant
 * Charte v2026.2 §IV — Source de Vérité Pipeline
 *
 * Toute query sur `residences` PASSE par ce service.
 * Garantie : un courtier ne voit JAMAIS les résidences d'un autre courtier.
 *
 * Le filtrage client (via @primexpert/core/tenant) est DOUBLÉ par les
 * Firestore Security Rules côté serveur (à mettre en place en Phase C).
 */

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { tenantConstraints, TENANT_FIELD, type TenantContext } from '@primexpert/core/tenant';
import {
  extractResidenceAddressAndCities,
  filterResidencesBySearchQuery,
} from '@primexpert/core/residence';
import type {
  ResidenceLegalNode,
  ResidenceBuildingNode,
  ResidenceOperationsNode,
} from '@primexpert/core/residence';
import { buildResidenceTenantContext, isAgencyAdminRole } from '../lib/tenantContext';

export { buildResidenceTenantContext, isAgencyAdminRole };
import type { AssetNiche, AssetNicheMetadata, AssetSyndication } from '../types/residence';
import { parseAssetNiche, residenceMatchesNiche } from '../types/residence';
import type { RadarPropertyType } from '../types/radarAccess';
import {
  buildPipelineStatusFirestorePatch,
  extractPipelineStatusRaw,
  isPipelineActiveStatus,
  PIPELINE_ACTIVE_STATUSES,
  resolveResidenceStatus,
  type PipelineColumnId,
  type ResidenceStatus,
} from '../config/pipelineStages';

function parseRadarPropertyType(raw: unknown): RadarPropertyType | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase();
  if (v === 'rpa' || v === 'cpe' || v === 'plex' || v === 'commercial') return v;
  return undefined;
}

/** Options requêtes résidences — cloison silo (CPE/Plex indexés ; RPA inclut legacy sans champ). */
export interface ResidenceQueryOpts {
  silo?: AssetNiche;
}

function applySiloFilter(rows: Residence[], silo: AssetNiche | undefined): Residence[] {
  if (!silo) return rows;
  return rows.filter((r) => residenceMatchesNiche(r.assetNiche, silo));
}

/** Fiche inventaire catalogue (migration Legacy `archive` / `sans status`). */
export function isResidenceCatalogReference(row: Residence): boolean {
  return row.catalogReference === true;
}

/** Exclut les fiches catalogue — pipeline chaud et tableau de bord uniquement. */
export function excludeCatalogReferenceResidences(rows: Residence[]): Residence[] {
  return rows.filter((r) => !isResidenceCatalogReference(r));
}

export type { ResidenceStatus } from '../config/pipelineStages';

/**
 * Forme minimale d'une résidence côté UI V2.
 * Reflet partiel de Copilote-RPA `dbSchema.js` TRANSACTION_FIELDS.
 */
export interface Residence {
  id: string;
  address: string;
  city: string;
  ville?: string;
  municipalite?: string;
  price: number;
  /** Nom commercial affiché sur les cartes d'inscription, si distinct de l'adresse. */
  residenceName?: string;
  nomCommercial?: string;
  nom_commercial?: string;
  commercialName?: string;
  name?: string;
  askingPrice?: number;
  prixDemande?: number;
  commissionRate?: number;
  potentialRevenue?: number;
  status: ResidenceStatus;
  date: string;
  /** Multi-tenant : doit toujours contenir le brokerId du propriétaire de la fiche. */
  courtiersResponsables?: string;
  /** Champs identité — conformité mandat / matching. */
  unitesRPA?: number;
  nombreUnitesTotal?: number;
  tauxOccupation?: number;
  certificationsCiusss?: string[];
  revenuBrutEffectif?: number;
  revenuNetExploitation?: number;
  unitsCount?: number;
  nombreUnites?: number;
  region?: string;
  residenceType?: string;
  type?: string;
  contratCourtage?: {
    commissionPourcentage?: number;
    commissionEquipe?: number;
    commissionCollaborateur?: number;
  };
  /** Prix accepté (promesse d'achat) — garde-fou glisser-déposer. */
  prixAccepte?: number;
  /** Niche active (RPA / CPE / PLEX). Absent = visible dans toutes les vues. */
  assetNiche?: AssetNiche;
  /** Type Radar explicite (sinon déduit de `assetNiche`). */
  propertyType?: RadarPropertyType;
  nicheMetadata?: AssetNicheMetadata;
  syndication?: AssetSyndication;
  /** Inventaire référence Copilote (ex-`archive`) — exclu du pipeline chaud et du tableau de bord. */
  catalogReference?: boolean;
  /** SSOT Bilan 360 — nœuds canoniques enrichis. */
  legal?: ResidenceLegalNode;
  building?: ResidenceBuildingNode;
  operations?: ResidenceOperationsNode;
}

export { PIPELINE_ACTIVE_STATUSES };

const PAGE_SIZE_DEFAULT = 50;

/** Valeurs `status` côté Firestore pour `in` (charte + héritage Copilote / FR). Max 30 pour Firestore. */
const FIRESTORE_PIPELINE_STATUS_IN: readonly string[] = [
  ...PIPELINE_ACTIVE_STATUSES,
  'Prospection',
  'prospection',
  'Mandat',
  'mandat',
  'Promesse',
  'promesse',
  'Expiré',
  'expiré',
  'Expirée',
  'expirée',
  'Vendu',
  'vendu',
  'Vendue',
  'vendue',
  'En prospection',
  'en prospection',
  'En mandat',
  'en mandat',
  'En promesse',
  'en promesse',
];

function mapLegacyPrice(data: DocumentData): number {
  const candidates: unknown[] = [
    data.price,
    data.prixAnnonce,
    data.askingPrice,
    data.estimatedValue,
    data.estimated_value,
    data.valeurEstimee,
    data.valeur_estimee,
    data.prixDemande,
    data.prixListe,
    data.listPrice,
    data.prix,
    data.montant,
    data.asking,
    data.prixAffiche,
  ];
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    if (typeof c === 'number' && Number.isFinite(c) && c >= 0) return c;
    if (typeof c === 'string') {
      const cleaned = c
        .trim()
        .replace(/\s/g, '')
        .replace(/[^\d.,-]/g, '')
        .replace(',', '.');
      const n = Number(cleaned);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return 0;
}

/** Patch Firestore canonique — prix d'inscription (SSOT fiche résidence). */
export function buildListingPriceFirestorePatch(amount: number): {
  price: number;
  prixAnnonce: number;
  askingPrice: number;
  prixDemande: number;
} {
  const n = Math.max(0, Math.round(amount));
  return {
    price: n,
    prixAnnonce: n,
    askingPrice: n,
    prixDemande: n,
  };
}

/** Patch Firestore — rétribution courtier (taux globaux et parts). */
export function buildCommissionFirestorePatch(input: {
  totalePct: number;
  inscripteurPct: number;
  collaborateurPct: number;
}): {
  commissionRate: number;
  tauxCommission: number;
  commissionPct: number;
  commission: {
    totalePct: number;
    inscripteurPct: number;
    collaborateurPct: number;
  };
} {
  const totalePct = Math.max(0, input.totalePct);
  const inscripteurPct = Math.max(0, input.inscripteurPct);
  const collaborateurPct = Math.max(0, input.collaborateurPct);
  return {
    commissionRate: totalePct,
    tauxCommission: totalePct,
    commissionPct: totalePct,
    commission: {
      totalePct,
      inscripteurPct,
      collaborateurPct,
    },
  };
}

function mapLegacyNumber(...candidates: unknown[]): number | undefined {
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    if (typeof c === 'number' && Number.isFinite(c) && c >= 0) return c;
    if (typeof c === 'string') {
      const cleaned = c
        .trim()
        .replace(/\s/g, '')
        .replace(/[^\d.,-]/g, '')
        .replace(',', '.');
      const n = Number(cleaned);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return undefined;
}

function mapLegacyInteger(...candidates: unknown[]): number | undefined {
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    if (typeof c === 'number' && Number.isFinite(c)) {
      const n = parseInt(String(c), 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    if (typeof c === 'string') {
      const cleaned = c.trim().replace(/\s/g, '').replace(/[^\d-]/g, '');
      if (!cleaned) continue;
      const n = parseInt(cleaned, 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return undefined;
}

function mapLegacyFloat(...candidates: unknown[]): number | undefined {
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    if (typeof c === 'number' && Number.isFinite(c)) {
      const n = parseFloat(String(c));
      if (Number.isFinite(n) && n >= 0) return n;
    }
    if (typeof c === 'string') {
      const cleaned = c
        .trim()
        .replace(/\s/g, '')
        .replace(/[^\d.,-]/g, '')
        .replace(',', '.');
      if (!cleaned) continue;
      const n = parseFloat(cleaned);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return undefined;
}

function mapLegacyStringArray(...candidates: unknown[]): string[] | undefined {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const values = candidate
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean);
      if (values.length) return [...new Set(values)];
      continue;
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const values = candidate
        .split(/[;,|]/)
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length) return [...new Set(values)];
    }
  }
  return undefined;
}

function mapCommercialName(data: DocumentData): string | undefined {
  const candidates: unknown[] = [
    data.nomResidence,
    data.nom,
    data.residenceName,
    data.commercialName,
    data.nomCommercial,
    data.nom_commercial,
    data.name,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed && trimmed !== '—') return trimmed;
  }
  return undefined;
}

function mapResidenceDoc(doc: DocumentSnapshot<DocumentData>): Residence {
  const data = doc.data();
  const metaRaw = data.nicheMetadata;
  const meta =
    metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)
      ? (metaRaw as AssetNicheMetadata)
      : undefined;
  const synRaw = data.syndication ?? data.marketingSyndication;
  const syndication =
    synRaw && typeof synRaw === 'object' && !Array.isArray(synRaw)
      ? (synRaw as AssetSyndication)
      : undefined;
  const commercialName = mapCommercialName(data);
  const price = mapLegacyPrice(data);
  const commissionRate = mapLegacyNumber(
    data.commissionRate,
    data.tauxCommission,
    data.commissionPct,
    data.commission?.totalePct,
    data.commission?.inscripteurPct
  );
  const potentialRevenue = mapLegacyNumber(
    data.potentialRevenue,
    data.revenuPotentiel,
    data.revenuPotentielCommission,
    data.revenuPotentielAnnuel,
    data.revenusPotentiels
  );
  const unitesRPA = mapLegacyInteger(
    data.unitesRPA,
    data.nombreUnitesTotal,
    data.unitsCount,
    data.nombreUnites,
    data.nombreUnitesRPA,
    data.unites,
    data.capacite
  );
  const tauxOccupation = mapLegacyFloat(
    data.tauxOccupation,
    data.taux_occupation,
    data.occupationRate,
    data.occupancyRate,
    data.operations?.tauxOccupation,
    data.operations?.occupancyRate
  );
  const certificationsCiusss = mapLegacyStringArray(
    data.certificationsCiusss,
    data.certificationCiusss,
    data.certificationCIUSSS,
    data.certificationsCIUSSS,
    data.operations?.certificationsCiusss
  );
  const revenuBrutEffectif = mapLegacyFloat(
    data.revenuBrutEffectif,
    data.rbe,
    data.revenus?.revenuBrutEffectif,
    data.financial?.calculatedResults?.revenuBrutEffectif,
    data.financial?.calculatedResults?.revenusAnnuels
  );
  const revenuNetExploitation = mapLegacyFloat(
    data.revenuNetExploitation,
    data.rne,
    data.revenus?.revenuNetExploitation,
    data.financial?.calculatedResults?.revenuNetExploitation
  );
  const loc = extractResidenceAddressAndCities(data as Record<string, unknown>);
  const regionRaw = data.region ?? data.regionSociosanitaire ?? loc.ville ?? loc.city;
  const region =
    typeof regionRaw === 'string' && regionRaw.trim().length > 0 ? regionRaw.trim() : undefined;
  const residenceTypeRaw = data.residenceType ?? data.type;
  const residenceType =
    typeof residenceTypeRaw === 'string' && residenceTypeRaw.trim().length > 0
      ? residenceTypeRaw.trim()
      : undefined;
  const contratRaw = data.contratCourtage;
  const contratCourtage =
    contratRaw && typeof contratRaw === 'object' && !Array.isArray(contratRaw)
      ? (contratRaw as Residence['contratCourtage'])
      : undefined;
  const prixAccepte = mapLegacyNumber(data.prixAccepte, data.prixOffreAccepte);
  const importMetaRaw = data.importMetaResidence;
  const catalogReference =
    importMetaRaw &&
    typeof importMetaRaw === 'object' &&
    !Array.isArray(importMetaRaw) &&
    importMetaRaw.catalogReference === true;
  const legalRaw =
    data.legal && typeof data.legal === 'object' && !Array.isArray(data.legal)
      ? (data.legal as Residence['legal'])
      : undefined;
  const buildingRaw =
    data.building && typeof data.building === 'object' && !Array.isArray(data.building)
      ? (data.building as Residence['building'])
      : undefined;
  const operationsRaw =
    data.operations && typeof data.operations === 'object' && !Array.isArray(data.operations)
      ? (data.operations as Residence['operations'])
      : undefined;
  return {
    id: doc.id,
    address: loc.address,
    city: loc.city,
    ville: loc.ville,
    municipalite: loc.municipalite,
    price,
    residenceName: commercialName,
    nomCommercial: data.nomCommercial ? String(data.nomCommercial) : undefined,
    nom_commercial: data.nom_commercial ? String(data.nom_commercial) : undefined,
    commercialName: data.commercialName ? String(data.commercialName) : undefined,
    name: data.name ? String(data.name) : undefined,
    askingPrice: price,
    prixDemande: price,
    commissionRate,
    potentialRevenue,
    unitesRPA,
    nombreUnitesTotal: unitesRPA,
    tauxOccupation,
    certificationsCiusss,
    revenuBrutEffectif,
    revenuNetExploitation,
    region,
    residenceType,
    type: residenceType,
    contratCourtage,
    prixAccepte,
    status: resolveResidenceStatus(extractPipelineStatusRaw(data as Record<string, unknown>)),
    date: String(data.date ?? data.updatedAt ?? ''),
    courtiersResponsables: data[TENANT_FIELD],
    assetNiche: parseAssetNiche(data.assetNiche ?? data.niche),
    propertyType: parseRadarPropertyType(data.propertyType),
    nicheMetadata: meta,
    syndication,
    catalogReference: catalogReference || undefined,
    legal: legalRaw,
    building: buildingRaw,
    operations: operationsRaw,
  } satisfies Residence;
}

function mapSnapshot(snapshot: QuerySnapshot<DocumentData>): Residence[] {
  return snapshot.docs.map(mapResidenceDoc);
}

/**
 * Récupère les résidences du tenant courant.
 *
 * @param ctx contexte tenant — `buildResidenceTenantContext(profile)` (`admin` = sans filtre courtier)
 * @returns liste filtrée par `courtiersResponsables == ctx.tenantId`
 */
export async function listResidences(
  ctx: TenantContext,
  opts: ResidenceQueryOpts = {}
): Promise<Residence[]> {
  const { silo } = opts;
  const constraints = tenantConstraints(ctx);

  const baseRef = collection(db, 'residences');
  const siloWhere =
    silo && silo !== 'RPA' ? [where('assetNiche', '==', silo)] : [];

  const q =
    constraints.length === 0 && siloWhere.length === 0
      ? query(baseRef)
      : query(
          baseRef,
          ...constraints.map((c) => where(c.field, c.op, c.value)),
          ...siloWhere
        );

  let snapshot: QuerySnapshot<DocumentData>;
  try {
    snapshot = await getDocs(q);
  } catch (error) {
    console.error('[residences.listResidences] Firestore query failed:', error);
    return [];
  }

  return applySiloFilter(mapSnapshot(snapshot), silo);
}

/**
 * Pipeline « chaud » : uniquement les statuts actifs (exclut `unsigned`).
 * Préfère une requête indexée `status in [...]` ; repli sur filtre client.
 */
export async function listResidencesPipeline(
  ctx: TenantContext,
  opts: ResidenceQueryOpts = {}
): Promise<Residence[]> {
  const { silo } = opts;
  const siloWhere = silo && silo !== 'RPA' ? [where('assetNiche', '==', silo)] : [];

  if (ctx.mode === 'admin') {
    const rows = await listResidences(ctx, opts);
    return excludeCatalogReferenceResidences(
      rows.filter((r) => isPipelineActiveStatus(r.status))
    );
  }

  const constraints = tenantConstraints(ctx);
  const baseRef = collection(db, 'residences');

  try {
    const qy = query(
      baseRef,
      ...constraints.map((c) => where(c.field, c.op, c.value)),
      ...siloWhere,
      where('status', 'in', [...FIRESTORE_PIPELINE_STATUS_IN]),
      orderBy(documentId())
    );
    const snapshot = await getDocs(qy);
    return excludeCatalogReferenceResidences(
      applySiloFilter(mapSnapshot(snapshot), silo).filter((r) =>
        isPipelineActiveStatus(r.status)
      )
    );
  } catch (e) {
    console.warn('[residences.listResidencesPipeline] indexed query failed, fallback:', e);
    const rows = await listResidences(ctx, opts);
    return excludeCatalogReferenceResidences(
      rows.filter((r) => isPipelineActiveStatus(r.status))
    );
  }
}

export interface FetchResidencesPageResult {
  rows: Residence[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

/**
 * Inventaire catalogue partagé : `courtiersResponsables == ""` (fiches non assignées).
 * Nécessite rules `isSharedCatalogResidence` + champ vide explicite en base.
 */
export async function fetchSharedCatalogResidencesPage(
  opts: {
    pageSize?: number;
    startAfterDoc?: QueryDocumentSnapshot<DocumentData> | null;
    silo?: AssetNiche;
  } = {}
): Promise<FetchResidencesPageResult> {
  const pageSize = opts.pageSize ?? PAGE_SIZE_DEFAULT;
  const silo = opts.silo;
  const siloWhere = silo && silo !== 'RPA' ? [where('assetNiche', '==', silo)] : [];
  const baseRef = collection(db, 'residences');

  try {
    const qy = query(
      baseRef,
      where(TENANT_FIELD, '==', ''),
      ...siloWhere,
      orderBy(documentId()),
      ...(opts.startAfterDoc ? [startAfter(opts.startAfterDoc)] : []),
      limit(pageSize)
    );
    const snapshot = await getDocs(qy);
    const rows = applySiloFilter(mapSnapshot(snapshot), silo);
    const lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
    const hasMore = snapshot.docs.length === pageSize;
    return { rows, lastDoc, hasMore };
  } catch (e) {
    console.warn('[residences.fetchSharedCatalogResidencesPage] failed:', e);
    return { rows: [], lastDoc: null, hasMore: false };
  }
}

/**
 * Page d’inventaire complet (tous statuts), ordre stable `documentId`, pagination curseur.
 */
export async function fetchResidencesPage(
  ctx: TenantContext,
  opts: {
    pageSize?: number;
    startAfterDoc?: QueryDocumentSnapshot<DocumentData> | null;
    silo?: AssetNiche;
  } = {}
): Promise<FetchResidencesPageResult> {
  const pageSize = opts.pageSize ?? PAGE_SIZE_DEFAULT;
  const silo = opts.silo;
  const siloWhere = silo && silo !== 'RPA' ? [where('assetNiche', '==', silo)] : [];
  const constraints = tenantConstraints(ctx);
  const baseRef = collection(db, 'residences');

  try {
    const qy = query(
      baseRef,
      ...constraints.map((c) => where(c.field, c.op, c.value)),
      ...siloWhere,
      orderBy(documentId()),
      ...(opts.startAfterDoc ? [startAfter(opts.startAfterDoc)] : []),
      limit(pageSize)
    );
    const snapshot = await getDocs(qy);
    const rows = applySiloFilter(mapSnapshot(snapshot), silo);
    const lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
    const hasMore = snapshot.docs.length === pageSize;
    return { rows, lastDoc, hasMore };
  } catch (e) {
    console.error('[residences.fetchResidencesPage] failed:', e);
    return { rows: [], lastDoc: null, hasMore: false };
  }
}

/**
 * Lecture directe d’une fiche (navigation profonde / focus hors page chargée).
 * `silo` : refus si la fiche n’appartient pas au silo actif (héritage sans niche = RPA).
 */
export async function getResidenceById(
  ctx: TenantContext,
  residenceId: string,
  opts: ResidenceQueryOpts = {}
): Promise<Residence | null> {
  if (!residenceId) return null;
  const { silo } = opts;
  try {
    const ref = doc(db, 'residences', residenceId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const row = mapResidenceDoc(snap);
    if (ctx.mode !== 'admin') {
      if (row.courtiersResponsables !== ctx.tenantId) return null;
    }
    if (silo && !residenceMatchesNiche(row.assetNiche, silo)) return null;
    return row;
  } catch (e) {
    console.error('[residences.getResidenceById] failed:', e);
    return null;
  }
}

/**
 * Recherche inventaire — filtre client multi-champs (nom, adresse, ville, raison sociale).
 * Charge les fiches du tenant + première page catalogue partagé, puis filtre local.
 */
export async function searchResidencesByAddressPrefix(
  ctx: TenantContext,
  prefixRaw: string,
  limitN = 80,
  opts: ResidenceQueryOpts = {}
): Promise<Residence[]> {
  const queryText = prefixRaw.trim();
  if (!queryText) return [];

  const { silo } = opts;
  try {
    const [tenantRows, catalogPage] = await Promise.all([
      listResidences(ctx, opts),
      fetchSharedCatalogResidencesPage({ pageSize: 150, silo }),
    ]);
    const seen = new Set<string>();
    const merged: Residence[] = [];
    for (const row of [...tenantRows, ...catalogPage.rows]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
    return filterResidencesBySearchQuery(merged, queryText).slice(0, limitN);
  } catch (e) {
    console.warn('[residences.searchResidencesByAddressPrefix] search failed:', e);
    return [];
  }
}

/**
 * Met à jour le statut pipeline après glisser-déposer Kanban.
 * Écrit le slug canonique V2 + miroir legacy `statut`.
 */
export async function updateResidencePipelineStatus(
  ctx: TenantContext,
  residenceId: string,
  columnId: PipelineColumnId
): Promise<void> {
  if (!residenceId) throw new Error('residenceId requis');

  const existing = await getResidenceById(ctx, residenceId);
  if (!existing) throw new Error('Résidence introuvable ou accès refusé');
  if (columnId === 'promise') {
    const prixAccepte = mapLegacyFloat(existing.prixAccepte);
    if (!prixAccepte || prixAccepte <= 0) {
      throw new Error(
        "Action requise: impossible de passer en promesse d'achat acceptée sans prix accepté."
      );
    }
  }

  const statusPatch = buildPipelineStatusFirestorePatch(columnId);
  const ref = doc(db, 'residences', residenceId);
  await updateDoc(ref, {
    ...statusPatch,
    updatedAt: serverTimestamp(),
  });
}
