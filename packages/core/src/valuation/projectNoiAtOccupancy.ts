/**
 * Projection du revenu net d'exploitation (RNE) selon le taux d'occupation cible.
 */

import { resolveRneFromRevenueAndExpenses } from '../financial/capitalization';

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

/**
 * RNE à l'occupation cible : revenu brut potentiel (RBP) × occ − dépenses (fixes).
 * Formule ACM pour scénarios 85 % / 90 % / 100 %.
 */
export function projectNoiFromRbpAtOccupancy(
  rbp: number,
  operatingExpenses: number,
  targetOccupancy: number
): number {
  if (!Number.isFinite(rbp) || rbp <= 0) return 0;
  const occ = Math.min(1, Math.max(0, targetOccupancy));
  const expenses = Number.isFinite(operatingExpenses) ? operatingExpenses : 0;
  return (
    resolveRneFromRevenueAndExpenses({
      revenuBrutEffectif: rbp * occ,
      depensesExploitation: expenses,
      round: true,
    }) ?? 0
  );
}
