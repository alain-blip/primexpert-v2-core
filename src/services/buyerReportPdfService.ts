/**
 * Rapport financier acheteur — génération cloud CraftMyPDF.
 * Template : VITE_CRAFTMYPDF_BUYER_TEMPLATE_ID · clés et formatage alignés sur le gabarit client.
 */

import { deriveRevenusAnnuelsFromTarification } from '@primexpert/core/identity';
import {
  buildCertifiableFinancialReportModel,
  buildRevenusDepensesGrid,
  computeFinancabilite,
  EXPENSE_FIELDS,
  normalizeFinancialData,
  normalizedOperatingAmount,
  resolvePrixDemande,
  type BuildCertifiableFinancialReportInput,
  type CertifiableFinancialReportModel,
  type CertifiableReportBrokerFooter,
  type DepensesGrid,
  type FinancialBaseData,
  type FinancialCalc,
  type FinancialDataV2Doc,
  type ResidenceFinancialHints,
} from '@primexpert/core/financial';
import { requestCraftMyPdfBlob, triggerBrowserDownload } from './craftMyPdfClient';
import { buildBrokerFooterFromProfile } from './certifiableReportPdfService';

/** Lignes tableau CraftMyPDF — clé gabarit : `Description` (D majuscule). */
export interface CraftMyPdfGridRow {
  Description: string;
  declare: string;
  normalise: string;
}

/** Variables dynamiques CraftMyPDF — rapport acheteur (toutes les valeurs en chaînes formatées). */
export interface BuyerCraftMyPdfPayload {
  Nom_Residence: string;
  Adresse_Residence: string;
  Nom_Courtier: string;
  Titre_Courtier: string;
  Agence_Courtier: string;
  Prix_Demande: string;
  RBE: string;
  Depenses_Totales: string;
  RNE: string;
  DSCR: string;
  Emprunt_Max: string;
  MFR: string;
  TGA: string;
  Ratio_Depenses: string;
  Rendement_Mise_Fonds: string;
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

const cadFormatter = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

function readBuyerTemplateId(): string {
  const buyerId = import.meta.env.VITE_CRAFTMYPDF_BUYER_TEMPLATE_ID?.trim();
  const fallbackId = import.meta.env.VITE_CRAFTMYPDF_TEMPLATE_ID?.trim();
  const templateId = buyerId || fallbackId;
  if (!templateId) throw new Error('CRAFTMYPDF_BUYER_TEMPLATE_MISSING');
  return templateId;
}

function finiteNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function safeNum(value: unknown): number {
  return finiteNum(value) ?? 0;
}

/** Montant en dollars canadiens (ex. « 1 191 743 $ »). */
export function fmtBuyerCad(amount: number | null | undefined): string {
  const n = finiteNum(amount);
  if (n == null) return cadFormatter.format(0);
  return cadFormatter.format(n);
}

/** Ratio décimal → pourcentage fr-CA (ex. « 7,50 % »). */
export function fmtBuyerPercent(ratio: number | null | undefined): string {
  const n = finiteNum(ratio);
  if (n == null) return '0,00 %';
  const pct = n > 1 && n <= 100 ? n : n * 100;
  return `${pct.toFixed(2).replace('.', ',')} %`;
}

/** DSCR — deux décimales, sans symbole (ex. « 1,25 »). */
export function fmtBuyerDscr(value: number | null | undefined): string {
  const n = finiteNum(value);
  if (n == null) return '0,00';
  return n.toFixed(2).replace('.', ',');
}

function textOrDash(value: string | null | undefined): string {
  const t = value?.trim();
  return t && t !== '—' ? t : '—';
}

/** Page couverture — résidence et courtier (Hub Finance / modèle certifiable). */
export function buildBuyerCoverFields(
  model: CertifiableFinancialReportModel
): Pick<
  BuyerCraftMyPdfPayload,
  'Nom_Residence' | 'Adresse_Residence' | 'Nom_Courtier' | 'Titre_Courtier' | 'Agence_Courtier'
> {
  const { broker, locale } = model;
  return {
    Nom_Residence: textOrDash(model.propertyTitle),
    Adresse_Residence: textOrDash(model.propertyAddress),
    Nom_Courtier: textOrDash(broker.brokerName),
    Titre_Courtier: resolveBrokerTitle(broker, locale),
    Agence_Courtier: textOrDash(broker.agencyName),
  };
}

function resolveBrokerTitle(broker: CertifiableReportBrokerFooter, locale: 'fr' | 'en'): string {
  const fromProfile = broker.brokerTitle?.trim();
  if (fromProfile) return fromProfile;
  return locale === 'fr' ? 'Courtier immobilier' : 'Licensed real estate broker';
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

function toFormattedGridRow(description: string, declare: number, normalise: number): CraftMyPdfGridRow {
  return {
    Description: description,
    declare: fmtBuyerCad(declare),
    normalise: fmtBuyerCad(normalise),
  };
}

/**
 * Firestore V2 peut stocker `depenses` / revenus à la racine du doc (legacy) plutôt que sous `baseData`.
 */
function coalesceFinancialDataForGrids(
  financialData: FinancialDataV2Doc | null | undefined
): FinancialDataV2Doc | null | undefined {
  if (!financialData) return financialData;
  const raw = financialData as Record<string, unknown>;
  const base: FinancialBaseData = { ...(financialData.baseData ?? {}) };

  if (!base.depenses && raw.depenses && typeof raw.depenses === 'object' && !Array.isArray(raw.depenses)) {
    base.depenses = raw.depenses as DepensesGrid;
  }
  if (!base.expenseAdjustments && raw.expenseAdjustments && typeof raw.expenseAdjustments === 'object') {
    base.expenseAdjustments = raw.expenseAdjustments as FinancialBaseData['expenseAdjustments'];
  }
  if (base.revenusAnnuels == null && raw.revenusAnnuels != null) {
    base.revenusAnnuels = raw.revenusAnnuels as FinancialBaseData['revenusAnnuels'];
  }
  if (!base.financement && raw.financement && typeof raw.financement === 'object') {
    base.financement = raw.financement as FinancialBaseData['financement'];
  }

  for (const key of [
    'revenusSubventions',
    'revenusRepas',
    'revenusAutresServices',
    'revenusLocauxCommerciaux',
    'revenusBuanderie',
    'revenusCoiffure',
    'revenusPodologie',
    'revenusAutres',
    'tarifStationnement',
    'nbStationnementsPayants',
  ] as const) {
    if ((base as Record<string, unknown>)[key] == null && raw[key] != null) {
      (base as Record<string, unknown>)[key] = raw[key];
    }
  }

  return { ...financialData, baseData: base };
}

function buildDepenseRowsFromDepensesObject(
  depenses: DepensesGrid,
  expenseAdjustments: Record<string, unknown> | undefined,
  locale: 'fr' | 'en'
): CraftMyPdfGridRow[] {
  const rows: CraftMyPdfGridRow[] = [];
  for (const field of EXPENSE_FIELDS) {
    const declared = parseSourceAmount([depenses], field.key);
    const normalized = normalizedOperatingAmount(field.key, depenses, expenseAdjustments ?? {});
    if (declared === 0 && normalized === 0) continue;
    rows.push(
      toFormattedGridRow(locale === 'fr' ? field.label : field.labelEn, declared, normalized)
    );
  }
  const autres = depenses.autresDepenses ?? [];
  autres.forEach((dep, index) => {
    const declared =
      typeof dep?.montant === 'number'
        ? dep.montant
        : parseSourceAmount([{ montant: dep?.montant }], 'montant');
    const autresAdj = expenseAdjustments?.autresDepenses;
    const adjustment = Array.isArray(autresAdj) ? parseSourceAmount([{ v: autresAdj[index] }], 'v') : 0;
    if (declared === 0 && adjustment === 0) return;
    const label =
      dep?.nom?.trim() ||
      (locale === 'fr' ? `Autre dépense ${index + 1}` : `Other expense ${index + 1}`);
    rows.push(toFormattedGridRow(label, declared, declared + adjustment));
  });
  return rows;
}

interface BuyerReportMetrics {
  prixDemande: number;
  rbe: number;
  depensesTotales: number;
  rne: number;
  dscr: number;
  empruntMax: number;
  mfr: number;
  tga: number;
  ratioDepenses: number;
  rendementMiseFonds: number;
  financingProgramLabel: string;
}

/** Même priorité que FinancabilitéTab : prix fiche inscription (`price`), pas `calc.prixDemande`. */
export function buildResidenceHintsForPdf(
  residence: BuildCertifiableFinancialReportInput['residence']
): ResidenceFinancialHints {
  const listing =
    safeNum((residence as { price?: unknown }).price) ||
    safeNum(residence.prixDemande) ||
    safeNum(residence.askingPrice);
  return {
    ...residence,
    price: listing,
    prixDemande: listing,
    askingPrice: listing,
  };
}

/**
 * SSOT aligné sur FinancabilitéTab : computeFinancabilite + resolvePrixDemande + grille Revenus & Dépenses.
 */
function resolveBuyerReportMetrics(
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints,
  calc: FinancialCalc,
  options?: { useAuditNoi?: boolean }
): BuyerReportMetrics {
  const dataForGrid = coalesceFinancialDataForGrids(financialData);
  const { baseData } = normalizeFinancialData(dataForGrid, residence);
  const grid = buildRevenusDepensesGrid(dataForGrid, residence);

  const fin = computeFinancabilite(dataForGrid, residence, {
    useAuditNoi: options?.useAuditNoi ?? false,
    formatCurrency: (n) => String(n ?? 0),
  });

  const prixDemande = safeNum(resolvePrixDemande(calc, residence, baseData));

  const rbe =
    safeNum(grid.rbe) ||
    safeNum(calc.revenuBrutEffectif) ||
    safeNum(calc.revenusAnnuels);

  /** Total déclaré uniquement (ex. 1 266 072 $) — jamais les montants normalisés. */
  const depensesTotales =
    safeNum(grid.depensesDeclareesTotal) ?? safeNum(calc.depensesTotales);

  const rne =
    safeNum(fin.noiRetenu) ??
    safeNum(fin.noiDeclare) ??
    safeNum(grid.noiDeclare) ??
    safeNum(calc.revenuNetExploitation);

  /** Emprunt retenu (scénario actif) — distinct de la MFR (Commercial pur). */
  const empruntMax = safeNum(fin.empruntMaxTransaction);
  let mfr = safeNum(fin.miseDeFondsRequise);
  if (prixDemande > 0 && empruntMax > 0 && (mfr <= 0 || Math.abs(mfr - empruntMax) < 1)) {
    mfr = Math.max(0, prixDemande - empruntMax);
  }

  const cashFlow = safeNum(calc.cashFlow) || safeNum(calc.surplusTresorerie);
  const rendementMiseFonds = mfr > 0 ? cashFlow / mfr : 0;

  const ratioDepenses =
    rbe > 0 && depensesTotales > 0
      ? depensesTotales / rbe
      : safeNum(calc.facteurDepenses);

  return {
    prixDemande,
    rbe,
    depensesTotales,
    rne,
    dscr: safeNum(fin.ratioCouverture),
    empruntMax,
    mfr,
    tga: safeNum(calc.tauxCapitalisation),
    ratioDepenses,
    rendementMiseFonds,
    financingProgramLabel: fin.financingProgramLabelFr ?? '—',
  };
}

/**
 * Grille revenus — ligne principale « Revenus locatifs » + revenus annexes RPA détaillés.
 */
export function buildGrilleRevenus(
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints,
  locale: 'fr' | 'en' = 'fr',
  metrics?: Pick<BuyerReportMetrics, 'rbe'>
): CraftMyPdfGridRow[] {
  const dataForGrid = coalesceFinancialDataForGrids(financialData);
  const { calc, baseData } = normalizeFinancialData(dataForGrid, residence);
  const sources: Array<Record<string, unknown> | null | undefined> = [
    baseData as Record<string, unknown> | null,
    calc as Record<string, unknown> | null,
    residence as Record<string, unknown>,
  ];

  const revenusLocatifsDeclare =
    finiteNum(calc?.revenusAnnuels) ??
    (parseSourceAmount(sources, 'revenusAnnuels') ||
      deriveRevenusAnnuelsFromTarification(residence as Record<string, unknown>) ||
      0);

  const rbe =
    finiteNum(calc?.revenuBrutEffectif) ??
    finiteNum(metrics?.rbe) ??
    revenusLocatifsDeclare;

  let ancillaryTotal = 0;
  const ancillaryRows: CraftMyPdfGridRow[] = [];
  for (const line of ANCILLARY_REVENUE_LINES) {
    const amount = parseSourceAmount(sources, line.key);
    if (amount <= 0) continue;
    ancillaryTotal += amount;
    ancillaryRows.push(
      toFormattedGridRow(locale === 'fr' ? line.labelFr : line.labelEn, amount, amount)
    );
  }

  const tarif = parseSourceAmount(sources, 'tarifStationnement');
  const places = parseSourceAmount(sources, 'nbStationnementsPayants');
  if (tarif > 0 && places > 0) {
    const parking = tarif * places * 12;
    ancillaryTotal += parking;
    ancillaryRows.push(
      toFormattedGridRow(locale === 'fr' ? 'Stationnement' : 'Parking', parking, parking)
    );
  }

  const revenusLocatifsNormalise = Math.max(revenusLocatifsDeclare, rbe - ancillaryTotal);

  const rows: CraftMyPdfGridRow[] = [
    toFormattedGridRow(
      locale === 'fr' ? 'Revenus locatifs' : 'Rental income',
      revenusLocatifsDeclare,
      revenusLocatifsNormalise
    ),
    ...ancillaryRows,
  ];

  if (rbe > 0 && ancillaryRows.length > 0) {
    rows.push(
      toFormattedGridRow(
        locale === 'fr' ? 'Revenu brut effectif (RBE)' : 'Effective gross income (EGI)',
        rbe,
        rbe
      )
    );
  }

  if (rows.length > 0) return rows;
  if (rbe > 0) {
    return [
      toFormattedGridRow(
        locale === 'fr' ? 'Revenu brut effectif (RBE)' : 'Effective gross income (EGI)',
        rbe,
        rbe
      ),
    ];
  }
  return [toFormattedGridRow(locale === 'fr' ? 'Revenus locatifs' : 'Rental income', 0, 0)];
}

/** Grille dépenses — postes d'exploitation (SSOT buildRevenusDepensesGrid). */
export function buildGrilleDepenses(
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints,
  locale: 'fr' | 'en' = 'fr',
  metrics?: Pick<BuyerReportMetrics, 'depensesTotales'>
): CraftMyPdfGridRow[] {
  const dataForGrid = coalesceFinancialDataForGrids(financialData);
  const { baseData } = normalizeFinancialData(dataForGrid, residence);
  const grid = buildRevenusDepensesGrid(dataForGrid, residence);

  let rows = grid.rows.map((row) => toFormattedGridRow(row.label, row.declared, row.normalized));

  if (rows.length === 0 && baseData?.depenses) {
    rows = buildDepenseRowsFromDepensesObject(
      baseData.depenses,
      (baseData.expenseAdjustments ?? {}) as Record<string, unknown>,
      locale
    );
  }

  if (rows.length === 0 && safeNum(metrics?.depensesTotales) > 0) {
    const total = safeNum(metrics?.depensesTotales);
    rows = [
      toFormattedGridRow(
        locale === 'fr' ? 'Total des dépenses (déclarées)' : 'Total expenses (declared)',
        total,
        total
      ),
    ];
  }

  return rows.length > 0 ? rows : [toFormattedGridRow(locale === 'fr' ? 'Aucun poste saisi' : 'No line items', 0, 0)];
}

export function buildBuyerCraftMyPdfPayload(
  input: BuildCertifiableFinancialReportInput
): BuyerCraftMyPdfPayload {
  const calc = input.financialData?.calculatedResults;
  if (!calc || typeof calc !== 'object') {
    throw new Error('BUYER_REPORT_NO_CALCULATED_RESULTS');
  }

  const hints = buildResidenceHintsForPdf(input.residence);
  const dataForGrid = coalesceFinancialDataForGrids(input.financialData);
  const model = buildCertifiableFinancialReportModel({
    ...input,
    residence: hints,
    financialData: dataForGrid,
  });
  const metrics = resolveBuyerReportMetrics(dataForGrid, hints, calc as FinancialCalc);
  const cover = buildBuyerCoverFields(model);

  const grilleRevenus = buildGrilleRevenus(dataForGrid, hints, model.locale, metrics);
  const grilleDepenses = buildGrilleDepenses(dataForGrid, hints, model.locale, metrics);

  const payload: BuyerCraftMyPdfPayload = {
    ...cover,
    Prix_Demande: fmtBuyerCad(metrics.prixDemande),
    RBE: fmtBuyerCad(metrics.rbe),
    Depenses_Totales: fmtBuyerCad(metrics.depensesTotales),
    RNE: fmtBuyerCad(metrics.rne),
    DSCR: fmtBuyerDscr(metrics.dscr),
    Emprunt_Max: fmtBuyerCad(metrics.empruntMax),
    MFR: fmtBuyerCad(metrics.mfr),
    TGA: fmtBuyerPercent(metrics.tga),
    Ratio_Depenses: fmtBuyerPercent(metrics.ratioDepenses),
    Rendement_Mise_Fonds: fmtBuyerPercent(metrics.rendementMiseFonds),
    Grille_Revenus: grilleRevenus,
    Grille_Depenses: grilleDepenses,
  };

  console.log('PAYLOAD ENVOYÉ À CRAFTMYPDF :', {
    Prix_Demande: payload.Prix_Demande,
    Depenses_Totales: payload.Depenses_Totales,
    Emprunt_Max: payload.Emprunt_Max,
    MFR: payload.MFR,
    programme: metrics.financingProgramLabel,
    Grille_Revenus_count: payload.Grille_Revenus.length,
    Grille_Depenses_count: payload.Grille_Depenses.length,
    Grille_Revenus: payload.Grille_Revenus,
    Grille_Depenses: payload.Grille_Depenses,
    data: payload,
  });

  return payload;
}

function buildFilename(slug: string, stamp: string, stem = 'rapport-financier-detaille'): string {
  return `primexpert-${stem}-${slug}-${stamp}.pdf`;
}

export interface DownloadBuyerReportPdfOptions {
  /** Préfixe du nom de fichier (défaut : rapport financier détaillé / dossier investissement). */
  filenameStem?: string;
}

export async function downloadBuyerReportPdf(
  input: DownloadBuyerReportPdfInput,
  options?: DownloadBuyerReportPdfOptions
): Promise<void> {
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
  triggerBrowserDownload(blob, buildFilename(slug, stamp, options?.filenameStem));
}

export { buildBrokerFooterFromProfile };
