/**
 * Rapport financier certifiable — génération PDF institutionnelle (jsPDF).
 * Modèle : invoicePdfService.ts — zéro window.print().
 */

import { jsPDF } from 'jspdf';
import {
  buildCertifiableFinancialReportModel,
  type BuildCertifiableFinancialReportInput,
  type CertifiableFinancialReportModel,
  type CertifiableReportBrokerFooter,
  type CertifiableReportExpenseRow,
  type FinancialDataV2Doc,
} from '@primexpert/core/financial';

const GOLD_RGB: [number, number, number] = [212, 175, 55];
const NAVY_RGB: [number, number, number] = [20, 44, 106];
const FOOTER_Y = 268;
const MARGIN = 18;
const ROW_MIN_H = 8;

export interface DownloadCertifiableReportPdfInput extends BuildCertifiableFinancialReportInput {
  financialData: FinancialDataV2Doc | null | undefined;
}

function pageWidth(pdf: jsPDF): number {
  return pdf.internal.pageSize.getWidth();
}

function drawInstitutionalHeader(pdf: jsPDF, model: CertifiableFinancialReportModel, yStart: number): number {
  const L = model.locale === 'fr';
  const w = pageWidth(pdf);
  let y = yStart;

  pdf.setFillColor(...NAVY_RGB);
  pdf.rect(0, 0, w, 28, 'F');
  pdf.setFillColor(...GOLD_RGB);
  pdf.rect(0, 28, w, 2.5, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('PRIMEXPERT', MARGIN, 14);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    L ? 'Rapport financier certifiable' : 'Certifiable financial report',
    MARGIN,
    22
  );

  pdf.setTextColor(0, 0, 0);
  y = 36;

  if (model.confidentialBanner) {
    pdf.setFillColor(255, 243, 224);
    pdf.setDrawColor(...GOLD_RGB);
    pdf.setLineWidth(0.4);
    pdf.rect(MARGIN, y - 2, w - MARGIN * 2, 10, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(120, 53, 15);
    pdf.text(model.confidentialBanner, w / 2, y + 5, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    y += 14;
  }

  return y;
}

function drawFooterOnAllPages(pdf: jsPDF, model: CertifiableFinancialReportModel): void {
  const L = model.locale === 'fr';
  const total = pdf.getNumberOfPages();
  const w = pageWidth(pdf);
  const brokerLine = [
    model.broker.brokerName,
    model.broker.licenseNumber
      ? `${L ? 'Permis OACIQ' : 'OACIQ license'} : ${model.broker.licenseNumber}`
      : null,
    model.broker.agencyName,
  ]
    .filter(Boolean)
    .join(' · ');

  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(...GOLD_RGB);
    pdf.setLineWidth(0.35);
    pdf.line(MARGIN, FOOTER_Y - 4, w - MARGIN, FOOTER_Y - 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(60, 60, 60);
    pdf.text(
      `${L ? 'Généré le' : 'Generated'} : ${model.generatedAtDisplay} · ${L ? 'Source' : 'Source'} : financial/dataV2.calculatedResults`,
      MARGIN,
      FOOTER_Y
    );
    pdf.text(brokerLine, MARGIN, FOOTER_Y + 4);
    pdf.text(`${L ? 'Page' : 'Page'} ${p} / ${total}`, w - MARGIN, FOOTER_Y + 4, { align: 'right' });
  }
}

function wrapLines(pdf: jsPDF, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(text, maxWidth) as string[];
}

function drawCoverBlock(pdf: jsPDF, model: CertifiableFinancialReportModel, y: number): number {
  const L = model.locale === 'fr';
  const w = pageWidth(pdf);
  const contentW = w - MARGIN * 2;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(...NAVY_RGB);
  y = wrapBlock(pdf, L ? 'RAPPORT FINANCIER CERTIFIABLE' : 'CERTIFIABLE FINANCIAL REPORT', MARGIN, y, contentW, 8);
  y += 4;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);
  y = wrapBlock(pdf, model.propertyTitle, MARGIN, y, contentW, 6);
  y = wrapBlock(pdf, model.propertyAddress, MARGIN, y, contentW, 5);
  y += 2;
  pdf.setFontSize(9);
  y = wrapBlock(
    pdf,
    `ID : ${model.residenceId || '—'}`,
    MARGIN,
    y,
    contentW,
    5
  );
  y = wrapBlock(
    pdf,
    `${L ? 'Horodatage certifiable' : 'Certifiable timestamp'} : ${model.generatedAtDisplay}`,
    MARGIN,
    y,
    contentW,
    5
  );
  y += 6;

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(...NAVY_RGB);
  pdf.roundedRect(MARGIN, y, contentW, 32, 2, 2, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(L ? 'Indicateurs clés (calculatedResults)' : 'Key indicators (calculatedResults)', MARGIN + 4, y + 8);
  pdf.setFont('helvetica', 'normal');
  const kpiLines: [string, string][] = L
    ? [
        ['Revenu net d’exploitation (RNE)', fmtKpi(model.kpis.revenuNetExploitation)],
        ['Cash flow', fmtKpi(model.kpis.cashFlow)],
        [
          'Emprunt maximum autorisé (le plus bas des critères)',
          fmtKpi(model.kpis.empruntMaximum),
        ],
        ['Mise de fonds requise (MFR)', fmtKpi(model.kpis.miseDeFonds)],
      ]
    : [
        ['Net operating income (NOI)', fmtKpi(model.kpis.revenuNetExploitation)],
        ['Cash flow', fmtKpi(model.kpis.cashFlow)],
        ['Maximum authorized loan (lowest of criteria)', fmtKpi(model.kpis.empruntMaximum)],
        ['Required down payment (RFR)', fmtKpi(model.kpis.miseDeFonds)],
      ];
  let ky = y + 14;
  for (const [label, value] of kpiLines) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, MARGIN + 4, ky);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, w - MARGIN - 4, ky, { align: 'right' });
    ky += 5;
  }
  return y + 38;
}

function fmtKpi(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n);
}

function wrapBlock(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineH: number
): number {
  const lines = wrapLines(pdf, text, maxWidth);
  pdf.text(lines, x, y);
  return y + lines.length * lineH;
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y) {
    pdf.addPage();
    return drawInstitutionalHeader(pdf, getModel(pdf), 36);
  }
  return y;
}

/** Stash model on pdf instance for header redraw — lightweight. */
const MODEL_KEY = '__certifiableReportModel';

function getModel(pdf: jsPDF): CertifiableFinancialReportModel {
  return (pdf as unknown as Record<string, CertifiableFinancialReportModel>)[MODEL_KEY];
}

function setModel(pdf: jsPDF, model: CertifiableFinancialReportModel): void {
  (pdf as unknown as Record<string, CertifiableFinancialReportModel>)[MODEL_KEY] = model;
}

function drawSummarySection(pdf: jsPDF, model: CertifiableFinancialReportModel, y: number): number {
  const L = model.locale === 'fr';
  const w = pageWidth(pdf);
  y = ensureSpace(pdf, y, 20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(...NAVY_RGB);
  pdf.text(L ? 'Synthèse des ratios (immuable)' : 'Ratio summary (immutable)', MARGIN, y);
  y += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  for (const row of model.summaryLines) {
    y = ensureSpace(pdf, y, 7);
    const label = L ? row.labelFr : row.labelEn;
    const value = L ? row.valueFr : row.valueEn;
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, MARGIN, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, w - MARGIN, y, { align: 'right' });
    y += 6;
  }
  return y + 4;
}

interface TableLayout {
  colPoste: number;
  colDecl: number;
  colNorm: number;
  colPct: number;
  colEnd: number;
}

function tableLayout(pdf: jsPDF): TableLayout {
  const w = pageWidth(pdf);
  return {
    colPoste: MARGIN,
    colDecl: MARGIN + 78,
    colNorm: MARGIN + 118,
    colPct: MARGIN + 158,
    colEnd: w - MARGIN,
  };
}

function drawExpenseTableHeader(pdf: jsPDF, model: CertifiableFinancialReportModel, y: number): number {
  const L = model.locale === 'fr';
  const cols = tableLayout(pdf);
  pdf.setFillColor(...NAVY_RGB);
  pdf.rect(MARGIN, y - 5, cols.colEnd - MARGIN, 9, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text(L ? 'Poste' : 'Line item', cols.colPoste + 2, y);
  pdf.text(L ? 'Déclaré' : 'Declared', cols.colDecl, y, { align: 'right' });
  pdf.text(L ? 'Normalisé' : 'Normalized', cols.colNorm, y, { align: 'right' });
  pdf.text(L ? '% RBE' : '% EGI', cols.colPct, y, { align: 'right' });
  pdf.setTextColor(0, 0, 0);
  return y + 8;
}

function measureExpenseRowHeight(
  pdf: jsPDF,
  row: CertifiableReportExpenseRow,
  cols: TableLayout
): number {
  const labelLines = wrapLines(pdf, row.label, cols.colDecl - cols.colPoste - 4);
  return Math.max(ROW_MIN_H, labelLines.length * 4.2 + 2);
}

function drawExpenseRow(
  pdf: jsPDF,
  row: CertifiableReportExpenseRow,
  y: number,
  stripe: boolean
): number {
  const cols = tableLayout(pdf);
  const rowH = measureExpenseRowHeight(pdf, row, cols);
  if (stripe) {
    pdf.setFillColor(248, 250, 252);
    pdf.rect(MARGIN, y - 4, cols.colEnd - MARGIN, rowH, 'F');
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  const labelLines = wrapLines(pdf, row.label, cols.colDecl - cols.colPoste - 4);
  pdf.text(labelLines, cols.colPoste + 2, y);
  pdf.text(row.declared, cols.colDecl, y, { align: 'right' });
  pdf.text(row.normalized, cols.colNorm, y, { align: 'right' });
  pdf.text(row.pctOfRbe, cols.colPct, y, { align: 'right' });
  return y + rowH;
}

function drawExpenseTable(pdf: jsPDF, model: CertifiableFinancialReportModel, y: number): number {
  const L = model.locale === 'fr';
  y = ensureSpace(pdf, y, 24);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(...NAVY_RGB);
  pdf.text(L ? 'Grille revenus et dépenses' : 'Revenue and expense grid', MARGIN, y);
  y += 8;
  y = drawExpenseTableHeader(pdf, model, y);

  model.expenseRows.forEach((row, index) => {
    const rowH = measureExpenseRowHeight(pdf, row, tableLayout(pdf));
    if (y + rowH > FOOTER_Y) {
      pdf.addPage();
      y = drawInstitutionalHeader(pdf, model, 36);
      y += 4;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(...NAVY_RGB);
      pdf.text(
        L ? 'Grille revenus et dépenses (suite)' : 'Revenue and expense grid (continued)',
        MARGIN,
        y
      );
      y += 8;
      y = drawExpenseTableHeader(pdf, model, y);
    }
    y = drawExpenseRow(pdf, row, y, index % 2 === 0);
  });

  y = ensureSpace(pdf, y, 16);
  pdf.setDrawColor(...GOLD_RGB);
  pdf.setLineWidth(0.4);
  const cols = tableLayout(pdf);
  pdf.line(MARGIN, y, cols.colEnd, y);
  y += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(L ? 'Total RBE' : 'Total EGI', cols.colPoste + 2, y);
  pdf.text(model.totals.rbe, cols.colDecl, y, { align: 'right' });
  y += 6;
  pdf.text(L ? 'Dépenses normalisées' : 'Normalized expenses', cols.colPoste + 2, y);
  pdf.text(model.totals.depensesNormalisees, cols.colNorm, y, { align: 'right' });
  y += 6;
  pdf.setTextColor(...NAVY_RGB);
  pdf.text(L ? 'Revenu net d’exploitation (RNE)' : 'Net operating income (NOI)', cols.colPoste + 2, y);
  pdf.text(model.totals.rne, cols.colNorm, y, { align: 'right' });
  pdf.setTextColor(0, 0, 0);
  return y + 8;
}

function drawLegalPage(pdf: jsPDF, model: CertifiableFinancialReportModel): void {
  pdf.addPage();
  let y = drawInstitutionalHeader(pdf, model, 36);
  const L = model.locale === 'fr';
  const w = pageWidth(pdf);
  const contentW = w - MARGIN * 2;
  const disclaimers = L ? model.legalDisclaimersFr : model.legalDisclaimersEn;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(...NAVY_RGB);
  pdf.text(L ? 'Mentions légales et limites' : 'Legal notices and limitations', MARGIN, y);
  y += 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  for (const paragraph of disclaimers) {
    y = ensureSpace(pdf, y, 20);
    y = wrapBlock(pdf, paragraph, MARGIN, y, contentW, 4.8) + 4;
  }

  y += 6;
  pdf.setFillColor(...GOLD_RGB);
  pdf.rect(MARGIN, y, contentW, 1.2, 'F');
  y += 8;
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  pdf.text(
    L
      ? 'Document immuable relativement aux calculs figés à l’horodatage ci-dessus. Conserver ce PDF pour la diligence OACIQ.'
      : 'Document immutable relative to calculations frozen at the timestamp above. Retain this PDF for brokerage diligence.',
    MARGIN,
    y,
    { maxWidth: contentW }
  );
}

/**
 * Génère le PDF et déclenche le téléchargement navigateur.
 */
export function downloadCertifiableFinancialReportPdf(
  input: DownloadCertifiableReportPdfInput
): void {
  const model = buildCertifiableFinancialReportModel(input);
  const pdf = new jsPDF({ unit: 'mm', format: 'letter' });
  setModel(pdf, model);

  let y = drawInstitutionalHeader(pdf, model, 36);
  y = drawCoverBlock(pdf, model, y + 4);
  y = drawSummarySection(pdf, model, y + 6);
  y = drawExpenseTable(pdf, model, y + 6);
  drawLegalPage(pdf, model);
  drawFooterOnAllPages(pdf, model);

  const slug = (input.residence.id ?? model.residenceId ?? 'fiche')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-10);
  const stamp = model.generatedAtDisplay.replace(/[^0-9]/g, '').slice(0, 14);
  pdf.save(`primexpert-rapport-certifiable-${slug}-${stamp}.pdf`);
}

export function buildBrokerFooterFromProfile(profile: {
  displayName?: string;
  licenseName?: string;
  agency?: string;
  title?: string;
} | null | undefined): CertifiableReportBrokerFooter {
  return {
    brokerName: profile?.displayName?.trim() || '—',
    licenseNumber: profile?.licenseName?.trim() || '—',
    agencyName: profile?.agency?.trim() || '—',
    brokerTitle: profile?.title?.trim() || undefined,
  };
}
