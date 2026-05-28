/**
 * KPIs affichés sur la fiche acheteur (aperçu CRM / portail public).
 * Source : `residences/{id}/financial/dataV2.calculatedResults`.
 */

import {
  resolveEmpruntMaximumAutorise,
  resolveMiseDeFondsRequiseAcheteur,
} from '../financial/bankingSubscriptionLimits';
import type { FinancialCalc } from '../financial/normalizeFinancialData';

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
    empruntMaximum: resolveEmpruntMaximumAutorise(calculatedResults),
    miseDeFonds: resolveMiseDeFondsRequiseAcheteur(calculatedResults),
  };
}
