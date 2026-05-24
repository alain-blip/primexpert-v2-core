/**
 * Analyse vendeur & stratégie de mise en marché — modèle SSOT (Sprint 0 ACM).
 */

import { formatCurrency, formatPercentRaw } from '../utils/formatting';
import { extractBuyerPreviewKpis } from '../diffusion/buyerPreviewKpis';
import {
  classifyAssetSize,
  calculatePriceRecommendation,
  generateSellerRationale,
  inferMarketType,
} from '../valuation/priceStrategy';
import {
  capRateRangeFromMedian,
  runStressTests,
  selectBaselineStressTest,
} from '../valuation/stressTest';
import { computeTgaAdjustment } from '../valuation/penetrationTgaAdjustment';
import {
  formatCertifiableReportTimestamp,
  type CertifiableReportBrokerFooter,
} from './certifiableFinancialReport';
import type { FinancialCalc, FinancialDataV2Doc, ResidenceFinancialHints } from './normalizeFinancialData';

export interface SellerListingAnalysisModel {
  locale: 'fr' | 'en';
  generatedAtDisplay: string;
  propertyTitle: string;
  propertyAddress: string;
  kpis: ReturnType<typeof extractBuyerPreviewKpis>;
  askingPrice: number | null;
  capRateImpliedPct: number | null;
  tgaAdjustment?: {
    basePct: number;
    adjustedPct: number;
    deltaBps: number;
    rationale: string[];
  };
  stressScenarios: Array<{
    labelFr: string;
    labelEn: string;
    occupancyPct: number;
    noi: string;
    valueMin: string;
    valueMax: string;
  }>;
  priceRecommendation: {
    median: string;
    recommended: string;
    strategyFr: string;
    strategyEn: string;
    rationale: string[];
  } | null;
  narrativeBulletsFr: string[];
  narrativeBulletsEn: string[];
  legalDisclaimersFr: readonly string[];
  legalDisclaimersEn: readonly string[];
  broker: CertifiableReportBrokerFooter;
}

export const SELLER_LISTING_LEGAL_FR = [
  'Ce document constitue une analyse de marché indicative préparée pour le vendeur. Il ne remplace pas une évaluation agréée, un avis juridique, fiscal ou comptable.',
  'Les montants proviennent de financial/dataV2.calculatedResults et des paramètres de marché en vigueur à la date de génération.',
  'Toute modification ultérieure des données sources exige une réémission du rapport.',
] as const;

export const SELLER_LISTING_LEGAL_EN = [
  'This document is an indicative market analysis prepared for the seller. It does not replace a certified appraisal or legal, tax or accounting advice.',
  'Amounts come from financial/dataV2.calculatedResults and market parameters at generation time.',
  'Any later change to source data requires reissuing this report.',
] as const;

export interface BuildSellerListingAnalysisInput {
  locale: 'fr' | 'en';
  financialData: FinancialDataV2Doc;
  residence: Record<string, unknown> & ResidenceFinancialHints;
  broker: CertifiableReportBrokerFooter;
  /** Taux pénétration RPA 0–1 (optionnel). */
  penetrationRate?: number | null;
  generatedAt?: Date;
}

export function buildSellerListingAnalysisModel(
  input: BuildSellerListingAnalysisInput
): SellerListingAnalysisModel {
  const { locale, financialData, residence, broker } = input;
  const calc = financialData.calculatedResults as FinancialCalc | undefined;
  const generatedAt = input.generatedAt ?? new Date();

  const kpis = extractBuyerPreviewKpis(calc);
  const askingPrice =
    typeof residence.prixDemande === 'number'
      ? residence.prixDemande
      : typeof residence.askingPrice === 'number'
        ? residence.askingPrice
        : typeof residence.price === 'number'
          ? residence.price
          : null;

  const noi = kpis.revenuNetExploitation ?? calc?.revenuNetExploitation ?? 0;
  const capRateImpliedPct =
    askingPrice != null && askingPrice > 0 && noi > 0 ? (noi / askingPrice) * 100 : null;

  const units =
    typeof residence.nombreUnitesTotal === 'number'
      ? residence.nombreUnitesTotal
      : typeof residence.nombreUnites === 'number'
        ? residence.nombreUnites
        : 45;

  const occupancy =
    typeof residence.tauxOccupation === 'number'
      ? residence.tauxOccupation > 1
        ? residence.tauxOccupation / 100
        : residence.tauxOccupation
      : 0.95;

  const baseCap = capRateImpliedPct != null ? capRateImpliedPct / 100 : 0.085;
  const marketType = inferMarketType(String(residence.city ?? residence.region ?? ''));
  const marketTier =
    marketType === 'METRO' ? 'primaire' : marketType === 'SECONDARY' ? 'secondaire' : 'tertiaire';

  let tgaAdjustment: SellerListingAnalysisModel['tgaAdjustment'];
  if (input.penetrationRate != null) {
    const adj = computeTgaAdjustment({
      baseTga: baseCap,
      tauxPenetrationRPA: input.penetrationRate,
      nombreUnites: units,
      marketTier,
    });
    tgaAdjustment = {
      basePct: adj.baseTga * 100,
      adjustedPct: adj.finalTga * 100,
      deltaBps: adj.penetrationDeltaBps + adj.sizeDeltaBps + adj.marketDeltaBps,
      rationale: adj.rationale,
    };
  }

  const capRange = capRateRangeFromMedian(
    tgaAdjustment ? tgaAdjustment.adjustedPct / 100 : baseCap
  );
  const stress = runStressTests(noi, occupancy, capRange);
  const baseline = selectBaselineStressTest(occupancy, stress);

  const fmt = (n: number) =>
    formatCurrency(n, { locale: locale === 'fr' ? 'fr-CA' : 'en-CA', fallback: '—' });

  const stressScenarios = [
    { key: 'occ85' as const, fr: 'Scénario conservateur (85 % occupation)', en: 'Conservative (85% occupancy)' },
    { key: 'occ90' as const, fr: 'Scénario de base (90 % occupation)', en: 'Base (90% occupancy)' },
    { key: 'occ100' as const, fr: 'Scénario optimiste (100 % occupation)', en: 'Optimistic (100% occupancy)' },
  ].map(({ key, fr, en }) => {
    const s = stress[key];
    return {
      labelFr: fr,
      labelEn: en,
      occupancyPct: s.occupancyRate * 100,
      noi: fmt(s.noi),
      valueMin: fmt(s.valueRange.min),
      valueMax: fmt(s.valueRange.max),
    };
  });

  const assetSize = classifyAssetSize(units);
  const priceRec =
    noi > 0
      ? calculatePriceRecommendation(baseline, marketType, assetSize, occupancy)
      : null;

  const rationale = priceRec
    ? generateSellerRationale(priceRec, marketType, occupancy, locale)
    : [];

  const propertyTitle =
    String(residence.residenceName ?? residence.nomCommercial ?? residence.name ?? 'Résidence').trim();
  const propertyAddress = [residence.address, residence.city].filter(Boolean).join(', ');

  return {
    locale,
    generatedAtDisplay: formatCertifiableReportTimestamp(generatedAt),
    propertyTitle,
    propertyAddress,
    kpis,
    askingPrice,
    capRateImpliedPct,
    tgaAdjustment,
    stressScenarios,
    priceRecommendation: priceRec
      ? {
          median: fmt(priceRec.valueRange.median),
          recommended: fmt(priceRec.recommendedListPrice),
          strategyFr:
            priceRec.pricingStrategy === 'SELL_FAST' ? 'Vente rapide' : 'Équilibrée',
          strategyEn: priceRec.pricingStrategy === 'SELL_FAST' ? 'Sell fast' : 'Balanced',
          rationale,
        }
      : null,
    narrativeBulletsFr: [
      'Analyse de valeur et stratégie de mise en marché — document vendeur (non-évaluation agréée).',
      capRateImpliedPct != null
        ? `Taux de capitalisation (TGA) implicite au prix demandé : ${formatPercentRaw(capRateImpliedPct, { decimals: 2 })}.`
        : 'Complétez le prix demandé pour le TGA implicite.',
      ...(tgaAdjustment
        ? [`Ajustement risque marché : TGA ${tgaAdjustment.basePct.toFixed(2)} % → ${tgaAdjustment.adjustedPct.toFixed(2)} %.`]
        : []),
      ...rationale.slice(0, 2),
    ],
    narrativeBulletsEn: [
      'Value analysis and go-to-market strategy — seller document (not a certified appraisal).',
      capRateImpliedPct != null
        ? `Implied capitalization rate (cap rate) at asking: ${formatPercentRaw(capRateImpliedPct, { decimals: 2 })}.`
        : 'Complete asking price for implied cap rate.',
      ...rationale.slice(0, 2),
    ],
    legalDisclaimersFr: SELLER_LISTING_LEGAL_FR,
    legalDisclaimersEn: SELLER_LISTING_LEGAL_EN,
    broker,
  };
}
