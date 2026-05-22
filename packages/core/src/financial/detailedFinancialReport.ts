/**
 * Rapport financier détaillé — reddition exhaustive (acheteurs qualifiés / institutions).
 * SSOT : buildRevenusDepensesGrid, computeFinancabilite, computePerformanceRatiosViewModel.
 */

import { formatCurrency, formatPercentRaw } from '../utils/formatting';
import { computeFinancabilite } from './computeFinancabilite';
import {
  computePerformanceRatiosViewModel,
  type RatioDisplayKind,
} from './performanceRatios';
import { buildRevenusDepensesGrid } from './revenusDepensesGrid';
import {
  formatCertifiableReportTimestamp,
  type CertifiableReportBrokerFooter,
} from './certifiableFinancialReport';
import type { FinancialCalc, FinancialDataV2Doc, ResidenceFinancialHints } from './normalizeFinancialData';

export const DETAILED_REPORT_LEGAL_FOOTER_FR =
  'Les informations financières présentées proviennent des documents fournis par le vendeur. L’immeuble est vendu sans garantie légale de qualité aux risques et périls de l’acheteur.' as const;

export const DETAILED_REPORT_LEGAL_FOOTER_EN =
  'The financial information presented comes from documents provided by the seller. The property is sold without legal warranty of quality at the buyer’s own risk.' as const;

export const DETAILED_REPORT_COMPLIANCE_LINE_FR =
  'Conformité OACIQ · Loi 25 (renseignements personnels) · Horodatage WORM · Source : financial/dataV2.calculatedResults' as const;

export const DETAILED_REPORT_COMPLIANCE_LINE_EN =
  'OACIQ compliance · Law 25 (personal information) · WORM timestamp · Source: financial/dataV2.calculatedResults' as const;

/** Texte page 2 — aligné maquette Canva « Blue White Modern Business Annual Report ». */
export const DETAILED_REPORT_CANVA_ABOUT_FR = [
  'Ce document vous offre une lecture claire et accessible de la situation financière de votre résidence.',
  'Il ne s’agit pas d’une évaluation immobilière officielle, mais d’un outil de compréhension et de réflexion pour éclairer vos décisions (non-évaluation agréée).',
  'Les informations présentées sont basées sur les données que vous nous avez communiquées et sur notre connaissance du marché des résidences pour aînés (RPA) au Québec.',
] as const;

export const DETAILED_REPORT_CANVA_ABOUT_EN = [
  'This document offers a clear, accessible view of your residence’s financial situation.',
  'It is not an official real estate appraisal, but a decision-support tool (not a certified appraisal).',
  'Figures are based on information you provided and our knowledge of the Québec seniors’ residence (RPA) market.',
] as const;

export const DETAILED_REPORT_AVIS_IMPORTANT_FR = [
  'Le présent document constitue une analyse de marché indicative. Il ne doit pas être interprété comme une évaluation agréée, un avis juridique, fiscal ou comptable.',
  'L’analyse repose sur les informations fournies par le propriétaire et sur les conditions de marché en vigueur au moment de l’exportation, lesquelles peuvent évoluer.',
  'Avant toute décision, il est recommandé de consulter des professionnels qualifiés (évaluateur agréé, comptable professionnel agréé (CPA), avocat).',
  'Le courtier immobilier agréé décline toute responsabilité pour les pertes découlant d’une utilisation inappropriée de ce document.',
  'Ce rapport est strictement confidentiel et destiné aux parties autorisées dans le cadre du mandat.',
] as const;

export const DETAILED_REPORT_AVIS_IMPORTANT_EN = [
  'This document is an indicative market analysis. It must not be construed as a certified appraisal or legal, tax or accounting advice.',
  'The analysis relies on seller-provided information and market conditions at export time, which may change.',
  'Consult qualified professionals before making decisions.',
  'The licensed broker disclaims liability for losses from inappropriate use of this document.',
  'This report is strictly confidential and intended for authorized parties under the mandate.',
] as const;

export const DETAILED_REPORT_ABOUT_INTRO_FR = [
  'Ce rapport d’analyse financière détaillée constitue une reddition exhaustive destinée aux acheteurs qualifiés et aux institutions. Il structure la diligence raisonnable pré-transaction sans constituer une évaluation agréée.',
  'Les montants proviennent exclusivement de l’objet calculé immuable financial/dataV2.calculatedResults et de la ventilation revenus/dépenses du moteur PrimeXpert (déclaré vs normalisé). Aucune formule n’est recalculée dans ce rendu PDF.',
  'Aucune photographie de l’immeuble n’est incluse afin de préserver la confidentialité et la conformité publicitaire.',
] as const;

export const DETAILED_REPORT_ABOUT_INTRO_EN = [
  'This detailed financial analysis report is an exhaustive disclosure for qualified buyers and institutions. It structures pre-transaction due diligence and is not a certified appraisal.',
  'Amounts come exclusively from the immutable object financial/dataV2.calculatedResults and PrimeXpert revenue/expense breakdown (declared vs normalized). No formulas are recalculated in this PDF render.',
  'No property photograph is included to preserve confidentiality and advertising compliance.',
] as const;

export const DETAILED_REPORT_DEONTOLOGICAL_CLAUSE_FR = [
  'Le courtier immobilier agréé agit à titre de conseiller transactionnel et non d’évaluateur agréé (non-évaluation agréée). Les conclusions de marché et de finançabilité sont des repères, non des certificats d’évaluation.',
  'Les informations financières proviennent des documents fournis par le vendeur et de la normalisation professionnelle du courtier. L’acheteur demeure responsable de sa propre vérification institutionnelle.',
  'Les données personnelles et commerciales sont traitées conformément à la Loi 25 et aux règles OACIQ applicables à la conservation et à la communication du dossier.',
  'L’horodatage WORM atteste de l’instant d’exportation; toute modification ultérieure des données source exige une réémission du rapport.',
] as const;

export const DETAILED_REPORT_DEONTOLOGICAL_CLAUSE_EN = [
  'The licensed broker acts as a transaction advisor, not a certified appraiser (not a certified appraisal). Market and financing conclusions are benchmarks, not appraisal certificates.',
  'Financial information comes from seller-provided documents and professional broker normalization. The buyer remains responsible for institutional verification.',
  'Personal and commercial data are handled per Law 25 and applicable OACIQ rules for record retention and disclosure.',
  'The WORM timestamp attests to the export instant; any later change to source data requires re-issuing this report.',
] as const;

export interface DetailedReportExpenseRow {
  label: string;
  declared: string;
  normalized: string;
}

export interface DetailedReportLabelValue {
  labelFr: string;
  labelEn: string;
  value: string;
}

export interface DetailedFinancialReportModel {
  locale: 'fr' | 'en';
  generatedAtDisplay: string;
  residenceId: string;
  propertyTitle: string;
  propertyAddress: string;
  addressShown: boolean;
  broker: CertifiableReportBrokerFooter;
  revenueSummary: {
    rbe: string;
    revenusAnnuels: string;
  };
  expenseRows: DetailedReportExpenseRow[];
  totals: {
    depensesDeclarees: string;
    depensesNormalisees: string;
    rne: string;
  };
  financingRows: DetailedReportLabelValue[];
  yieldRows: DetailedReportLabelValue[];
  legalFooterFr: string;
  legalFooterEn: string;
  complianceLineFr: string;
  complianceLineEn: string;
  aboutIntroFr: readonly string[];
  aboutIntroEn: readonly string[];
  canvaAboutFr: readonly string[];
  canvaAboutEn: readonly string[];
  avisImportantFr: readonly string[];
  avisImportantEn: readonly string[];
  deontologicalClauseFr: readonly string[];
  deontologicalClauseEn: readonly string[];
}

function finiteNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function fmtMoney(n: number | null | undefined, locale: 'fr' | 'en'): string {
  return formatCurrency(n, { locale: locale === 'fr' ? 'fr-CA' : 'en-CA', fallback: '—' });
}

function fmtPctDecimal(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  return formatPercentRaw(ratio * 100, 2);
}

function formatRatioRow(
  labelFr: string,
  labelEn: string,
  value: number | null,
  displayKind: RatioDisplayKind,
  locale: 'fr' | 'en'
): DetailedReportLabelValue {
  let formatted = '—';
  if (value != null && Number.isFinite(value)) {
    if (displayKind === 'currency' || displayKind === 'currencyPerUnit') {
      formatted = fmtMoney(value, locale);
    } else if (displayKind === 'percent') {
      formatted = fmtPctDecimal(value);
    } else {
      formatted = `${value.toFixed(2).replace('.', ',')}×`;
    }
  }
  return { labelFr, labelEn, value: formatted };
}

function buildYieldRows(
  calc: FinancialCalc,
  locale: 'fr' | 'en',
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints
): DetailedReportLabelValue[] {
  const perf = computePerformanceRatiosViewModel(financialData, residence);
  const cashFlow = finiteNum(calc.cashFlow) ?? finiteNum(calc.surplusTresorerie);
  const miseDeFonds = finiteNum(calc.miseDeFondsRequise);
  const rendementMdf =
    cashFlow != null && miseDeFonds != null && miseDeFonds > 0 ? cashFlow / miseDeFonds : null;
  const tga = finiteNum(calc.tauxCapitalisation);
  const tgaDisplay =
    tga != null ? (tga > 1 ? formatPercentRaw(tga, 2) : fmtPctDecimal(tga)) : '—';

  const rows: DetailedReportLabelValue[] = [
    {
      labelFr: 'Cash flow annuel (instantané V2)',
      labelEn: 'Annual cash flow (V2 snapshot)',
      value: fmtMoney(cashFlow, locale),
    },
    {
      labelFr: 'Cash flow cumulatif sur 5 ans (hypothèse stable)',
      labelEn: '5-year cumulative cash flow (stable assumption)',
      value: fmtMoney(cashFlow != null ? cashFlow * 5 : null, locale),
    },
    {
      labelFr: 'Rendement sur la mise de fonds (cash flow ÷ MFR)',
      labelEn: 'Return on equity (cash flow ÷ down payment)',
      value: rendementMdf != null ? fmtPctDecimal(rendementMdf) : '—',
    },
    {
      labelFr: 'Taux de capitalisation (TGA)',
      labelEn: 'Capitalization rate (cap rate)',
      value: tgaDisplay,
    },
  ];

  const trnRow = perf.performanceRows.find((r) => r.id === 'trn');
  if (trnRow) {
    rows.push(
      formatRatioRow(
        trnRow.labelFr,
        trnRow.labelEn,
        trnRow.value,
        trnRow.displayKind,
        locale
      )
    );
  }

  return rows;
}

function buildFinancingRows(
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints,
  locale: 'fr' | 'en'
): DetailedReportLabelValue[] {
  const fin = computeFinancabilite(financialData, residence, {
    useAuditNoi: true,
    formatCurrency: (n) => fmtMoney(n, locale),
  });

  const headerRows: DetailedReportLabelValue[] = [
    {
      labelFr: 'Taux d’intérêt assumé',
      labelEn: 'Assumed interest rate',
      value: `${fin.tauxInteretPct.toFixed(2).replace('.', ',')} %`,
    },
    {
      labelFr: 'Amortissement (années)',
      labelEn: 'Amortization (years)',
      value: String(fin.amortissementAnnees),
    },
    {
      labelFr: 'Ratio de couverture de la dette (DSCR) cible',
      labelEn: 'Target debt service coverage ratio (DSCR)',
      value: `${fin.dscrCible.toFixed(2).replace('.', ',')}×`,
    },
    {
      labelFr: 'Programme de financement',
      labelEn: 'Financing program',
      value: locale === 'fr' ? fin.financingProgramLabelFr : fin.financingProgramLabelEn,
    },
  ];

  const scenarioRows: DetailedReportLabelValue[] = fin.scenarioRows.map((row) => ({
    labelFr: row.labelFr,
    labelEn: row.labelEn,
    value: row.value,
  }));

  return [...headerRows, ...scenarioRows];
}

export interface BuildDetailedFinancialReportInput {
  financialData: FinancialDataV2Doc | null | undefined;
  residence: ResidenceFinancialHints & {
    id?: string;
    address?: string;
    city?: string;
    residenceName?: string;
    nomCommercial?: string;
    name?: string;
    /** Masquer l’adresse civique (fiche confidentielle). */
    addressConfidential?: boolean;
  };
  broker: CertifiableReportBrokerFooter;
  locale?: 'fr' | 'en';
  generatedAt?: Date;
}

export function buildDetailedFinancialReportModel(
  input: BuildDetailedFinancialReportInput
): DetailedFinancialReportModel {
  const calc = input.financialData?.calculatedResults;
  if (!calc || typeof calc !== 'object') {
    throw new Error('DETAILED_REPORT_NO_CALCULATED_RESULTS');
  }

  const locale = input.locale ?? 'fr';
  const generatedAt = input.generatedAt ?? new Date();
  const hints = {
    ...input.residence,
    prixDemande:
      finiteNum(input.residence.prixDemande) ??
      finiteNum(input.residence.askingPrice) ??
      finiteNum(calc.prixDemande),
    askingPrice:
      finiteNum(input.residence.askingPrice) ??
      finiteNum(input.residence.prixDemande) ??
      finiteNum(calc.prixDemande),
  };

  const grid = buildRevenusDepensesGrid(input.financialData, hints);
  const title =
    input.residence.residenceName?.trim() ||
    input.residence.nomCommercial?.trim() ||
    input.residence.name?.trim() ||
    '—';
  const addressShown = !input.residence.addressConfidential;
  const propertyAddress = addressShown
    ? [input.residence.address, input.residence.city].filter(Boolean).join(', ') || '—'
    : locale === 'fr'
      ? 'Adresse confidentielle — divulgation sur mandat'
      : 'Confidential address — disclosed under mandate';

  const expenseRows: DetailedReportExpenseRow[] = grid.rows.map((row) => ({
    label: row.label,
    declared: fmtMoney(row.declared, locale),
    normalized: fmtMoney(row.normalized, locale),
  }));

  const rne =
    finiteNum(calc.revenuNetExploitation) ??
    (grid.rbe != null && grid.depensesNormaliseesTotal != null
      ? grid.rbe - grid.depensesNormaliseesTotal
      : grid.noiDeclare);

  return {
    locale,
    generatedAtDisplay: formatCertifiableReportTimestamp(generatedAt),
    residenceId: String(input.residence.id ?? ''),
    propertyTitle: title,
    propertyAddress,
    addressShown,
    broker: input.broker,
    revenueSummary: {
      rbe: fmtMoney(grid.rbe, locale),
      revenusAnnuels: fmtMoney(grid.revenusAnnuels ?? grid.rbe, locale),
    },
    expenseRows,
    totals: {
      depensesDeclarees: fmtMoney(grid.depensesDeclareesTotal, locale),
      depensesNormalisees: fmtMoney(grid.depensesNormaliseesTotal, locale),
      rne: fmtMoney(rne, locale),
    },
    financingRows: buildFinancingRows(input.financialData, hints, locale),
    yieldRows: buildYieldRows(calc, locale, input.financialData, hints),
    legalFooterFr: DETAILED_REPORT_LEGAL_FOOTER_FR,
    legalFooterEn: DETAILED_REPORT_LEGAL_FOOTER_EN,
    complianceLineFr: DETAILED_REPORT_COMPLIANCE_LINE_FR,
    complianceLineEn: DETAILED_REPORT_COMPLIANCE_LINE_EN,
    aboutIntroFr: DETAILED_REPORT_ABOUT_INTRO_FR,
    aboutIntroEn: DETAILED_REPORT_ABOUT_INTRO_EN,
    canvaAboutFr: DETAILED_REPORT_CANVA_ABOUT_FR,
    canvaAboutEn: DETAILED_REPORT_CANVA_ABOUT_EN,
    avisImportantFr: DETAILED_REPORT_AVIS_IMPORTANT_FR,
    avisImportantEn: DETAILED_REPORT_AVIS_IMPORTANT_EN,
    deontologicalClauseFr: DETAILED_REPORT_DEONTOLOGICAL_CLAUSE_FR,
    deontologicalClauseEn: DETAILED_REPORT_DEONTOLOGICAL_CLAUSE_EN,
  };
}
