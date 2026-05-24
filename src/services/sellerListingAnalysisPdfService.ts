/**
 * PDF vendeur — Analyse de valeur & stratégie de mise en marché (Sprint 0 ACM).
 */

import { jsPDF } from 'jspdf';
import {
  buildSellerListingAnalysisModel,
  type BuildSellerListingAnalysisInput,
  type SellerListingAnalysisModel,
} from '@primexpert/core/financial';

const NAVY: [number, number, number] = [20, 44, 106];
const GOLD: [number, number, number] = [212, 175, 55];
const MARGIN = 18;

function drawHeader(pdf: jsPDF, model: SellerListingAnalysisModel): number {
  const L = model.locale === 'fr';
  const w = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(...NAVY);
  pdf.rect(0, 0, w, 26, 'F');
  pdf.setFillColor(...GOLD);
  pdf.rect(0, 26, w, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('PRIMEXPERT', MARGIN, 12);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    L ? 'Analyse vendeur & stratégie de mise en marché' : 'Seller analysis & go-to-market strategy',
    MARGIN,
    20
  );
  pdf.setTextColor(0, 0, 0);
  return 34;
}

function addBullets(pdf: jsPDF, lines: string[], y: number, maxW: number): number {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(`• ${line}`, maxW) as string[];
    for (const wline of wrapped) {
      if (y > 260) {
        pdf.addPage();
        y = MARGIN;
      }
      pdf.text(wline, MARGIN, y);
      y += 5;
    }
    y += 1;
  }
  return y;
}

function renderSellerPdf(model: SellerListingAnalysisModel): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'letter' });
  const L = model.locale === 'fr';
  const w = pdf.internal.pageSize.getWidth();
  const maxW = w - MARGIN * 2;
  let y = drawHeader(pdf, model);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(...NAVY);
  y += 4;
  pdf.text(model.propertyTitle, MARGIN, y);
  y += 7;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  pdf.text(model.propertyAddress, MARGIN, y);
  y += 10;

  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(L ? 'Synthèse financière' : 'Financial summary', MARGIN, y);
  y += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const kpis = model.kpis;
  const lines = [
    `${L ? 'Revenu net d’exploitation (RNE)' : 'Net operating income (NOI)'} : ${kpis.revenuNetExploitation?.toLocaleString(L ? 'fr-CA' : 'en-CA') ?? '—'} $`,
    `${L ? 'Cash flow' : 'Cash flow'} : ${kpis.cashFlow?.toLocaleString(L ? 'fr-CA' : 'en-CA') ?? '—'} $`,
    model.capRateImpliedPct != null
      ? `${L ? 'Taux de capitalisation (TGA) implicite' : 'Implied cap rate'} : ${model.capRateImpliedPct.toFixed(2)} %`
      : '',
  ].filter(Boolean);
  y = addBullets(pdf, lines, y, maxW);

  if (model.tgaAdjustment) {
    y += 4;
    pdf.setFont('helvetica', 'bold');
    pdf.text(L ? 'Ajustement TGA — risque marché' : 'Cap rate adjustment — market risk', MARGIN, y);
    y += 6;
    y = addBullets(pdf, model.tgaAdjustment.rationale.slice(0, 4), y, maxW);
  }

  y += 4;
  pdf.setFont('helvetica', 'bold');
  pdf.text(L ? 'Scénarios d’occupation' : 'Occupancy scenarios', MARGIN, y);
  y += 6;
  for (const s of model.stressScenarios) {
    y = addBullets(
      pdf,
      [
        `${L ? s.labelFr : s.labelEn} — RNE : ${s.noi} · ${L ? 'Valeur' : 'Value'} : ${s.valueMin} – ${s.valueMax}`,
      ],
      y,
      maxW
    );
  }

  if (model.priceRecommendation) {
    y += 4;
    pdf.setFont('helvetica', 'bold');
    pdf.text(L ? 'Stratégie de prix' : 'Pricing strategy', MARGIN, y);
    y += 6;
    y = addBullets(pdf, model.priceRecommendation.rationale, y, maxW);
  }

  y += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.text(L ? 'Points clés' : 'Key points', MARGIN, y);
  y += 6;
  y = addBullets(pdf, L ? model.narrativeBulletsFr : model.narrativeBulletsEn, y, maxW);

  pdf.addPage();
  y = MARGIN;
  pdf.setFont('helvetica', 'bold');
  pdf.text(L ? 'Avis important' : 'Important notice', MARGIN, y);
  y += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const legal = L ? model.legalDisclaimersFr : model.legalDisclaimersEn;
  for (const p of legal) {
    const wrapped = pdf.splitTextToSize(p, maxW) as string[];
    for (const wline of wrapped) {
      pdf.text(wline, MARGIN, y);
      y += 4.5;
    }
    y += 2;
  }

  pdf.setFontSize(8);
  pdf.text(`${L ? 'Généré le' : 'Generated'} : ${model.generatedAtDisplay}`, MARGIN, 270);
  pdf.text(
    `${model.broker.brokerName} · ${model.broker.agencyName}`,
    MARGIN,
    275
  );

  return pdf;
}

export function downloadSellerListingAnalysisPdf(input: BuildSellerListingAnalysisInput): void {
  const model = buildSellerListingAnalysisModel(input);
  const pdf = renderSellerPdf(model);
  const stem = input.locale === 'fr' ? 'analyse-vendeur' : 'seller-analysis';
  pdf.save(`${stem}-${input.residence.id ?? 'residence'}.pdf`);
}

export { buildSellerListingAnalysisModel };
