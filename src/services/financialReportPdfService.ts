/**
 * Rapport financier détaillé — génération cloud CraftMyPDF.
 * Données : buildDetailedFinancialReportModel (Core) · rendu : template client CraftMyPDF.
 */

import {
  buildDetailedFinancialReportModel,
  buildRevenusDepensesGrid,
  type BuildDetailedFinancialReportInput,
  type DetailedFinancialReportModel,
  type FinancialCalc,
  type FinancialDataV2Doc,
  type ResidenceFinancialHints,
} from '@primexpert/core/financial';
import { buildBrokerFooterFromProfile } from './certifiableReportPdfService';

const CRAFTMYPDF_CREATE_URL = 'https://api.craftmypdf.com/v1/create';

export interface CraftMyPdfDepenseRow {
  poste: string;
  declare: number;
  normalise: number;
}

/** Variables dynamiques attendues par le template CraftMyPDF du client. */
export interface CraftMyPdfReportPayload {
  nom_residence: string;
  adresse_residence: string;
  nom_courtier: string;
  RBE: number;
  RNE: number;
  prix_demande: number;
  emprunt_max: number;
  mfr: number;
  cash_flow: number;
  tga: number;
  mrn: number;
  dépenses: CraftMyPdfDepenseRow[];
}

export interface BuildCraftMyPdfPayloadOptions {
  calc?: FinancialCalc;
  financialData?: FinancialDataV2Doc | null;
  residence?: ResidenceFinancialHints;
}

export interface DownloadDetailedFinancialReportPdfInput
  extends BuildDetailedFinancialReportInput {
  financialData: FinancialDataV2Doc | null | undefined;
}

interface CraftMyPdfConfig {
  apiKey: string;
  templateId: string;
}

interface CraftMyPdfCreateResponse {
  status?: string;
  download_url?: string;
  file?: string;
  message?: string;
  error?: string;
}

function readCraftMyPdfConfig(): CraftMyPdfConfig {
  const apiKey = import.meta.env.VITE_CRAFTMYPDF_API_KEY?.trim();
  const templateId = import.meta.env.VITE_CRAFTMYPDF_TEMPLATE_ID?.trim();
  if (!apiKey || !templateId) {
    throw new Error('CRAFTMYPDF_CONFIG_MISSING');
  }
  return { apiKey, templateId };
}

function finiteNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function roundMoney(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.round(n);
}

/** Parse une valeur affichée (ex. « 1 251 656 $ », « 5,25 % », « 12,5× »). */
export function parseDisplayAmount(value: string): number | null {
  const raw = value.trim();
  if (!raw || raw === '—' || raw === '-') return null;

  const isPercent = /%/.test(raw);
  const isMultiplier = /×|x/i.test(raw);
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/\$/g, '')
    .replace(/%|×|x/gi, '')
    .replace(/,/g, '.')
    .replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  if (isPercent) return n / 100;
  if (isMultiplier) return n;
  return n;
}

function findRowValue(
  rows: { labelFr: string; labelEn: string; value: string }[],
  locale: 'fr' | 'en',
  frNeedle: string,
  enNeedle: string
): string {
  const row = rows.find((r) => {
    const label = locale === 'fr' ? r.labelFr : r.labelEn;
    const needle = locale === 'fr' ? frNeedle : enNeedle;
    return label.includes(needle);
  });
  return row?.value ?? '—';
}

function resolvePrixDemande(model: DetailedFinancialReportModel, calc?: FinancialCalc): number {
  const fromCalc = finiteNum(calc?.prixDemande);
  if (fromCalc != null) return roundMoney(fromCalc);
  const display = findRowValue(
    model.financingRows,
    model.locale,
    'Prix demandé',
    'Asking price'
  );
  return roundMoney(parseDisplayAmount(display));
}

function resolveEmpruntMax(model: DetailedFinancialReportModel, calc?: FinancialCalc): number {
  const fromCalc =
    finiteNum(calc?.hypothequeMaxRecommandee) ??
    finiteNum(calc?.empruntMaxTransaction) ??
    finiteNum(calc?.montantHypotheque);
  if (fromCalc != null) return roundMoney(fromCalc);
  const display =
    findRowValue(model.financingRows, model.locale, 'Emprunt retenu', 'Loan retained') ||
    findRowValue(model.financingRows, model.locale, 'Emprunt maximal', 'Maximum loan');
  return roundMoney(parseDisplayAmount(display));
}

function resolveTga(model: DetailedFinancialReportModel, calc?: FinancialCalc): number {
  const fromCalc = finiteNum(calc?.tauxCapitalisation);
  if (fromCalc != null) {
    return fromCalc > 1 ? fromCalc / 100 : fromCalc;
  }
  const display = findRowValue(
    model.yieldRows,
    model.locale,
    'Taux de capitalisation',
    'Capitalization rate'
  );
  const parsed = parseDisplayAmount(display);
  if (parsed == null) return 0;
  return parsed > 1 ? parsed / 100 : parsed;
}

function resolveMrn(model: DetailedFinancialReportModel, calc?: FinancialCalc): number {
  const fromCalc = finiteNum(calc?.facteurRevenuNet);
  if (fromCalc != null) return fromCalc;
  const display = findRowValue(model.yieldRows, model.locale, 'MRN', 'MRN');
  return parseDisplayAmount(display) ?? 0;
}

function buildDepensesRows(
  model: DetailedFinancialReportModel,
  options?: BuildCraftMyPdfPayloadOptions
): CraftMyPdfDepenseRow[] {
  if (options?.financialData && options.residence) {
    const grid = buildRevenusDepensesGrid(options.financialData, options.residence);
    return grid.rows.map((row) => ({
      poste: row.label,
      declare: roundMoney(row.declared),
      normalise: roundMoney(row.normalized),
    }));
  }
  return model.expenseRows.map((row) => ({
    poste: row.label,
    declare: roundMoney(parseDisplayAmount(row.declared)),
    normalise: roundMoney(parseDisplayAmount(row.normalized)),
  }));
}

/**
 * Construit le JSON `data` attendu par le template CraftMyPDF du client.
 */
export function buildCraftMyPdfPayload(
  model: DetailedFinancialReportModel,
  options?: BuildCraftMyPdfPayloadOptions
): CraftMyPdfReportPayload {
  const calc = options?.calc;
  const rbe =
    finiteNum(calc?.revenuBrutEffectif) ??
    finiteNum(calc?.revenusAnnuels) ??
    parseDisplayAmount(model.revenueSummary.rbe);
  const rne =
    finiteNum(calc?.revenuNetExploitation) ?? parseDisplayAmount(model.totals.rne);
  const cashFlow =
    finiteNum(calc?.cashFlow) ??
    finiteNum(calc?.surplusTresorerie) ??
    parseDisplayAmount(
      findRowValue(model.yieldRows, model.locale, 'Cash flow annuel', 'Annual cash flow')
    );
  const mfr =
    finiteNum(calc?.miseDeFondsRequise) ??
    parseDisplayAmount(
      findRowValue(
        model.financingRows,
        model.locale,
        'Mise de fonds requise',
        'Required down payment'
      )
    );

  return {
    nom_residence: model.propertyTitle,
    adresse_residence: model.propertyAddress,
    nom_courtier: model.broker.brokerName,
    RBE: roundMoney(rbe),
    RNE: roundMoney(rne),
    prix_demande: resolvePrixDemande(model, calc),
    emprunt_max: resolveEmpruntMax(model, calc),
    mfr: roundMoney(mfr),
    cash_flow: roundMoney(cashFlow),
    tga: resolveTga(model, calc),
    mrn: resolveMrn(model, calc),
    dépenses: buildDepensesRows(model, options),
  };
}

function buildFilename(slug: string, model: DetailedFinancialReportModel): string {
  const stamp = model.generatedAtDisplay.replace(/[^0-9]/g, '').slice(0, 14);
  return `primexpert-rapport-financier-detaille-${slug}-${stamp}.pdf`;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  URL.revokeObjectURL(url);
}

function extractPdfDownloadUrl(body: CraftMyPdfCreateResponse): string {
  const url = body.download_url ?? body.file;
  if (typeof url === 'string' && url.startsWith('http')) return url;
  throw new Error(body.message ?? body.error ?? 'CRAFTMYPDF_NO_DOWNLOAD_URL');
}

/** POST /v1/create — retourne le Blob PDF (via URL pré-signée ou binaire). */
export async function requestCraftMyPdfBlob(
  payload: CraftMyPdfReportPayload,
  config: CraftMyPdfConfig = readCraftMyPdfConfig()
): Promise<Blob> {
  const response = await fetch(CRAFTMYPDF_CREATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': config.apiKey,
    },
    body: JSON.stringify({
      template_id: config.templateId,
      data: payload,
      export_type: 'json',
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`CRAFTMYPDF_HTTP_${response.status}:${errText.slice(0, 200)}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/pdf')) {
    return response.blob();
  }

  const body = (await response.json()) as CraftMyPdfCreateResponse;
  if (body.status && body.status !== 'success' && body.status !== 'completed') {
    throw new Error(body.message ?? body.error ?? `CRAFTMYPDF_STATUS_${body.status}`);
  }

  const pdfUrl = extractPdfDownloadUrl(body);
  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) {
    throw new Error(`CRAFTMYPDF_PDF_FETCH_${pdfResponse.status}`);
  }
  return pdfResponse.blob();
}

export async function downloadDetailedFinancialReportPdfFromModel(
  model: DetailedFinancialReportModel,
  residenceId?: string,
  options?: BuildCraftMyPdfPayloadOptions
): Promise<void> {
  const slug = (residenceId ?? 'detail').replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  const filename = buildFilename(slug, model);
  const payload = buildCraftMyPdfPayload(model, options);
  const blob = await requestCraftMyPdfBlob(payload);
  triggerBrowserDownload(blob, filename);
}

export async function downloadDetailedFinancialReportPdf(
  input: DownloadDetailedFinancialReportPdfInput
): Promise<void> {
  const calc = input.financialData?.calculatedResults;
  if (!calc || typeof calc !== 'object') {
    throw new Error('DETAILED_REPORT_NO_CALCULATED_RESULTS');
  }
  const model = buildDetailedFinancialReportModel(input);
  const residenceHints: ResidenceFinancialHints = {
    ...input.residence,
    prixDemande:
      input.residence.prixDemande ?? input.residence.askingPrice ?? calc.prixDemande,
    askingPrice:
      input.residence.askingPrice ?? input.residence.prixDemande ?? calc.prixDemande,
  };
  await downloadDetailedFinancialReportPdfFromModel(model, input.residence.id, {
    calc: calc as FinancialCalc,
    financialData: input.financialData,
    residence: residenceHints,
  });
}

export { buildBrokerFooterFromProfile };
