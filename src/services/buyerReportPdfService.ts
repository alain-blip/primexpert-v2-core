/**
 * Rapport financier acheteur — génération cloud CraftMyPDF.
 * Template : VITE_CRAFTMYPDF_BUYER_TEMPLATE_ID · grilles Revenus / Dépenses séparées.
 */

import { deriveRevenusAnnuelsFromTarification } from '@primexpert/core/identity/rentPricingGrid';
import {
  buildCertifiableFinancialReportModel,
  buildRevenusDepensesGrid,
  normalizeFinancialData,
  type BuildCertifiableFinancialReportInput,
  type FinancialDataV2Doc,
  type ResidenceFinancialHints,
} from '@primexpert/core/financial';
import { requestCraftMyPdfBlob, triggerBrowserDownload } from './craftMyPdfClient';
import { buildBrokerFooterFromProfile } from './certifiableReportPdfService';

export interface CraftMyPdfGridRow {
  poste: string;
  declare: number;
  normalise: number;
}

/** Variables dynamiques du template CraftMyPDF — rapport acheteur. */
export interface BuyerCraftMyPdfPayload {
  nom_residence: string;
  adresse_residence: string;
  nom_courtier: string;
  Grille_Revenus: CraftMyPdfGridRow[];
  Grille_Depenses: CraftMyPdfGridRow[];
}

export interface DownloadBuyerReportPdfInput extends BuildCertifiableFinancialReportInput {
  financialData: FinancialDataV2Doc | null | undefined;
}

const ANCILLARY_REVENUE_LINES: ReadonlyArray<{ key: string; labelFr: string; labelEn: string }> = [
  { key: 'revenusSubventions', labelFr: 'Subventions', labelEn: 'Subsidies' },
  { key: 'revenusRepas', labelFr: 'Revenus repas', labelEn: 'Meal revenue' },
  { key: 'revenusAutresServices', labelFr: 'Autres services', labelEn: 'Other services' },
  { key: 'revenusLocauxCommerciaux', labelFr: 'Locaux commerciaux', labelEn: 'Commercial units' },
  { key: 'revenusBuanderie', labelFr: 'Buanderie', labelEn: 'Laundry' },
  { key: 'revenusCoiffure', labelFr: 'Coiffure', labelEn: 'Hair salon' },
  { key: 'revenusPodologie', labelFr: 'Podologie', labelEn: 'Podiatry' },
  { key: 'revenusAutres', labelFr: 'Autres revenus', labelEn: 'Other revenue' },
];

function readBuyerTemplateId(): string {
  const templateId = import.meta.env.VITE_CRAFTMYPDF_BUYER_TEMPLATE_ID?.trim();
  if (!templateId) throw new Error('CRAFTMYPDF_BUYER_TEMPLATE_MISSING');
  return templateId;
}

function finiteNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function roundMoney(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.round(n);
}

function parseSourceAmount(sources: ReadonlyArray<Record<string, unknown> | null | undefined>, key: string): number {
  for (const src of sources) {
    if (!src || typeof src !== 'object' || !(key in src)) continue;
    const raw = src[key];
    if (raw === null || raw === undefined || raw === '') continue;
    const n = typeof raw === 'string' ? parseFloat(raw.replace(/[^\d.-]/g, '')) : Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function toGridRow(poste: string, declare: number, normalise: number): CraftMyPdfGridRow {
  return {
    poste,
    declare: roundMoney(declare),
    normalise: roundMoney(normalise),
  };
}

/**
 * Grille revenus — ligne principale « Revenus locatifs » + revenus annexes RPA détaillés.
 */
export function buildGrilleRevenus(
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints,
  locale: 'fr' | 'en' = 'fr'
): CraftMyPdfGridRow[] {
  const { calc, baseData } = normalizeFinancialData(financialData, residence);
  const sources: Array<Record<string, unknown> | null | undefined> = [
    baseData as Record<string, unknown> | null,
    calc as Record<string, unknown> | null,
    residence as Record<string, unknown>,
  ];

  const revenusLocatifsDeclare =
    finiteNum(calc?.revenusAnnuels) ??
    parseSourceAmount(sources, 'revenusAnnuels') ||
    deriveRevenusAnnuelsFromTarification(residence as Record<string, unknown>) ??
    0;

  const rbe = finiteNum(calc?.revenuBrutEffectif) ?? revenusLocatifsDeclare;

  let ancillaryTotal = 0;
  const ancillaryRows: CraftMyPdfGridRow[] = [];
  for (const line of ANCILLARY_REVENUE_LINES) {
    const amount = parseSourceAmount(sources, line.key);
    if (amount <= 0) continue;
    ancillaryTotal += amount;
    ancillaryRows.push(
      toGridRow(locale === 'fr' ? line.labelFr : line.labelEn, amount, amount)
    );
  }

  const tarif = parseSourceAmount(sources, 'tarifStationnement');
  const places = parseSourceAmount(sources, 'nbStationnementsPayants');
  if (tarif > 0 && places > 0) {
    const parking = tarif * places * 12;
    ancillaryTotal += parking;
    ancillaryRows.push(
      toGridRow(
        locale === 'fr' ? 'Stationnement' : 'Parking',
        parking,
        parking
      )
    );
  }

  const revenusLocatifsNormalise = Math.max(revenusLocatifsDeclare, rbe - ancillaryTotal);

  const rows: CraftMyPdfGridRow[] = [
    toGridRow(
      locale === 'fr' ? 'Revenus locatifs' : 'Rental income',
      revenusLocatifsDeclare,
      revenusLocatifsNormalise
    ),
    ...ancillaryRows,
  ];

  return rows.filter((r) => r.declare > 0 || r.normalise > 0);
}

/** Grille dépenses — postes d'exploitation (SSOT buildRevenusDepensesGrid). */
export function buildGrilleDepenses(
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints
): CraftMyPdfGridRow[] {
  const grid = buildRevenusDepensesGrid(financialData, residence);
  return grid.rows.map((row) => toGridRow(row.label, row.declared, row.normalized));
}

export function buildBuyerCraftMyPdfPayload(
  input: BuildCertifiableFinancialReportInput
): BuyerCraftMyPdfPayload {
  const model = buildCertifiableFinancialReportModel(input);
  const hints: ResidenceFinancialHints = {
    ...input.residence,
    prixDemande:
      input.residence.prixDemande ??
      input.residence.askingPrice ??
      finiteNum(input.financialData?.calculatedResults?.prixDemande),
    askingPrice:
      input.residence.askingPrice ??
      input.residence.prixDemande ??
      finiteNum(input.financialData?.calculatedResults?.prixDemande),
  };

  return {
    nom_residence: model.propertyTitle,
    adresse_residence: model.propertyAddress,
    nom_courtier: model.broker.brokerName,
    Grille_Revenus: buildGrilleRevenus(input.financialData, hints, model.locale),
    Grille_Depenses: buildGrilleDepenses(input.financialData, hints),
  };
}

function buildFilename(slug: string, stamp: string): string {
  return `primexpert-rapport-acheteur-${slug}-${stamp}.pdf`;
}

export async function downloadBuyerReportPdf(input: DownloadBuyerReportPdfInput): Promise<void> {
  const calc = input.financialData?.calculatedResults;
  if (!calc || typeof calc !== 'object') {
    throw new Error('BUYER_REPORT_NO_CALCULATED_RESULTS');
  }

  const model = buildCertifiableFinancialReportModel(input);
  const payload = buildBuyerCraftMyPdfPayload(input);
  const templateId = readBuyerTemplateId();
  const blob = await requestCraftMyPdfBlob(templateId, payload as unknown as Record<string, unknown>);

  const slug = (input.residence.id ?? 'acheteur').replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  const stamp = model.generatedAtDisplay.replace(/[^0-9]/g, '').slice(0, 14);
  triggerBrowserDownload(blob, buildFilename(slug, stamp));
}

export { buildBrokerFooterFromProfile };
