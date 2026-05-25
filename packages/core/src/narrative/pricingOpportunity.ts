/**
 * Boussole TGA implicite vs TGA cible — tags pour le NarrativeEngine (ACM).
 */

import type { PricingOpportunityTag } from './types';

const DEFAULT_TOLERANCE_BPS = 25;

/**
 * TGA implicite > TGA cible → prix demandé offre un rendement supérieur au marché (aubaine).
 * TGA implicite < TGA cible → prix demandé exige un rendement insuffisant (surévaluation).
 */
export function classifyPricingOpportunityTag(
  capRateImplied: number | null | undefined,
  capRateTarget: number | null | undefined,
  toleranceBps: number = DEFAULT_TOLERANCE_BPS
): PricingOpportunityTag | null {
  if (
    capRateImplied == null ||
    capRateTarget == null ||
    !Number.isFinite(capRateImplied) ||
    !Number.isFinite(capRateTarget) ||
    capRateTarget <= 0
  ) {
    return null;
  }

  const gapBps = Math.round((capRateImplied - capRateTarget) * 10000);

  if (gapBps >= toleranceBps) {
    return 'OPPORTUNITÉ_SOUS_ÉVALUÉE';
  }
  if (gapBps <= -toleranceBps) {
    return 'SURÉVALUÉ_RISQUE';
  }
  return 'PRIX_JUSTE';
}
