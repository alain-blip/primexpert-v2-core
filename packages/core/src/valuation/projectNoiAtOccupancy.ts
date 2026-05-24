/**
 * Projection du revenu net d'exploitation (RNE) selon le taux d'occupation cible.
 */

/** Projection linéaire conservatrice : RNE cible = RNE base × (occ cible / occ actuelle). */
export function projectNOIAtOccupancy(
  baseNoi: number,
  currentOccupancy: number,
  targetOccupancy: number
): number {
  if (!Number.isFinite(baseNoi) || baseNoi <= 0) return 0;
  if (currentOccupancy <= 0) return Math.round(baseNoi);
  const ratio = targetOccupancy / currentOccupancy;
  return Math.round(baseNoi * ratio);
}
