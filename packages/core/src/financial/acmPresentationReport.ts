/**
 * Présentation de mise en marché ACM — extraction SSOT (finances + valorisation).
 */

import { formatPublicListingHeadline } from '../diffusion/formatPublicListingHeadline';
import { getPublicUnitsRangeLabel } from '../diffusion/priceRanges';
import { extractBuyerPreviewKpis } from '../diffusion/buyerPreviewKpis';
import { formatCurrency, formatPercentRaw } from '../utils/formatting';
import {
  calculateValuation,
  createDefaultValuationInputs,
  mapFirestoreDataToValuationInputs,
  mapComparablesToCapRateSamples,
  selectMarketCapRate,
  type ValuationOutputs,
} from '../valuation';
import { formatCertifiableReportTimestamp } from './certifiableFinancialReport';
import type { CertifiableReportBrokerFooter } from './certifiableFinancialReport';
import {
  isOffMarketListing,
  resolveListingSource,
  resolveOffMarketConfidentialBanner,
} from '../residence/listingSource';
import type { FinancialCalc, FinancialDataV2Doc, ResidenceFinancialHints } from './normalizeFinancialData';
import {
  computeCapitalizationRateDecimal,
  normalizeCapRateToDecimal,
  normalizeCapRateToPct,
} from './capitalization';

export interface AcmPresentationBrokerBlock extends CertifiableReportBrokerFooter {
  phone?: string;
  titleLine: string;
}

export interface AcmFinancingTile {
  labelFr: string;
  labelEn: string;
  value: string;
}

export interface AcmPresentationReportModel {
  locale: 'fr' | 'en';
  generatedAtDisplay: string;
  coverTitle: string;
  sectorRegion: string;
  broker: AcmPresentationBrokerBlock;
  marketConclusionFr: string;
  marketConclusionEn: string;
  marketCapRateDisplay: string;
  marketValueDisplay: string;
  financingTiles: AcmFinancingTile[];
  launchActionsFr: readonly string[];
  launchActionsEn: readonly string[];
  deontologicalClauseFr: readonly string[];
  deontologicalClauseEn: readonly string[];
  /** Filigrane hors marché (Off-Market). */
  confidentialBanner?: string | null;
}

export const ACM_LAUNCH_ACTIONS_FR = [
  'Inscription simultanée Centris, RE/MAX Commercial, Realtor MLS et RPAaVendre.com',
  'Publipostage commercial ciblé (courtiers institutionnels et investisseurs qualifiés)',
  'Production de médias professionnels (HDR / drone) dès la levée de confidentialité',
] as const;

export const ACM_LAUNCH_ACTIONS_EN = [
  'Simultaneous listing on Centris, RE/MAX Commercial, Realtor MLS and RPAaVendre.com',
  'Targeted commercial mail campaign (institutional brokers and qualified investors)',
  'Professional media production (HDR / drone) upon confidentiality release',
] as const;

export const ACM_DEONTOLOGICAL_CLAUSE_FR = [
  'Le vendeur confie au courtier immobilier agréé un mandat exclusif de vente pour une durée de douze (12) mois, renouvelable par écrit.',
  'Le courtier s’engage à traiter toutes les offres reçues de façon équitable et à les présenter au vendeur dans les meilleurs délais.',
  'Les informations financières de cette présentation proviennent de l’objet calculé immuable (financial/dataV2.calculatedResults) et de l’analyse comparative de marché (ACM) du moteur PrimeXpert.',
  'Aucune photographie de la propriété n’est incluse dans ce document afin de préserver la confidentialité pré-mandat.',
] as const;

export const ACM_DEONTOLOGICAL_CLAUSE_EN = [
  'The seller grants the licensed broker an exclusive sale mandate for twelve (12) months, renewable in writing.',
  'The broker undertakes to treat all offers received fairly and present them to the seller without undue delay.',
  'Financial information in this presentation comes from the immutable calculated object (financial/dataV2.calculatedResults) and PrimeXpert comparative market analysis (CMA).',
  'No property photograph is included in this document to preserve pre-mandate confidentiality.',
] as const;

function finiteNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function fmtMoney(n: number | null | undefined, locale: 'fr' | 'en'): string {
  return formatCurrency(n, { locale: locale === 'fr' ? 'fr-CA' : 'en-CA', fallback: '—' });
}

function resolveSectorRegion(
  residence: ResidenceFinancialHints & { city?: string; region?: string }
): string {
  const region =
    typeof residence.region === 'string' && residence.region.trim()
      ? residence.region.trim()
      : typeof residence.city === 'string' && residence.city.trim()
        ? residence.city.trim()
        : 'Québec';
  return region;
}

function parseExtractedComparables(
  residenceDoc: Record<string, unknown> | null | undefined
): ReturnType<typeof mapComparablesToCapRateSamples> {
  if (!residenceDoc) return [];
  const extracted = residenceDoc.extractedData;
  if (!extracted || typeof extracted !== 'object' || Array.isArray(extracted)) return [];
  const raw = (extracted as Record<string, unknown>).comparables;
  if (!Array.isArray(raw)) return [];
  const mapped = raw
    .map((c, i) => {
      if (!c || typeof c !== 'object') return null;
      const o = c as Record<string, unknown>;
      const salePrice = finiteNum(o.salePrice) ?? 0;
      const capPct = finiteNum(o.capRatePct);
      const noi = finiteNum(o.noi) ?? finiteNum(o.netIncomePerUnit);
      const capRateFromNoi =
        noi != null && salePrice > 0 ? computeCapitalizationRateDecimal(noi, salePrice) : null;
      const capRate =
        normalizeCapRateToDecimal(capPct, capRateFromNoi) ?? 0;
      return {
        id: `ext-${i}`,
        salePrice,
        noi: noi ?? 0,
        capRate,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null && x.salePrice > 0);
  return mapComparablesToCapRateSamples(mapped);
}

function buildValuationOutputs(
  residenceDoc: Record<string, unknown> | null | undefined,
  financialData: FinancialDataV2Doc | null | undefined,
  calc: FinancialCalc
): ValuationOutputs | null {
  try {
    const mapped = mapFirestoreDataToValuationInputs(
      residenceDoc ?? {},
      (financialData ?? {}) as Record<string, unknown>
    );
    const inputs = createDefaultValuationInputs({
      ...mapped,
      askingPrice:
        finiteNum(calc.prixDemande) ??
        finiteNum(mapped.askingPrice) ??
        mapped.askingPrice,
      targetCapRate:
        normalizeCapRateToDecimal(finiteNum(calc.tauxCapitalisation), mapped.targetCapRate) ??
        mapped.targetCapRate,
    });
    return calculateValuation(inputs);
  } catch {
    return null;
  }
}

function buildMarketConclusion(
  calc: FinancialCalc,
  locale: 'fr' | 'en',
  sectorRegion: string,
  residenceDoc: Record<string, unknown> | null | undefined,
  financialData: FinancialDataV2Doc | null | undefined
): {
  conclusionFr: string;
  conclusionEn: string;
  capRateDisplay: string;
  valueDisplay: string;
} {
  const rne = finiteNum(calc.revenuNetExploitation);
  const valeur =
    finiteNum(calc.valeurCapitalisation) ??
    finiteNum(calc.valeurBanquable) ??
    finiteNum(calc.prixDemande);
  const valuation = buildValuationOutputs(residenceDoc, financialData, calc);
  const comparables = parseExtractedComparables(residenceDoc);
  const capSelection = selectMarketCapRate({
    profileCapRate:
      normalizeCapRateToDecimal(
        finiteNum(calc.tauxCapitalisation),
        valuation?.capRateMarketSelected ?? 0.08
      ) ?? 0.08,
    comparables,
    minComparables: 3,
  });

  const tgaPct =
    (capSelection.capRateComparableMedian != null
      ? normalizeCapRateToPct(capSelection.capRateComparableMedian, 0)
      : normalizeCapRateToPct(capSelection.capRateMarketSelected, 0)) ?? 0;
  const capRateDisplay = formatPercentRaw(tgaPct, 2);
  const valueDisplay = fmtMoney(
    valeur ?? valuation?.weightedMarketValue ?? valuation?.suggestedPrice ?? null,
    locale
  );

  const sampleNote =
    capSelection.source === 'COMPARABLES'
      ? locale === 'fr'
        ? `${capSelection.sampleCount} comparables sectoriels`
        : `${capSelection.sampleCount} sector comparables`
      : locale === 'fr'
        ? 'repères de marché (profil sectoriel)'
        : 'market benchmarks (sector profile)';

  const conclusionFr = [
    `La valeur marchande retenue de ${valueDisplay} s’appuie sur un taux de capitalisation (TGA) médian de ${capRateDisplay} issu des ${sampleNote} — secteur ${sectorRegion}.`,
    rne != null
      ? `Ce positionnement est ancré au revenu net d’exploitation (RNE) validé de ${fmtMoney(rne, 'fr')}.`
      : 'Le revenu net d’exploitation (RNE) validé alimente la grille de finançabilité ci-dessous.',
  ].join(' ');

  const conclusionEn = [
    `The retained market value of ${valueDisplay} is supported by a median capitalization rate (cap rate) of ${capRateDisplay} from ${sampleNote} — ${sectorRegion} sector.`,
    rne != null
      ? `This positioning is anchored to validated net operating income (NOI) of ${fmtMoney(rne, 'en')}.`
      : 'Validated net operating income (NOI) feeds the financing grid below.',
  ].join(' ');

  return {
    conclusionFr,
    conclusionEn,
    capRateDisplay,
    valueDisplay,
  };
}

function buildFinancingTiles(
  calc: FinancialCalc,
  locale: 'fr' | 'en'
): AcmFinancingTile[] {
  const kpis = extractBuyerPreviewKpis(calc);
  const surplus =
    finiteNum(calc.surplusTresorerie) ?? finiteNum(calc.cashFlow) ?? kpis.cashFlow;
  return [
    {
      labelFr: 'Revenu net d’exploitation (RNE) validé',
      labelEn: 'Validated net operating income (NOI)',
      value: fmtMoney(kpis.revenuNetExploitation, locale),
    },
    {
      labelFr: 'Emprunt maximum autorisé (le plus bas des critères)',
      labelEn: 'Maximum authorized loan (lowest of criteria)',
      value: fmtMoney(kpis.empruntMaximum, locale),
    },
    {
      labelFr: 'Mise de fonds requise (MFR)',
      labelEn: 'Required down payment (RFR)',
      value: fmtMoney(kpis.miseDeFonds, locale),
    },
    {
      labelFr: 'Surplus de trésorerie (cash flow)',
      labelEn: 'Cash surplus (cash flow)',
      value: fmtMoney(surplus, locale),
    },
  ];
}

export interface BuildAcmPresentationReportInput {
  financialData: FinancialDataV2Doc | null | undefined;
  residence: ResidenceFinancialHints & {
    id?: string;
    city?: string;
    region?: string;
    nombreUnites?: number | null;
    nombreUnitesTotal?: number | null;
    listingSource?: string;
  };
  residenceDoc?: Record<string, unknown> | null;
  broker: AcmPresentationBrokerBlock;
  locale?: 'fr' | 'en';
  generatedAt?: Date;
}

export function buildAcmPresentationReportModel(
  input: BuildAcmPresentationReportInput
): AcmPresentationReportModel {
  const calc = input.financialData?.calculatedResults;
  if (!calc || typeof calc !== 'object') {
    throw new Error('ACM_PRESENTATION_NO_CALCULATED_RESULTS');
  }

  const locale = input.locale ?? 'fr';
  const generatedAt = input.generatedAt ?? new Date();
  const units =
    finiteNum(input.residence.nombreUnitesTotal) ??
    finiteNum(input.residence.nombreUnites) ??
    finiteNum(calc.nombreUnites);
  const fourchette = getPublicUnitsRangeLabel(units);
  const sectorRegion = resolveSectorRegion(input.residence);
  const headline = formatPublicListingHeadline(fourchette, locale);

  const coverTitle =
    locale === 'fr'
      ? `Positionnement Stratégique & Analyse Comparative de Marché — ${headline}, Secteur ${sectorRegion}`
      : `Strategic Positioning & Comparative Market Analysis — ${headline}, ${sectorRegion} sector`;

  const market = buildMarketConclusion(
    calc,
    locale,
    sectorRegion,
    input.residenceDoc,
    input.financialData
  );

  const listingSource = resolveListingSource(
    input.residence.listingSource ?? input.residenceDoc?.listingSource
  );

  return {
    locale,
    generatedAtDisplay: formatCertifiableReportTimestamp(generatedAt),
    coverTitle,
    sectorRegion,
    broker: input.broker,
    marketConclusionFr: market.conclusionFr,
    marketConclusionEn: market.conclusionEn,
    marketCapRateDisplay: market.capRateDisplay,
    marketValueDisplay: market.valueDisplay,
    financingTiles: buildFinancingTiles(calc, locale),
    launchActionsFr: ACM_LAUNCH_ACTIONS_FR,
    launchActionsEn: ACM_LAUNCH_ACTIONS_EN,
    deontologicalClauseFr: ACM_DEONTOLOGICAL_CLAUSE_FR,
    deontologicalClauseEn: ACM_DEONTOLOGICAL_CLAUSE_EN,
    confidentialBanner: isOffMarketListing(listingSource)
      ? resolveOffMarketConfidentialBanner(locale)
      : null,
  };
}
