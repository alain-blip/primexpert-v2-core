/**
 * Rapport vendeur (analyse de mise en marché — ACM) — génération cloud CraftMyPDF.
 * Template : VITE_CRAFTMYPDF_ACM_VENDOR_TEMPLATE_ID (défaut PO : acd77b235dc3edba).
 * Payload snake_case aligné sur le gabarit vendeur — distinct du dossier acheteur.
 */

import {
  buildRevenusDepensesGrid,
  computeFinancabilite,
  resolveEmpruntMaximumAutorise,
  resolveMiseDeFondsRequiseAcheteur,
  type CertifiableReportBrokerFooter,
  type FinancialCalc,
  type FinancialDataV2Doc,
  type ResidenceFinancialHints,
} from '@primexpert/core/financial';
import type { ResidenceAcmBootstrap, ValuationOutputs } from '@primexpert/core/valuation';
import { getListingPrice, isOffMarketListing, resolveListingSource, resolveOffMarketConfidentialBanner } from '@primexpert/core/residence';
import { requestCraftMyPdfBlob, triggerBrowserDownload } from './craftMyPdfClient';
import {
  buildGrilleDepenses,
  buildGrilleRevenus,
  buildResidenceHintsForPdf,
  coalesceFinancialDataForGrids,
  fmtBuyerCad,
  fmtBuyerDscr,
  fmtBuyerPercent,
  type CraftMyPdfGridRow,
} from './buyerReportPdfService';

/** Ligne tableau page 5 — gabarit CraftMyPDF. */
export interface AcmVendorListeRow {
  categorie: string;
  declare: string;
  normalise: string;
}

/** Page couverture — clés gabarit CraftMyPDF (PascalCase, racine). */
export interface AcmVendorCoverCraftMyPdfFields {
  Nom_Residence: string;
  Adresse_Residence: string;
  Nom_Courtier: string;
  Titre_Courtier: string;
  Agence_Courtier: string;
}

/** Page 6 — indicateurs financiers (snake_case, racine). */
export interface AcmVendorPage6CraftMyPdfFields {
  revenus_brut: string;
  depenses_exploitation: string;
  /** Clé gabarit PO (orthographe WORM — ne pas renommer). */
  revenus_net_baiia: string;
  capacite_emprunt_estimee: string;
  /** Clé gabarit PO (orthographe WORM — ne pas renommer). */
  mise_de_fonds_minimale_es: string;
  tga: string;
  ratio_depenses_exploitation: string;
  rcd: string;
  rendement_mise_fonds: string;
}

/** Variables dynamiques CraftMyPDF — rapport vendeur ACM (valeurs formatées en chaînes). */
export interface AcmVendorCraftMyPdfPayload
  extends AcmVendorCoverCraftMyPdfFields,
    AcmVendorPage6CraftMyPdfFields {
  liste_revenus: AcmVendorListeRow[];
  liste_depenses: AcmVendorListeRow[];
  /** Alias historiques — conservés pour les pages prix / narratif. */
  nom_residence: string;
  adresse_residence: string;
  nom_courtier: string;
  titre_courtier: string;
  agence_courtier: string;
  region: string;
  nombre_unites: string;
  rbe: string;
  opex: string;
  rne: string;
  prix_demande: string;
  prix_suggere: string;
  prix_plancher: string;
  prix_plafond: string;
  valeur_banquable: string;
  dscr: string;
  prix_recommande: string;
  lecture_vendeur: string;
  /** En-tête confidentialité hors marché (CraftMyPDF). */
  document_confidentiel?: string;
}

export interface BuildAcmVendorCraftMyPdfPayloadInput {
  bootstrap: ResidenceAcmBootstrap;
  valuation: ValuationOutputs;
  broker: CertifiableReportBrokerFooter;
  locale: 'fr' | 'en';
  residenceAddress?: string;
  /** TGA effectif appliqué (ratio décimal, ex. 0.075). */
  effectiveCapRate: number;
  recommendedPrice?: number | null;
  sellerNarrative?: string | null;
  /** SSOT grilles + financabilité (financial/dataV2). */
  financialData: FinancialDataV2Doc;
  residence: ResidenceFinancialHints;
}

export interface DownloadAcmVendorReportPdfInput extends BuildAcmVendorCraftMyPdfPayloadInput {
  residenceId?: string;
}

export interface AcmVendorBankingMetrics {
  capaciteEmprunt: number;
  miseDeFondsMinimale: number;
  rcd: number;
  rendementMiseFonds: number;
  ratioDepenses: number;
  depensesTotales: number;
}

const ACM_VENDOR_TEMPLATE_ID_DEFAULT = 'acd77b235dc3edba';

function readAcmVendorTemplateId(): string {
  const fromEnv = import.meta.env.VITE_CRAFTMYPDF_ACM_VENDOR_TEMPLATE_ID?.trim();
  return fromEnv || ACM_VENDOR_TEMPLATE_ID_DEFAULT;
}

function safeNum(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function textOrDash(value: string | null | undefined): string {
  const t = value?.trim();
  return t && t !== '—' ? t : '—';
}

function resolveBrokerTitle(broker: CertifiableReportBrokerFooter, locale: 'fr' | 'en'): string {
  const fromProfile = broker.brokerTitle?.trim();
  if (fromProfile) return fromProfile;
  return locale === 'fr' ? 'Courtier immobilier' : 'Licensed real estate broker';
}

function resolveOpexAmount(
  bootstrap: ResidenceAcmBootstrap,
  valuation: ValuationOutputs,
  depensesFromGrid: number
): number {
  if (depensesFromGrid > 0) return depensesFromGrid;
  const fromEngine = valuation.operatingExpensesTotal;
  if (Number.isFinite(fromEngine) && fromEngine > 0) return fromEngine;
  const rbe = bootstrap.revenuBrutEffectif;
  const rne = bootstrap.revenuNetExploitation;
  if (rbe > 0 && rne >= 0 && rne < rbe) return rbe - rne;
  return 0;
}

function mapGrilleRowsToListe(rows: CraftMyPdfGridRow[]): AcmVendorListeRow[] {
  return rows.map((row) => ({
    categorie: row.Description,
    declare: row.declare,
    normalise: row.normalise,
  }));
}

function residenceHintsAtPrice(
  residence: ResidenceFinancialHints,
  prixReference: number
): ResidenceFinancialHints {
  const base = buildResidenceHintsForPdf(residence);
  return {
    ...base,
    price: prixReference,
    prixDemande: prixReference,
    askingPrice: prixReference,
  };
}

/**
 * Banquabilité page 6 — prix suggéré ACM, RCD/rendement depuis calculatedResults en priorité.
 * Mise de fonds = prix suggéré − capacité d'emprunt (empruntMaxTransaction au prix suggéré).
 */
export function resolveAcmVendorBankingMetrics(
  financialData: FinancialDataV2Doc,
  residence: ResidenceFinancialHints,
  prixSuggere: number,
  calc: FinancialCalc
): AcmVendorBankingMetrics {
  const hints = residenceHintsAtPrice(residence, prixSuggere);
  const dataForGrid = coalesceFinancialDataForGrids(financialData);
  const fin = computeFinancabilite(dataForGrid, hints, {
    useAuditNoi: false,
    formatCurrency: (n) => String(n ?? 0),
  });

  const capaciteEmprunt =
    safeNum(fin.empruntMaxTransaction) ??
    resolveEmpruntMaximumAutorise(calc) ??
    0;

  const miseDeFondsMinimale =
    safeNum(fin.miseDeFondsRequise) ??
    resolveMiseDeFondsRequiseAcheteur(calc, prixSuggere) ??
    (prixSuggere > 0 && capaciteEmprunt > 0 ? Math.max(0, prixSuggere - capaciteEmprunt) : 0);

  const rcd =
    safeNum(calc.ratioCouvertureDette) ||
    safeNum((calc as Record<string, unknown>).dscr as number) ||
    safeNum((calc as Record<string, unknown>).rcd as number) ||
    safeNum(fin.ratioCouverture);

  const cashFlow = safeNum(calc.cashFlow) || safeNum(calc.surplusTresorerie);
  let rendementMiseFonds = miseDeFondsMinimale > 0 && cashFlow !== 0 ? cashFlow / miseDeFondsMinimale : 0;
  if (rendementMiseFonds === 0) {
    const fromCalc = safeNum((calc as Record<string, unknown>).rendementMiseFonds as number);
    if (fromCalc > 0) rendementMiseFonds = fromCalc > 1 ? fromCalc / 100 : fromCalc;
  }

  const grid = buildRevenusDepensesGrid(dataForGrid, hints);
  const rbe =
    safeNum(grid.rbe) || safeNum(calc.revenuBrutEffectif) || safeNum(calc.revenusAnnuels);
  const depensesTotales =
    safeNum(grid.depensesDeclareesTotal) ?? safeNum(calc.depensesTotales);

  const ratioDepenses =
    rbe > 0 && depensesTotales > 0 ? depensesTotales / rbe : safeNum(calc.facteurDepenses);

  return {
    capaciteEmprunt,
    miseDeFondsMinimale,
    rcd,
    rendementMiseFonds,
    ratioDepenses,
    depensesTotales,
  };
}

export function buildAcmVendorCraftMyPdfPayload(
  input: BuildAcmVendorCraftMyPdfPayloadInput
): AcmVendorCraftMyPdfPayload {
  const { bootstrap, valuation, broker, locale, financialData, residence } = input;
  const calc = financialData.calculatedResults;
  if (!calc || typeof calc !== 'object') {
    throw new Error('ACM_VENDOR_REPORT_NO_CALCULATED_RESULTS');
  }

  const prixSuggere =
    input.recommendedPrice != null && Number.isFinite(input.recommendedPrice)
      ? input.recommendedPrice
      : valuation.suggestedPrice;

  const hints = buildResidenceHintsForPdf(residence);
  const dataForGrid = coalesceFinancialDataForGrids(financialData);
  const banking = resolveAcmVendorBankingMetrics(
    financialData,
    residence,
    prixSuggere,
    calc as FinancialCalc
  );

  const grilleRevenus = buildGrilleRevenus(dataForGrid, hints, locale, {
    rbe: bootstrap.revenuBrutEffectif,
  });
  const grilleDepenses = buildGrilleDepenses(dataForGrid, hints, locale, {
    depensesTotales: banking.depensesTotales,
  });
  const liste_revenus = mapGrilleRowsToListe(grilleRevenus);
  const liste_depenses = mapGrilleRowsToListe(grilleDepenses);

  const opexAmount = resolveOpexAmount(bootstrap, valuation, banking.depensesTotales);
  const capPct =
    Number.isFinite(input.effectiveCapRate) && input.effectiveCapRate > 0
      ? input.effectiveCapRate > 1
        ? input.effectiveCapRate / 100
        : input.effectiveCapRate
      : valuation.actualCapRateAtAsking;

  const nomResidence = textOrDash(bootstrap.residenceLabel);
  const adresseResidence = textOrDash(input.residenceAddress);
  const nomCourtier = textOrDash(broker.brokerName);
  const titreCourtier = resolveBrokerTitle(broker, locale);
  const agenceCourtier = textOrDash(broker.agencyName);

  const revenusBrut = bootstrap.revenuBrutEffectif;
  const revenusNet = bootstrap.revenuNetExploitation;
  const tgaFormatted = fmtBuyerPercent(capPct);

  const prixDemandeAffiche = getListingPrice(residence) || bootstrap.askingPrice;
  const listingSource = resolveListingSource(
    (residence as { listingSource?: string }).listingSource
  );
  const confidentialBanner = isOffMarketListing(listingSource)
    ? resolveOffMarketConfidentialBanner(locale)
    : '';

  const payload: AcmVendorCraftMyPdfPayload = {
    Nom_Residence: nomResidence,
    Adresse_Residence: adresseResidence,
    Nom_Courtier: nomCourtier,
    Titre_Courtier: titreCourtier,
    Agence_Courtier: agenceCourtier,
    liste_revenus,
    liste_depenses,
    revenus_brut: fmtBuyerCad(revenusBrut),
    depenses_exploitation: fmtBuyerCad(opexAmount),
    revenus_net_baiia: fmtBuyerCad(revenusNet),
    capacite_emprunt_estimee: fmtBuyerCad(banking.capaciteEmprunt),
    mise_de_fonds_minimale_es: fmtBuyerCad(banking.miseDeFondsMinimale),
    tga: tgaFormatted,
    ratio_depenses_exploitation: fmtBuyerPercent(banking.ratioDepenses),
    rcd: fmtBuyerDscr(banking.rcd),
    rendement_mise_fonds: fmtBuyerPercent(banking.rendementMiseFonds),
    nom_residence: nomResidence,
    adresse_residence: adresseResidence,
    nom_courtier: nomCourtier,
    titre_courtier: titreCourtier,
    agence_courtier: agenceCourtier,
    region: textOrDash(bootstrap.regionLabel ?? undefined),
    nombre_unites: bootstrap.units > 0 ? String(bootstrap.units) : '—',
    rbe: fmtBuyerCad(revenusBrut),
    opex: fmtBuyerCad(opexAmount),
    rne: fmtBuyerCad(revenusNet),
    prix_demande: fmtBuyerCad(prixDemandeAffiche),
    prix_suggere: fmtBuyerCad(prixSuggere),
    prix_plancher: fmtBuyerCad(valuation.suggestedLow),
    prix_plafond: fmtBuyerCad(valuation.suggestedHigh),
    valeur_banquable: fmtBuyerCad(valuation.bankableValue),
    dscr: fmtBuyerDscr(banking.rcd),
    prix_recommande: fmtBuyerCad(prixSuggere),
    lecture_vendeur: textOrDash(input.sellerNarrative ?? undefined),
    document_confidentiel: confidentialBanner,
  };

  console.log('PAYLOAD ENVOYÉ À CRAFTMYPDF (ACM vendeur) :', payload);
  console.log('Vérif. couverture CraftMyPDF :', {
    Nom_Residence: payload.Nom_Residence,
    Adresse_Residence: payload.Adresse_Residence,
    Nom_Courtier: payload.Nom_Courtier,
  });
  console.log('Vérif. tableaux page 5 :', {
    liste_revenus_count: payload.liste_revenus.length,
    liste_depenses_count: payload.liste_depenses.length,
    liste_depenses_sample: payload.liste_depenses.slice(0, 3),
  });
  console.log('Vérif. page 6 CraftMyPDF :', {
    prix_demande: payload.prix_demande,
    capacite_emprunt_estimee: payload.capacite_emprunt_estimee,
    mise_de_fonds_minimale_es: payload.mise_de_fonds_minimale_es,
    rcd: payload.rcd,
    rendement_mise_fonds: payload.rendement_mise_fonds,
  });

  return payload;
}

function buildFilename(slug: string, stamp: string): string {
  return `primexpert-rapport-acm-vendeur-${slug}-${stamp}.pdf`;
}

export async function downloadAcmVendorReportPdf(
  input: DownloadAcmVendorReportPdfInput
): Promise<void> {
  const payload = buildAcmVendorCraftMyPdfPayload(input);
  const templateId = readAcmVendorTemplateId();
  const blob = await requestCraftMyPdfBlob(templateId, payload as unknown as Record<string, unknown>);

  const slug = (input.residenceId ?? 'acm').replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  triggerBrowserDownload(blob, buildFilename(slug, stamp));
}
