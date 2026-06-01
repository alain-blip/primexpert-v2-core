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
  if (rne != null && rne > 0 && prixDemande != null && prixDemande > 0) {
    tgaPct = (rne / prixDemande) * 100;
  } else if (tgaReferencePct != null && Number.isFinite(tgaReferencePct)) {
    tgaPct = tgaReferencePct > 1 ? tgaReferencePct : tgaReferencePct * 100;
  }

  const valeurCapitalisation =
    rne != null && rne > 0 && tgaPct != null && tgaPct > 0 ? rne / (tgaPct / 100) : null;

  return {
    rbe,
    depensesNormalisees,
    rne,
    tgaPct,
    valeurCapitalisation,
  };
}
