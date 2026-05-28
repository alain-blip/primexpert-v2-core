/**
 * Vérification de conformité des règles de souscription bancaire — SSOT.
 * Emprunt maximum autorisé = min(capacité ratio de couverture (DSCR), plafond ratio prêt-valeur (RPV)).
 */

import type { FinancialCalc } from './normalizeFinancialData';

function finiteNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Retient le montant d'emprunt le plus restrictif parmi les critères bancaires disponibles.
 */
export function resolveEmpruntMaximumAutorise(
  calc: FinancialCalc | null | undefined
): number | null {
  if (!calc) return null;

  const parDscr = finiteNum(calc.empruntMaxDSCR);
  const parLtv = finiteNum(calc.plafondLtv);
  const retenu = finiteNum(calc.empruntMaxTransaction);
  const hypo = finiteNum(calc.hypothequeMaxRecommandee);

  const ceilings: number[] = [];
  if (parDscr != null && parDscr > 0) ceilings.push(parDscr);
  if (parLtv != null && parLtv > 0) ceilings.push(parLtv);

  if (ceilings.length > 0) {
    const minCeiling = Math.min(...ceilings);
    if (retenu != null && retenu > 0) return Math.min(minCeiling, retenu);
    return minCeiling;
  }

  if (retenu != null && parDscr != null && retenu > 0 && parDscr > 0) {
    return Math.min(retenu, parDscr);
  }
  if (retenu != null && retenu > 0) return retenu;
  if (parDscr != null && parDscr > 0) return parDscr;
  if (hypo != null && hypo > 0) return hypo;
  return null;
}

/**
 * Mise de fonds requise (MFR) = prix demandé − emprunt maximum autorisé.
 */
export function resolveMiseDeFondsRequiseAcheteur(
  calc: FinancialCalc | null | undefined,
  prixDemandeOverride?: number | null
): number | null {
  const prix =
    finiteNum(prixDemandeOverride) ?? finiteNum(calc?.prixDemande);
  const emprunt = resolveEmpruntMaximumAutorise(calc);
  if (prix != null && prix > 0 && emprunt != null && emprunt >= 0) {
    return Math.max(0, prix - emprunt);
  }
  return finiteNum(calc?.miseDeFondsRequise);
}
