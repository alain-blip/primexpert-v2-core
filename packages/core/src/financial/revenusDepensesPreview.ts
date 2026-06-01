/**
 * Aperçu live RNE / TGA — colonne « Normalisé » (Hub Finance).
 */

export interface RevenusDepensesLiveKpis {
  rbe: number | null;
  depensesNormalisees: number | null;
  rne: number | null;
  tgaPct: number | null;
  valeurCapitalisation: number | null;
}

export function normalizeTgaPct(tgaPct: number | null | undefined): number | null {
  if (tgaPct == null || !Number.isFinite(tgaPct) || tgaPct <= 0) return null;
  return tgaPct > 1 ? tgaPct : tgaPct * 100;
}

export function computeTgaRatioFromRneAndPrice(
  rne: number | null | undefined,
  prixDemande: number | null | undefined
): number | null {
  if (rne == null || prixDemande == null) return null;
  if (!Number.isFinite(rne) || !Number.isFinite(prixDemande)) return null;
  if (rne <= 0 || prixDemande <= 0) return null;
  return rne / prixDemande;
}

export function computeTgaPctFromRneAndPrice(
  rne: number | null | undefined,
  prixDemande: number | null | undefined
): number | null {
  const ratio = computeTgaRatioFromRneAndPrice(rne, prixDemande);
  return ratio == null ? null : ratio * 100;
}

export function computeCapitalizedValueFromRneAndTga(
  rne: number | null | undefined,
  tgaPct: number | null | undefined
): number | null {
  if (rne == null || !Number.isFinite(rne) || rne <= 0) return null;
  const normalizedTgaPct = normalizeTgaPct(tgaPct);
  if (normalizedTgaPct == null) return null;
  return rne / (normalizedTgaPct / 100);
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

  let tgaPct: number | null = null;
  tgaPct = computeTgaPctFromRneAndPrice(rne, prixDemande) ?? normalizeTgaPct(tgaReferencePct);

  const valeurCapitalisation = computeCapitalizedValueFromRneAndTga(rne, tgaPct);

  return {
    rbe,
    depensesNormalisees,
    rne,
    tgaPct,
    valeurCapitalisation,
  };
}
