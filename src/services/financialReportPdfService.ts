/**
 * Rapport financier détaillé — export PDF (React + html2pdf.js).
 * Modèle données : buildDetailedFinancialReportModel (Core).
 */

import { createElement } from 'react';
import {
  buildDetailedFinancialReportModel,
  type BuildDetailedFinancialReportInput,
  type DetailedFinancialReportModel,
  type FinancialDataV2Doc,
} from '@primexpert/core/financial';
import { DetailedFinancialReportTemplate } from '../components/pdf-templates/DetailedFinancialReportTemplate';
import { renderReactTemplateToPdf } from './pdfGenerationService';
import { buildBrokerFooterFromProfile } from './certifiableReportPdfService';

export interface DownloadDetailedFinancialReportPdfInput
  extends BuildDetailedFinancialReportInput {
  financialData: FinancialDataV2Doc | null | undefined;
}

function buildFilename(slug: string, model: DetailedFinancialReportModel): string {
  const stamp = model.generatedAtDisplay.replace(/[^0-9]/g, '').slice(0, 14);
  return `primexpert-rapport-financier-detaille-${slug}-${stamp}.pdf`;
}

export async function downloadDetailedFinancialReportPdfFromModel(
  model: DetailedFinancialReportModel,
  residenceId?: string
): Promise<void> {
  const slug = (residenceId ?? 'detail').replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  await renderReactTemplateToPdf(
    () => createElement(DetailedFinancialReportTemplate, { model }),
    { filename: buildFilename(slug, model) }
  );
}

export async function downloadDetailedFinancialReportPdf(
  input: DownloadDetailedFinancialReportPdfInput
): Promise<void> {
  const calc = input.financialData?.calculatedResults;
  if (!calc || typeof calc !== 'object') {
    throw new Error('DETAILED_REPORT_NO_CALCULATED_RESULTS');
  }
  const model = buildDetailedFinancialReportModel(input);
  await downloadDetailedFinancialReportPdfFromModel(model, input.residence.id);
}

export { buildBrokerFooterFromProfile };
