/**
 * Pipeline inscriptions — SSOT Kanban V4 (Primexpert V2)
 *
 * Slugs Firestore canoniques : prospect | mandate | promise | sold (zone rouge).
 * Libellés UI : français métier via PIPELINE_KANBAN_COLUMNS.
 * Héritage Copilote : resolveColumnId() remappe qualification, en-mandat, pa-acceptee, etc.
 */

import {
  ACTIVE_PIPELINE_RAW_STATUSES,
  LEGACY_STATUT_TO_PIPELINE_COLUMN,
  PIPELINE_ACTIVE_STATUSES as CORE_PIPELINE_ACTIVE_STATUSES,
  extractPipelineStatusRaw,
  resolvePipelineColumnId,
} from '@primexpert/core/residence';

export { extractPipelineStatusRaw };

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

export type DealStageId = 'analyse_financiere' | 'due_diligence' | 'cloture';

export interface DealStageDefinition {
  id: DealStageId;
  labelFr: string;
  labelEn: string;
  allowedNext: readonly DealStageId[];
}

/** Ordre d’affichage Kanban — libellés francophones métier. */
export const PIPELINE_KANBAN_COLUMNS: readonly PipelineKanbanColumn[] = [
  { id: 'prospect', labelFr: 'En prospection', labelEn: 'Prospecting' },
  { id: 'mandate', labelFr: 'En mandat', labelEn: 'Under listing agreement' },
  { id: 'promise', labelFr: "En promesse d'achat", labelEn: 'Under promise to purchase' },
  { id: 'sold', labelFr: 'Vendu', labelEn: 'Sold' },
] as const;

/**
 * Machine à états transactionnelle RPA (phase 1).
 * Cycle: Analyse financière -> Due diligence (diligence raisonnable) -> Clôture.
 */
export const dealStageMachine: Readonly<Record<DealStageId, DealStageDefinition>> = {
  analyse_financiere: {
    id: 'analyse_financiere',
    labelFr: 'Analyse financière',
    labelEn: 'Financial analysis',
    allowedNext: ['due_diligence'],
  },
  due_diligence: {
    id: 'due_diligence',
    labelFr: 'Due diligence (diligence raisonnable)',
    labelEn: 'Due diligence',
    allowedNext: ['cloture'],
  },
  cloture: {
    id: 'cloture',
    labelFr: 'Clôture',
    labelEn: 'Closing',
    allowedNext: [],
  },
} as const;

export const PIPELINE_ACTIVE_STATUSES: readonly PipelineColumnId[] = CORE_PIPELINE_ACTIVE_STATUSES;

/**
 * Statuts bruts reconnus comme « actifs » pour le Kanban (inclut slugs legacy Copilote).
 */
export const ACTIVE_PIPELINE_RAW_STATUTS = ACTIVE_PIPELINE_RAW_STATUSES;

/** Mapping slug legacy Copilote / FR → colonne canonique Firestore. */
export const LEGACY_STATUT_TO_COLUMN = LEGACY_STATUT_TO_PIPELINE_COLUMN as Readonly<
  Record<string, PipelineColumnId>
>;

function normalizeRawStatut(raw: unknown): string {
  if (raw == null) return '';
  return String(raw).toLowerCase().trim();
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Résout un statut brut vers l’ID de colonne Kanban (slug Firestore canonique).
 * Retourne null si hors pipeline actif (expiré, archive, froid, etc.).
 */
export function resolveColumnId(rawStatut: unknown): PipelineColumnId | null {
  return resolvePipelineColumnId(rawStatut) as PipelineColumnId | null;
}

/**
 * Pont entre statut pipeline et machine à états transactionnelle RPA.
 * - `pa-acceptee` / `promise` est considéré en Due diligence.
 */
export function resolveDealStage(rawStatut: unknown): DealStageId {
  const normalized = normalizeRawStatut(rawStatut);
  if (
    normalized === 'pa-acceptee' ||
    normalized === 'due-diligence' ||
    normalized === 'financement' ||
    normalized === 'transfert-permis'
  ) {
    return 'due_diligence';
  }
  const column = resolveColumnId(rawStatut);
  if (column === 'sold') return 'cloture';
  if (column === 'promise') return 'due_diligence';
  return 'analyse_financiere';
}

/** Valide une transition explicite dans `dealStageMachine`. */
export function canTransitionDealStage(from: DealStageId, to: DealStageId): boolean {
  if (from === to) return true;
  return dealStageMachine[from].allowedNext.includes(to);
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

/** Patch Firestore lors d'un glisser-déposer Kanban (statut canonique + miroir legacy). */
export function buildPipelineStatusFirestorePatch(
  columnId: PipelineColumnId
): { status: PipelineColumnId; statut: string } {
  const legacyStatut: Record<PipelineColumnId, string> = {
    prospect: 'prospect',
    mandate: 'mandat',
    promise: 'pa-acceptee',
    sold: 'vendu',
  };
  return { status: columnId, statut: legacyStatut[columnId] };
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
