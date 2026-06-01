/**
 * Statuts courtage québécois — édition manuelle inscriptions (HITL).
 */

import { isOffMarketListing, resolveListingSource } from './listingSource';

export const INSCRIPTION_BROKERAGE_STATUSES = [
  'active',
  'suspended',
  'expired',
  'sold',
  'cancelled',
] as const;

export type InscriptionBrokerageStatus = (typeof INSCRIPTION_BROKERAGE_STATUSES)[number];

export interface InscriptionBrokerageStatusOption {
  id: InscriptionBrokerageStatus;
  labelFr: string;
  labelEn: string;
}

export const INSCRIPTION_BROKERAGE_STATUS_OPTIONS: readonly InscriptionBrokerageStatusOption[] = [
  { id: 'active', labelFr: 'Active', labelEn: 'Active' },
  { id: 'suspended', labelFr: 'Suspendue', labelEn: 'Suspended' },
  { id: 'expired', labelFr: 'Expirée', labelEn: 'Expired' },
  { id: 'sold', labelFr: 'Vendue', labelEn: 'Sold' },
  { id: 'cancelled', labelFr: 'Annulée', labelEn: 'Cancelled' },
] as const;

function normalizeToken(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Résout le statut courtage affiché dans le menu déroulant. */
export function resolveInscriptionBrokerageStatus(
  data: Record<string, unknown>
): InscriptionBrokerageStatus {
  const statut = normalizeToken(data.statut);
  if (statut.includes('suspend')) return 'suspended';
  if (statut.includes('annul')) return 'cancelled';
  if (statut.includes('expir')) return 'expired';

  const status = normalizeToken(data.status);
  if (status === 'sold' || statut.includes('vendu')) return 'sold';
  if (status === 'expired') return 'expired';
  if (status === 'mandate' || statut.includes('actif') || statut.includes('mandat')) return 'active';
  if (status === 'promise' || status === 'prospect') return 'active';
  if (status === 'unsigned' && !statut) return 'cancelled';
  return 'active';
}

export function buildInscriptionBrokerageStatusPatch(
  brokerageStatus: InscriptionBrokerageStatus
): { status: string; statut: string } {
  switch (brokerageStatus) {
    case 'active':
      return { status: 'mandate', statut: 'actif' };
    case 'suspended':
      return { status: 'unsigned', statut: 'suspendue' };
    case 'expired':
      return { status: 'expired', statut: 'expiree' };
    case 'sold':
      return { status: 'sold', statut: 'vendue' };
    case 'cancelled':
      return { status: 'unsigned', statut: 'annulee' };
  }
}

export function labelForInscriptionBrokerageStatus(
  status: InscriptionBrokerageStatus,
  locale: 'fr' | 'en'
): string {
  const row = INSCRIPTION_BROKERAGE_STATUS_OPTIONS.find((o) => o.id === status);
  if (!row) return status;
  return locale === 'fr' ? row.labelFr : row.labelEn;
}

/** Le menu statut est éditable si hors marché, ou Centris avec override manuel actif. */
export function isInscriptionStatusEditable(data: Record<string, unknown>): boolean {
  if (isOffMarketListing(resolveListingSource(data.listingSource))) return true;
  return data.isManuallyOverridden === true;
}
