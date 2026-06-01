/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/market/internalMarketFlywheel.ts
 * Régénéré : functions/scripts/sync-core-analytics-flywheel.cjs (prebuild)
 */
/**
 * Calcul TGA réel d'un comparable Centris / Matrix.
 */

export interface ComparableCapRateInput {
  soldPrice: number;
  revenuBrutEffectif: number;
  densesExploitation: number;
  netOperatingIncome: number;
}

export function calculateComparableCapRate(listing: ComparableCapRateInput): number {
  if (!listing.soldPrice || listing.soldPrice <= 0) return 0;
  const rne =
    listing.netOperatingIncome > 0
      ? listing.netOperatingIncome
      : listing.revenuBrutEffectif - listing.densesExploitation;
  if (!Number.isFinite(rne) || rne <= 0) return 0;
  return Number(((rne / listing.soldPrice) * 100).toFixed(2));
}

