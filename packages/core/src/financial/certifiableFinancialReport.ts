/**
 * Rapport financier certifiable — extraction SSOT (calculatedResults immuable V2).
 * Zéro recalcul métier : lecture + formatage uniquement.
 */

import { extractBuyerPreviewKpis } from '../diffusion/buyerPreviewKpis';
import { formatCurrency, formatPercentRaw } from '../utils/formatting';
import { buildRevenusDepensesGrid } from './revenusDepensesGrid';
import type { FinancialCalc, FinancialDataV2Doc, ResidenceFinancialHints } from './normalizeFinancialData';
import {
  isOffMarketListing,
  resolveListingSource,
  resolveOffMarketConfidentialBanner,
} from '../residence/listingSource';

export interface CertifiableReportBrokerFooter {
  brokerName: string;
  licenseNumber: string;
  agencyName: string;
  /** Titre professionnel (page couverture, rapports CraftMyPDF). */
  brokerTitle?: string;
}

export interface CertifiableReportSummaryLine {
  labelFr: string;
  labelEn: string;
  valueFr: string;
  valueEn: string;
}

export interface CertifiableReportExpenseRow {
  label: string;
  declared: string;
  normalized: string;
  pctOfRbe: string;
}

export interface CertifiableFinancialReportModel {
  locale: 'fr' | 'en';
  generatedAtIso: string;
  generatedAtDisplay: string;
  residenceId: string;
  propertyTitle: string;
  propertyAddress: string;
  dataSource: 'calculatedResults';
  kpis: ReturnType<typeof extractBuyerPreviewKpis>;
  summaryLines: CertifiableReportSummaryLine[];
  expenseRows: CertifiableReportExpenseRow[];
  totals: {
    rbe: string;
    depensesNormalisees: string;
    rne: string;
  };
  legalDisclaimersFr: readonly string[];
  legalDisclaimersEn: readonly string[];
  broker: CertifiableReportBrokerFooter;
  /** Filigrane hors marché (Off-Market) — secret commercial. */
  confidentialBanner?: string | null;
}

export const CERTIFIABLE_REPORT_LEGAL_FR = [
  'Les informations financières contenues dans ce rapport ont été compilées avec diligence raisonnable à partir des données déclarées et vérifiées disponibles au moment de la génération. Ce document ne constitue pas un avis juridique, comptable ou d’évaluation certifiée par un expert indépendant.',
  'Les ratios et indicateurs proviennent exclusivement de l’objet calculé immuable (financial/dataV2.calculatedResults) en vigueur à la date de génération. Toute modification ultérieure des données sources invalide la présente version du rapport.',
  'Cette résidence est vendue sans garantie légale de qualité aux risques et périls de l’acheteur, sauf stipulation contraire au contrat de vente.',
  'PrimeXpert agit comme outil de production documentaire pour le courtier responsable. La responsabilité professionnelle demeure celle du titulaire de permis identifié au pied de page.',
] as const;

export const CERTIFIABLE_REPORT_LEGAL_EN = [
  'The financial information in this report was compiled with reasonable diligence from declared and verified data available at generation time. This document is not legal, accounting, or certified appraisal advice from an independent expert.',
  'Ratios and indicators are taken solely from the immutable calculated object (financial/dataV2.calculatedResults) in effect on the generation date. Any later change to source data voids this report version.',
  'This property is sold without legal warranty of quality at the buyer’s own risk, unless otherwise stated in the sale contract.',
  'PrimeXpert is a document production tool for the responsible broker. Professional liability remains with the license holder identified in the footer.',
] as const;

function finiteNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Horodatage certifiable YYYY-MM-DD HH:MM:SS (heure locale). */
export function formatCertifiableReportTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function fmtMoney(n: number | null | undefined, locale: 'fr' | 'en'): string {
  return formatCurrency(n, { locale: locale === 'fr' ? 'fr-CA' : 'en-CA', fallback: '—' });
}

function fmtPctCap(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return formatPercentRaw(n, 2);
}

function fmtMultiplier(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(2).replace('.', ',')}×`;
}

function buildSummaryFromCalc(calc: FinancialCalc, locale: 'fr' | 'en'): CertifiableReportSummaryLine[] {
  const L = locale === 'fr';
  const lines: CertifiableReportSummaryLine[] = [
    {
      labelFr: 'Prix demandé',
      labelEn: 'Asking price',
      valueFr: fmtMoney(finiteNum(calc.prixDemande), 'fr'),
      valueEn: fmtMoney(finiteNum(calc.prixDemande), 'en'),
    },
    {
      labelFr: 'Revenu brut effectif (RBE)',
      labelEn: 'Effective gross income (EGI)',
      valueFr: fmtMoney(finiteNum(calc.revenuBrutEffectif) ?? finiteNum(calc.revenusAnnuels), 'fr'),
      valueEn: fmtMoney(finiteNum(calc.revenuBrutEffectif) ?? finiteNum(calc.revenusAnnuels), 'en'),
    },
    {
      labelFr: 'Multiple du revenu net (MRN)',
      labelEn: 'Net revenue multiple (MRN)',
      valueFr: fmtMultiplier(finiteNum(calc.facteurRevenuNet)),
      valueEn: fmtMultiplier(finiteNum(calc.facteurRevenuNet)),
    },
    {
      labelFr: 'Taux de capitalisation (TGA)',
      labelEn: 'Capitalization rate (cap rate)',
      valueFr: fmtPctCap(finiteNum(calc.tauxCapitalisation)),
      valueEn: fmtPctCap(finiteNum(calc.tauxCapitalisation)),
    },
    {
      labelFr: 'Ratio de couverture de la dette (DSCR)',
      labelEn: 'Debt service coverage ratio (DSCR)',
      valueFr:
        finiteNum(calc.ratioCouvertureDette) != null
          ? `${finiteNum(calc.ratioCouvertureDette)!.toFixed(2).replace('.', ',')}×`
          : '—',
      valueEn:
        finiteNum(calc.ratioCouvertureDette) != null
          ? `${finiteNum(calc.ratioCouvertureDette)!.toFixed(2)}×`
          : '—',
    },
    {
      labelFr: 'Valeur par capitalisation',
      labelEn: 'Capitalization value',
      valueFr: fmtMoney(finiteNum(calc.valeurCapitalisation), 'fr'),
      valueEn: fmtMoney(finiteNum(calc.valeurCapitalisation), 'en'),
    },
  ];
  return lines;
}

export interface BuildCertifiableFinancialReportInput {
  financialData: FinancialDataV2Doc | null | undefined;
  residence: ResidenceFinancialHints & {
    id?: string;
    address?: string;
    city?: string;
    residenceName?: string;
    nomCommercial?: string;
    name?: string;
    listingSource?: string;
  };
  broker: CertifiableReportBrokerFooter;
  locale?: 'fr' | 'en';
  generatedAt?: Date;
}

/**
 * Construit le modèle d’impression — exige `calculatedResults` (immuable V2).
 */
export function buildCertifiableFinancialReportModel(
  input: BuildCertifiableFinancialReportInput
): CertifiableFinancialReportModel {
  const calc = input.financialData?.calculatedResults;
  if (!calc || typeof calc !== 'object') {
    throw new Error('CERTIFIABLE_REPORT_NO_CALCULATED_RESULTS');
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
  const kpis = extractBuyerPreviewKpis(calc);

  const title =
    input.residence.residenceName?.trim() ||
    input.residence.nomCommercial?.trim() ||
    input.residence.name?.trim() ||
    input.residence.address?.trim() ||
    '—';
  const address = [input.residence.address, input.residence.city].filter(Boolean).join(', ') || '—';

  const expenseRows: CertifiableReportExpenseRow[] = grid.rows.map((row) => ({
    label: row.label,
    declared: fmtMoney(row.declared, locale),
    normalized: fmtMoney(row.normalized, locale),
    pctOfRbe: row.pctOfRbe != null ? formatPercentRaw(row.pctOfRbe, 1) : '—',
  }));

  const listingSource = resolveListingSource(input.residence.listingSource);

  return {
    locale,
    generatedAtIso: generatedAt.toISOString(),
    generatedAtDisplay: formatCertifiableReportTimestamp(generatedAt),
    residenceId: String(input.residence.id ?? ''),
    propertyTitle: title,
    propertyAddress: address,
    dataSource: 'calculatedResults',
    kpis,
    summaryLines: buildSummaryFromCalc(calc, locale),
    expenseRows,
    totals: {
      rbe: fmtMoney(grid.rbe, locale),
      depensesNormalisees: fmtMoney(grid.depensesNormaliseesTotal, locale),
      rne: fmtMoney(finiteNum(calc.revenuNetExploitation) ?? grid.noiDeclare, locale),
    },
    legalDisclaimersFr: CERTIFIABLE_REPORT_LEGAL_FR,
    legalDisclaimersEn: CERTIFIABLE_REPORT_LEGAL_EN,
    broker: input.broker,
    confidentialBanner: isOffMarketListing(listingSource)
      ? resolveOffMarketConfidentialBanner(locale)
      : null,
  };
}
