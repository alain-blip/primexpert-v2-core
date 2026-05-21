/**
 * Présentation de mise en marché ACM — export PDF (React + html2pdf.js).
 * Modèle données : buildAcmPresentationReportModel (Core).
 */

import {
  buildAcmPresentationReportModel,
  type AcmPresentationReportModel,
  type BuildAcmPresentationReportInput,
  type FinancialDataV2Doc,
} from '@primexpert/core/financial';
import { createElement } from 'react';
import { AcmPresentationTemplate } from '../components/pdf-templates/AcmPresentationTemplate';
import { renderReactTemplateToPdf } from './pdfGenerationService';
import {
  buildBrokerFooterFromProfile,
  type CertifiableReportBrokerFooter,
} from './certifiableReportPdfService';

export interface DownloadAcmPresentationPdfInput extends BuildAcmPresentationReportInput {
  financialData: FinancialDataV2Doc | null | undefined;
}

export interface AcmPresentationBrokerInput extends CertifiableReportBrokerFooter {
  phone?: string;
}

function buildFilename(slug: string, model: AcmPresentationReportModel): string {
  const stamp = model.generatedAtDisplay.replace(/[^0-9]/g, '').slice(0, 14);
  return `primexpert-presentation-acm-${slug}-${stamp}.pdf`;
}

export async function downloadAcmPresentationPdfFromModel(
  model: AcmPresentationReportModel,
  residenceId?: string
): Promise<void> {
  const slug = (residenceId ?? 'acm').replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  await renderReactTemplateToPdf(
    () => createElement(AcmPresentationTemplate, { model }),
    { filename: buildFilename(slug, model) }
  );
}

export async function downloadAcmPresentationPdf(
  input: DownloadAcmPresentationPdfInput
): Promise<void> {
  const model = buildAcmPresentationReportModel(input);
  await downloadAcmPresentationPdfFromModel(model, input.residence.id);
}

export function buildAcmBrokerFromProfile(
  profile: {
    displayName?: string;
    licenseName?: string;
    agency?: string;
    title?: string;
    phone?: string;
  } | null | undefined,
  locale: 'fr' | 'en' = 'fr'
): AcmPresentationBrokerInput & { titleLine: string } {
  const base = buildBrokerFooterFromProfile(profile);
  return {
    ...base,
    phone: profile?.phone?.trim(),
    titleLine:
      locale === 'fr'
        ? 'Courtier immobilier agréé DA'
        : 'Licensed real estate broker (DA)',
  };
}
