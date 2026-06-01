/* eslint-disable */
/** AUTO-GÉNÉRÉ — packages/core/src/residence/ — sync-core-residence.cjs */
/**
 * Source d'inscription — Centris (MLS) vs hors marché (Off-Market).
 * Collection Firestore canonique : `residences` (inscriptions CRM).
 */

export const LISTING_SOURCES = ['centris', 'off_market'] as const;
export type ListingSource = (typeof LISTING_SOURCES)[number];

export const OFF_MARKET_CONFIDENTIAL_BANNER_FR =
  'DOCUMENT CONFIDENTIEL — DIFFUSION RESTREINTE';
export const OFF_MARKET_CONFIDENTIAL_BANNER_EN =
  'CONFIDENTIAL DOCUMENT — RESTRICTED DISTRIBUTION';

/** Valeur par défaut pour les fiches historiques sans champ explicite. */
export const DEFAULT_LISTING_SOURCE: ListingSource = 'centris';

export function resolveListingSource(raw: unknown): ListingSource {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'off_market' || v === 'off-market' || v === 'hors_marche' || v === 'hors marche') {
    return 'off_market';
  }
  return DEFAULT_LISTING_SOURCE;
}

export function isOffMarketListing(source: ListingSource | undefined | null): boolean {
  return source === 'off_market';
}

export function resolveOffMarketConfidentialBanner(locale: 'fr' | 'en'): string {
  return locale === 'fr' ? OFF_MARKET_CONFIDENTIAL_BANNER_FR : OFF_MARKET_CONFIDENTIAL_BANNER_EN;
}

/** Sync MLS/Centris — ignorer catégoriquement les fiches hors marché. */
export function shouldSkipCentrisListingSync(data: Record<string, unknown>): boolean {
  return resolveListingSource(data.listingSource) === 'off_market';
}

/** Statut MLS — respecter le verrou manuel courtier. */
export function shouldSkipMlsStatusDownstreamSync(data: Record<string, unknown>): boolean {
  if (shouldSkipCentrisListingSync(data)) return true;
  return data.isManuallyOverridden === true;
}

const RESO_STANDARD_STATUS_TO_STATUT: Record<string, string> = {
  Active: 'actif',
  'Coming Soon': 'prospect',
  Pending: 'pa-acceptee',
  Closed: 'vendue',
  Expired: 'expiree',
  Canceled: 'annulee',
  Cancelled: 'annulee',
  Withdrawn: 'suspendue',
};

const RESO_TO_FIRESTORE_STATUS: Record<string, string> = {
  Active: 'mandate',
  'Coming Soon': 'prospect',
  Pending: 'promise',
  Closed: 'sold',
  Expired: 'expired',
  Canceled: 'unsigned',
  Cancelled: 'unsigned',
  Withdrawn: 'unsigned',
};

/**
 * Patch Firestore pour sync Centris descendante — null si skip (off_market ou override manuel).
 */
export function buildCentrisMlsStatusSyncPatch(
  existing: Record<string, unknown>,
  standardStatus: string
): { status: string; statut: string } | null {
  if (shouldSkipMlsStatusDownstreamSync(existing)) return null;
  const key = String(standardStatus ?? '').trim();
  const status = RESO_TO_FIRESTORE_STATUS[key];
  const statut = RESO_STANDARD_STATUS_TO_STATUT[key];
  if (!status || !statut) return null;
  return { status, statut };
}
