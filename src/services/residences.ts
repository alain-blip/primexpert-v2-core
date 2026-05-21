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
  startAfter,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { tenantConstraints, TENANT_FIELD, type TenantContext } from '@primexpert/core/tenant';
import type { AssetNiche, AssetNicheMetadata, AssetSyndication } from '../types/residence';
import { parseAssetNiche, residenceMatchesNiche } from '../types/residence';
import type { RadarPropertyType } from '../types/radarAccess';
import {
  extractPipelineStatusRaw,
  isPipelineActiveStatus,
  PIPELINE_ACTIVE_STATUSES,
  resolveResidenceStatus,
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

export type { ResidenceStatus } from '../config/pipelineStages';

/**
 * Forme minimale d'une résidence côté UI V2.
 * Reflet partiel de Copilote-RPA `dbSchema.js` TRANSACTION_FIELDS.
 */
export interface Residence {
  id: string;
  address: string;
  city: string;
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
  /** Niche active (RPA / CPE / PLEX). Absent = visible dans toutes les vues. */
  assetNiche?: AssetNiche;
  /** Type Radar explicite (sinon déduit de `assetNiche`). */
  propertyType?: RadarPropertyType;
  nicheMetadata?: AssetNicheMetadata;
  syndication?: AssetSyndication;
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

function mapCommercialName(data: DocumentData): string | undefined {
  const candidates: unknown[] = [
    data.commercialName,
    data.nomCommercial,
    data.nom_commercial,
    data.name,
    data.residenceName,
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
  return {
    id: doc.id,
    address: String(data.address ?? data.adresse ?? '—'),
    city: String(data.city ?? data.ville ?? '—'),
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
    status: resolveResidenceStatus(extractPipelineStatusRaw(data as Record<string, unknown>)),
    date: String(data.date ?? data.updatedAt ?? ''),
    courtiersResponsables: data[TENANT_FIELD],
    assetNiche: parseAssetNiche(data.assetNiche ?? data.niche),
    propertyType: parseRadarPropertyType(data.propertyType),
    nicheMetadata: meta,
    syndication,
  } satisfies Residence;
}

function mapSnapshot(snapshot: QuerySnapshot<DocumentData>): Residence[] {
  return snapshot.docs.map(mapResidenceDoc);
}

/**
 * Récupère les résidences du tenant courant.
 *
 * @param ctx contexte tenant — `{ tenantId: profile.uid, mode: 'strict' }`
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
    return rows.filter((r) => isPipelineActiveStatus(r.status));
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
    return applySiloFilter(mapSnapshot(snapshot), silo).filter((r) =>
      isPipelineActiveStatus(r.status)
    );
  } catch (e) {
    console.warn('[residences.listResidencesPipeline] indexed query failed, fallback:', e);
    const rows = await listResidences(ctx, opts);
    return rows.filter((r) => isPipelineActiveStatus(r.status));
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

export async function searchResidencesByAddressPrefix(
  ctx: TenantContext,
  prefixRaw: string,
  limitN = 80,
  opts: ResidenceQueryOpts = {}
): Promise<Residence[]> {
  const prefix = prefixRaw.trim();
  if (!prefix) return [];

  const { silo } = opts;
  const siloWhere = silo && silo !== 'RPA' ? [where('assetNiche', '==', silo)] : [];
  const constraints = tenantConstraints(ctx);
  const baseRef = collection(db, 'residences');

  try {
    const end = prefix + '\uf8ff';
    const qy = query(
      baseRef,
      ...constraints.map((c) => where(c.field, c.op, c.value)),
      ...siloWhere,
      where('address', '>=', prefix),
      where('address', '<=', end),
      orderBy('address'),
      limit(limitN)
    );
    const snapshot = await getDocs(qy);
    return applySiloFilter(mapSnapshot(snapshot), silo);
  } catch (e) {
    console.warn('[residences.searchResidencesByAddressPrefix] query failed, empty:', e);
    return [];
  }
}
