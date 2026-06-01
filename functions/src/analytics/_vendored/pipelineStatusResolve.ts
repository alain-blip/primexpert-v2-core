/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/market/internalMarketFlywheel.ts
 * Régénéré : functions/scripts/sync-core-analytics-flywheel.cjs (prebuild)
 */
/**
 * Résolution canonique des statuts pipeline résidence.
 */

export type PipelineColumnId = 'prospect' | 'mandate' | 'promise' | 'sold';

export const PIPELINE_ACTIVE_STATUSES: readonly PipelineColumnId[] = [
  'prospect',
  'mandate',
  'promise',
  'sold',
] as const;

const PIPELINE_COLUMN_SET = new Set<string>(PIPELINE_ACTIVE_STATUSES);

export const ACTIVE_PIPELINE_RAW_STATUSES = new Set([
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

export const LEGACY_STATUT_TO_PIPELINE_COLUMN: Readonly<Record<string, PipelineColumnId>> = {
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
  'pa_acceptee': 'promise',
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

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeRawStatus(raw: unknown): string {
  if (raw == null) return '';
  return String(raw).toLowerCase().trim();
}

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

export function resolvePipelineColumnId(rawStatus: unknown): PipelineColumnId | null {
  const normalized = normalizeRawStatus(rawStatus);
  if (!normalized) return null;

  if (PIPELINE_COLUMN_SET.has(normalized)) {
    return normalized as PipelineColumnId;
  }

  if (LEGACY_STATUT_TO_PIPELINE_COLUMN[normalized]) {
    return LEGACY_STATUT_TO_PIPELINE_COLUMN[normalized];
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
    paaccepte: 'promise',
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
  if (slug.includes('promess') || slug.includes('promis') || slug.includes('paaccept')) {
    return 'promise';
  }
  if (slug.includes('vendu') || slug.includes('vendue') || slug.includes('sold')) return 'sold';
  if (slug.includes('prospect') || slug.includes('prosp') || slug.includes('lead')) {
    return 'prospect';
  }

  return null;
}

