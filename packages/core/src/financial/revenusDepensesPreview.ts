/**
 * Aperçu live RNE / TGA — colonne « Normalisé » (Hub Finance).
 */

import {
  capitalizeNoiAtCapRatePct,
  computeCapitalizationRatePct,
  resolveNetOperatingIncome,
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
  const rne = resolveNetOperatingIncome(
    {
      revenuBrutEffectif: rbe,
      depensesExploitation: depensesNormalisees,
    },
    { allowNonPositive: true }
  );

  let tgaPct: number | null = null;
  if (rne != null && rne > 0 && prixDemande != null && prixDemande > 0) {
    tgaPct = computeCapitalizationRatePct(rne, prixDemande, 2);
  } else if (tgaReferencePct != null && Number.isFinite(tgaReferencePct)) {
    tgaPct = tgaReferencePct > 1 ? tgaReferencePct : tgaReferencePct * 100;
  }

  const valeurCapitalisation =
    rne != null && rne > 0 && tgaPct != null && tgaPct > 0
      ? capitalizeNoiAtCapRatePct(rne, tgaPct)
      : null;

  return {
    rbe,
    depensesNormalisees,
    rne,
    tgaPct,
    valeurCapitalisation,
  };
}
