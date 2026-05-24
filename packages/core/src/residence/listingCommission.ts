/**
 * Pilotage financier pipeline — prix et commissions par inscription / colonne Kanban.
 * Port adapté de Copilote `commissionUtils.js` (sans miroir PA en Phase 1).
 */

import { toPositiveNumber } from './normalizeNumbers';

export type ListingCommissionSource = {
  id?: string;
  price?: number;
  askingPrice?: number;
  prixDemande?: number;
  prixAnnonce?: number;
  listingPrice?: number;
  commissionRate?: number;
  tauxCommission?: number;
  commissionPct?: number;
  potentialRevenue?: number;
  revenuPotentiel?: number;
  revenuPotentielCommission?: number;
  contratCourtage?: {
    commissionPourcentage?: unknown;
    commissionEquipe?: unknown;
  };
  commission?: {
    totalePct?: unknown;
    inscripteurPct?: unknown;
  };
};

export interface PipelineColumnTotals {
  totalPrice: number;
  totalCommission: number;
  countWithCommission: number;
  countTotal: number;
}

function parsePctValue(raw: unknown): number | null {
  if (raw === '' || raw == null || raw === undefined) return null;
  const n =
    typeof raw === 'number'
      ? raw
      : parseFloat(String(raw).replace(/\s/g, '').replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Prix d'annonce / demandé pour pilotage portefeuille. */
export function getListingPrice(residence: ListingCommissionSource | null | undefined): number {
  if (!residence) return 0;

  return (
    toPositiveNumber(residence.prixAnnonce) ??
    toPositiveNumber(residence.price) ??
    toPositiveNumber(residence.askingPrice) ??
    toPositiveNumber(residence.prixDemande) ??
    toPositiveNumber(residence.listingPrice) ??
    0
  );
}

/** Taux de commission totale (pourcentage entier, ex. 5 pour 5 %). */
export function getListingCommissionRate(
  residence: ListingCommissionSource | null | undefined
): number {
  if (!residence) return 0;

  const cc = residence.contratCourtage;
  const fromContrat =
    parsePctValue(cc?.commissionPourcentage) ?? parsePctValue(cc?.commissionEquipe);
  if (fromContrat != null && fromContrat > 0) return fromContrat;

  const fromCommission =
    parsePctValue(residence.commission?.totalePct) ??
    parsePctValue(residence.commission?.inscripteurPct);
  if (fromCommission != null && fromCommission > 0) return fromCommission;

  const rate =
    parsePctValue(residence.commissionRate) ??
    parsePctValue(residence.tauxCommission) ??
    parsePctValue(residence.commissionPct);

  return rate != null && rate > 0 ? rate : 0;
}

/** Montant de commission estimé en dollars. */
export function getListingCommissionAmount(
  residence: ListingCommissionSource | null | undefined
): number {
  if (!residence) return 0;

  const explicit =
    toPositiveNumber(residence.potentialRevenue) ??
    toPositiveNumber(residence.revenuPotentiel) ??
    toPositiveNumber(residence.revenuPotentielCommission);

  if (explicit != null) return explicit;

  const price = getListingPrice(residence);
  const rate = getListingCommissionRate(residence);
  if (!price || !rate) return 0;

  return (price * rate) / 100;
}

/** Totaux cumulés pour une colonne Kanban. */
export function calculatePipelineColumnTotals(
  residences: readonly ListingCommissionSource[]
): PipelineColumnTotals {
  if (!Array.isArray(residences) || residences.length === 0) {
    return {
      totalPrice: 0,
      totalCommission: 0,
      countWithCommission: 0,
      countTotal: 0,
    };
  }

  let totalPrice = 0;
  let totalCommission = 0;
  let countWithCommission = 0;

  for (const residence of residences) {
    const price = getListingPrice(residence);
    const commission = getListingCommissionAmount(residence);

    totalPrice += price;
    totalCommission += commission;
    if (commission > 0) countWithCommission += 1;
  }

  return {
    totalPrice,
    totalCommission,
    countWithCommission,
    countTotal: residences.length,
  };
}

/** Montant CAD pour en-têtes Kanban (fr-CA). */
export function formatListingMoneyCad(
  value: number,
  options: { fallback?: string } = {}
): string {
  const { fallback = '—' } = options;
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) {
    return fallback;
  }

  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
