/**
 * Rapport financier détaillé / dossier d'investissement acheteur — CraftMyPDF.
 * Délègue à buyerReportPdfService (payload racine : Prix_Demande, Nom_Residence, Grille_*).
 */

import type { BuildDetailedFinancialReportInput, FinancialDataV2Doc } from '@primexpert/core/financial';
import { buildBrokerFooterFromProfile } from './certifiableReportPdfService';
import { downloadBuyerReportPdf, buildBuyerCraftMyPdfPayload } from './buyerReportPdfService';

export interface DownloadDetailedFinancialReportPdfInput
  extends BuildDetailedFinancialReportInput {
  financialData: FinancialDataV2Doc | null | undefined;
}

/** @deprecated Utiliser buildBuyerCraftMyPdfPayload — conservé pour compatibilité imports. */
export { buildBuyerCraftMyPdfPayload as buildCraftMyPdfPayload } from './buyerReportPdfService';

/**
 * Export PDF — même entrée Hub Finance, payload acheteur CraftMyPDF.
 */
export async function downloadDetailedFinancialReportPdf(
  input: DownloadDetailedFinancialReportPdfInput
): Promise<void> {
  await downloadBuyerReportPdf(
    {
      financialData: input.financialData,
      residence: input.residence,
      broker: input.broker,
      locale: input.locale,
      generatedAt: input.generatedAt,
    },
    { filenameStem: 'rapport-financier-detaille' }
  );
}

export { buildBrokerFooterFromProfile };
