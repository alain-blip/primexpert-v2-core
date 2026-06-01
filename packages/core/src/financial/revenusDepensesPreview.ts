/**
 * Aperçu live RNE / TGA — colonne « Normalisé » (Hub Finance).
 */

import { safeNum } from './safeNumbers';

export interface RevenusDepensesLiveKpis {
  rbe: number | null;
  depensesNormalisees: number | null;
  rne: number | null;
  tgaPct: number | null;
  valeurCapitalisation: number | null;
}

export function normalizeTgaPct(value: unknown): number | null {
  const n = safeNum(value);
  if (n == null || n <= 0) return null;
  return n > 1 ? n : n * 100;
}

export function normalizeTgaRatio(value: unknown): number | null {
  const pct = normalizeTgaPct(value);
  return pct == null ? null : pct / 100;
}

export function computeTgaPctFromRneAndPrice(
  rne: unknown,
  prixDemande: unknown
): number | null {
  const parsedRne = safeNum(rne);
  const parsedPrixDemande = safeNum(prixDemande);
  if (parsedRne == null || parsedRne <= 0) return null;
  if (parsedPrixDemande == null || parsedPrixDemande <= 0) return null;
  return (parsedRne / parsedPrixDemande) * 100;
}

export function computeTgaRatioFromRneAndPrice(
  rne: unknown,
  prixDemande: unknown
): number | null {
  const pct = computeTgaPctFromRneAndPrice(rne, prixDemande);
  return pct == null ? null : pct / 100;
}

export function computeCapitalizedValueFromRneAndTgaPct(
  rne: unknown,
  tgaPct: unknown
): number | null {
  const parsedRne = safeNum(rne);
  const normalizedTgaPct = normalizeTgaPct(tgaPct);
  if (parsedRne == null || parsedRne <= 0) return null;
  if (normalizedTgaPct == null || normalizedTgaPct <= 0) return null;
  return parsedRne / (normalizedTgaPct / 100);
}

export function hasTgaPctMeaningfulDelta(
  currentTgaPct: unknown,
  referenceTgaPct: unknown,
  tolerancePct = 0.04
): boolean {
  const current = normalizeTgaPct(currentTgaPct);
  const reference = normalizeTgaPct(referenceTgaPct);
  if (current == null || reference == null) return false;
  return Math.abs(current - reference) > tolerancePct;
}

export function computeRevenusDepensesLiveKpis(
  rbe: number | null,
  depensesNormalisees: number | null,
  prixDemande: number | null,
  tgaReferencePct?: number | null
): RevenusDepensesLiveKpis {
  const rne =
    rbe != null && depensesNormalisees != null && rbe > 0
      ? rbe - depensesNormalisees
      : null;

  const tgaPct =
    computeTgaPctFromRneAndPrice(rne, prixDemande) ?? normalizeTgaPct(tgaReferencePct);

  const valeurCapitalisation = computeCapitalizedValueFromRneAndTgaPct(rne, tgaPct);

  return {
    rbe,
    depensesNormalisees,
    rne,
    tgaPct,
    valeurCapitalisation,
  };
}
