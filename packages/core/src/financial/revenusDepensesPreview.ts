/**
 * Aperçu live RNE / TGA — colonne « Normalisé » (Hub Finance).
 */

import {
  computeCapRatePctFromRneAndPrice,
  computeCapitalizedValueFromRneAndTgaPct,
  normalizeTgaPct,
  resolveRneFromRevenueAndExpenses,
} from './capitalization';

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
  const rne = resolveRneFromRevenueAndExpenses({
    revenuBrutEffectif: rbe,
    depensesExploitation: depensesNormalisees,
  });

  let tgaPct: number | null = null;
  if (rne != null && rne > 0 && prixDemande != null && prixDemande > 0) {
    tgaPct = computeCapRatePctFromRneAndPrice({ rne, price: prixDemande });
  } else if (tgaReferencePct != null && Number.isFinite(tgaReferencePct)) {
    tgaPct = normalizeTgaPct(tgaReferencePct);
  }

  const valeurCapitalisation = computeCapitalizedValueFromRneAndTgaPct({ rne, tgaPct });

  return {
    rbe,
    depensesNormalisees,
    rne,
    tgaPct,
    valeurCapitalisation,
  };
}
