/**
 * Pipeline inscriptions — SSOT Kanban V4 (Primexpert V2)
 *
 * Slugs Firestore canoniques : prospect | mandate | promise | sold (zone rouge).
 * Libellés UI : français métier via PIPELINE_KANBAN_COLUMNS.
 * Héritage Copilote : resolveColumnId() remappe qualification, en-mandat, pa-acceptee, etc.
 */

/** Statuts persistés Firestore — ne JAMAIS renommer. */
export type ResidenceStatus =
  | 'prospect'
  | 'mandate'
  | 'promise'
  | 'expired'
  | 'unsigned'
  | 'sold';

/** Colonnes du Kanban « pipeline chaud » (4 colonnes actives). */
export type PipelineColumnId = 'prospect' | 'mandate' | 'promise' | 'sold';

export interface PipelineKanbanColumn {
  id: PipelineColumnId;
  labelFr: string;
  labelEn: string;
}

/** Ordre d’affichage Kanban — libellés francophones métier. */
export const PIPELINE_KANBAN_COLUMNS: readonly PipelineKanbanColumn[] = [
  { id: 'prospect', labelFr: 'En prospection', labelEn: 'Prospecting' },
  { id: 'mandate', labelFr: 'En mandat', labelEn: 'Under listing agreement' },
  { id: 'promise', labelFr: "En promesse d'achat", labelEn: 'Under promise to purchase' },
  { id: 'sold', labelFr: 'Vendu', labelEn: 'Sold' },
] as const;

export const PIPELINE_ACTIVE_STATUSES: readonly PipelineColumnId[] = PIPELINE_KANBAN_COLUMNS.map(
  (c) => c.id
);

const PIPELINE_COLUMN_SET = new Set<string>(PIPELINE_ACTIVE_STATUSES);

/**
 * Statuts bruts reconnus comme « actifs » pour le Kanban (inclut slugs legacy Copilote).
 */
export const ACTIVE_PIPELINE_RAW_STATUTS = new Set([
  'prospect',
  'prospection',
  'lead',
  'qualification',
  'mandate',
  'mandat',
  'en-mandat',
  'actif',
  'listed',
  'promise',
  'promesse',
  'promesse-achat',
  'pa-acceptee',
  'due-diligence',
  'financement',
  'transfert-permis',
  'sold',
  'vendu',
  'vendue',
  'cloture',
  'fermee',
  'fermée',
  'clos',
  'success',
  'succes',
]);

/** Mapping slug legacy Copilote / FR → colonne canonique Firestore. */
const LEGACY_STATUT_TO_COLUMN: Record<string, PipelineColumnId> = {
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
};

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeRawStatut(raw: unknown): string {
  if (raw == null) return '';
  return String(raw).toLowerCase().trim();
}

/**
 * Extrait le statut pipeline depuis un document résidence (champs hérités Copilote).
 */
export function extractPipelineStatusRaw(
  data: Record<string, unknown> | null | undefined
): string {
  if (!data) return '';
  const raw =
    data.status ??
    data.pipelineStatus ??
    data.etat ??
    data.phase ??
    data.stage ??
    data.statut ??
    '';
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Résout un statut brut vers l’ID de colonne Kanban (slug Firestore canonique).
 * Retourne null si hors pipeline actif (expiré, archive, froid, etc.).
 */
export function resolveColumnId(rawStatut: unknown): PipelineColumnId | null {
  const normalized = normalizeRawStatut(rawStatut);
  if (!normalized) return null;

  if (PIPELINE_COLUMN_SET.has(normalized)) {
    return normalized as PipelineColumnId;
  }

  if (LEGACY_STATUT_TO_COLUMN[normalized]) {
    return LEGACY_STATUT_TO_COLUMN[normalized];
  }

  const slug = stripDiacritics(normalized).replace(/[^a-z0-9]+/g, '');

  const slugTable: Record<string, PipelineColumnId> = {
    prospect: 'prospect',
    prospection: 'prospect',
    lead: 'prospect',
    enprospection: 'prospect',
    qualification: 'prospect',
    mandate: 'mandate',
    mandat: 'mandate',
    enmandat: 'mandate',
    listed: 'mandate',
    promise: 'promise',
    promesse: 'promise',
    enpromesse: 'promise',
    paacceptee: 'promise',
    duediligence: 'promise',
    financement: 'promise',
    transfertpermis: 'promise',
    sold: 'sold',
    vendu: 'sold',
    vendue: 'sold',
    cloture: 'sold',
    succes: 'sold',
    success: 'sold',
  };

  if (slugTable[slug]) return slugTable[slug];

  if (slug.includes('mandat')) return 'mandate';
  if (slug.includes('promess') || slug.includes('promis')) return 'promise';
  if (slug.includes('vendu') || slug.includes('vendue') || slug.includes('sold')) return 'sold';
  if (slug.includes('prospect') || slug.includes('prosp') || slug.includes('lead')) {
    return 'prospect';
  }

  return null;
}

/**
 * Résout le statut canonique Firestore d’une résidence (inclut expired / unsigned).
 */
export function resolveResidenceStatus(rawStatut: unknown): ResidenceStatus {
  const normalized = normalizeRawStatut(rawStatut);

  if (!normalized) return 'unsigned';

  if (normalized === 'unsigned') return 'unsigned';
  if (
    normalized === 'archive' ||
    normalized === 'sans status' ||
    normalized === 'sans statut' ||
    normalized === 'non signé' ||
    stripDiacritics(normalized) === 'non signe'
  ) {
    return 'unsigned';
  }

  if (
    normalized === 'expired' ||
    normalized === 'expiré' ||
    normalized === 'expirée' ||
    normalized === 'expire' ||
    normalized === 'expires' ||
    stripDiacritics(normalized).includes('expir')
  ) {
    return 'expired';
  }

  const column = resolveColumnId(rawStatut);
  if (column) return column;

  return 'prospect';
}

export function getPipelineColumnLabel(
  columnId: PipelineColumnId,
  language: 'fr' | 'en' = 'fr'
): string {
  const col = PIPELINE_KANBAN_COLUMNS.find((c) => c.id === columnId);
  if (!col) return columnId;
  return language === 'fr' ? col.labelFr : col.labelEn;
}

export function isPipelineActiveStatus(status: ResidenceStatus): status is PipelineColumnId {
  return (PIPELINE_ACTIVE_STATUSES as readonly string[]).includes(status);
}

/** Regroupement Mes Documents — 4 sections navigation inscriptions. */
export type DocumentsListingGroupId = 'mandate' | 'promise' | 'sold' | 'other';

export interface DocumentsListingGroupDef {
  id: DocumentsListingGroupId;
  labelFr: string;
  labelEn: string;
}

export const DOCUMENTS_LISTING_GROUPS: readonly DocumentsListingGroupDef[] = [
  { id: 'mandate', labelFr: 'En mandat', labelEn: 'Under listing agreement' },
  { id: 'promise', labelFr: "En promesse d'achat", labelEn: 'Under promise to purchase' },
  { id: 'sold', labelFr: 'Vendues', labelEn: 'Sold' },
  { id: 'other', labelFr: 'Autres', labelEn: 'Other' },
] as const;

/**
 * Mappe `ResidenceStatus` canonique vers les 4 sections Mes Documents.
 * - mandate → En mandat (actif / listed / en-mandat via resolveResidenceStatus)
 * - promise → En PA (offre acceptée, conditionnelle, due diligence, etc.)
 * - sold → Vendues (vendu, fermé, clôturé)
 * - prospect | expired | unsigned → Autres
 */
export function resolveDocumentsListingGroup(status: ResidenceStatus): DocumentsListingGroupId {
  if (status === 'mandate') return 'mandate';
  if (status === 'promise') return 'promise';
  if (status === 'sold') return 'sold';
  return 'other';
}

export function groupResidencesByDocumentsStatus<T extends { status: ResidenceStatus }>(
  residences: T[]
): Record<DocumentsListingGroupId, T[]> {
  const groups: Record<DocumentsListingGroupId, T[]> = {
    mandate: [],
    promise: [],
    sold: [],
    other: [],
  };
  for (const r of residences) {
    groups[resolveDocumentsListingGroup(r.status)].push(r);
  }
  return groups;
}
