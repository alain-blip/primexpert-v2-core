/**
 * Aperçu live RNE / TGA — colonne « Normalisé » (Hub Finance).
 */

import {
  computeCapitalizationRateFromNoi,
  computeCapitalizedValueFromNoi,
  normalizeCapitalizationRatePct,
} from './capitalizationMetrics';

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
    tgaPct = normalizeCapitalizationRatePct(
      computeCapitalizationRateFromNoi(rne, prixDemande)
    );
  } else if (tgaReferencePct != null && Number.isFinite(tgaReferencePct)) {
    tgaPct = normalizeCapitalizationRatePct(tgaReferencePct);
  }

  const valeurCapitalisation = computeCapitalizedValueFromNoi(rne, tgaPct);

  return {
    rbe,
    depensesNormalisees,
    rne,
    tgaPct,
    valeurCapitalisation,
  };
}
