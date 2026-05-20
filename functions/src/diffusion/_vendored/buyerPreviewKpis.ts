/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 *
 * Source canonique : packages/core/src/diffusion/
 * Régénéré par   : functions/scripts/sync-core-diffusion.cjs (prebuild)
 */
/**
 * KPIs affichés sur la fiche acheteur (aperçu CRM / portail public).
 * Source : `residences/{id}/financial/dataV2.calculatedResults`.
 */

import type { FinancialCalc } from './financialCalcTypes';

export interface BuyerPreviewKpiSnapshot {
  revenuNetExploitation: number | null;
  cashFlow: number | null;
  empruntMaximum: number | null;
  miseDeFonds: number | null;
}

function finiteNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function extractBuyerPreviewKpis(
  calculatedResults: FinancialCalc | null | undefined
): BuyerPreviewKpiSnapshot {
  if (!calculatedResults) {
    return {
      revenuNetExploitation: null,
      cashFlow: null,
      empruntMaximum: null,
      miseDeFonds: null,
    };
  }
  return {
    revenuNetExploitation: finiteNum(calculatedResults.revenuNetExploitation),
    cashFlow: finiteNum(calculatedResults.cashFlow),
    empruntMaximum:
      finiteNum(calculatedResults.empruntMaxTransaction) ??
      finiteNum(calculatedResults.empruntMaxDSCR) ??
      finiteNum(calculatedResults.hypothequeMaxRecommandee),
    miseDeFonds: finiteNum(calculatedResults.miseDeFondsRequise),
  };
}
