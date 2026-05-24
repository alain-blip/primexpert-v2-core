/**
 * Stratégie de prix conservatrice — biais liquidité (sell-through).
 */

import type {
  AssetSize,
  MarketType,
  PriceRecommendation,
  PricingStrategy,
  RangeWithMedian,
  StressTestResult,
} from './valuationStressTypes';

const DISCOUNT_MATRIX: Record<MarketType, Record<AssetSize, number>> = {
  METRO: { SMALL: -0.02, MID: -0.01, LARGE: 0 },
  SECONDARY: { SMALL: -0.04, MID: -0.03, LARGE: -0.02 },
  REGIONAL: { SMALL: -0.06, MID: -0.05, LARGE: -0.04 },
  RURAL_MICRO: { SMALL: -0.08, MID: -0.07, LARGE: -0.06 },
};

export function classifyAssetSize(units: number): AssetSize {
  if (units <= 25) return 'SMALL';
  if (units <= 50) return 'MID';
  return 'LARGE';
}

/** Heuristique Québec — région administrative ou ville. */
export function inferMarketType(regionOrCity?: string | null): MarketType {
  const s = String(regionOrCity ?? '').toLowerCase();
  if (/montréal|montreal|laval|québec|quebec|longueuil|06 |03 |12 /.test(s)) return 'METRO';
  if (/sherbrooke|gatineau|trois-rivières|drummondville|05 |07 |16 /.test(s)) return 'SECONDARY';
  if (/rural|abitibi|gaspésie|bas-saint-laurent|09 |11 /.test(s)) return 'RURAL_MICRO';
  return 'REGIONAL';
}

export function calculatePriceRecommendation(
  stressTestBaseline: StressTestResult,
  marketType: MarketType,
  assetSize: AssetSize,
  currentOccupancy: number
): PriceRecommendation {
  const valueRange: RangeWithMedian = {
    min: stressTestBaseline.valueRange.min,
    max: stressTestBaseline.valueRange.max,
    median: Math.round(
      (stressTestBaseline.valueRange.min + stressTestBaseline.valueRange.max) / 2
    ),
  };

  const baseDiscount = DISCOUNT_MATRIX[marketType]?.[assetSize] ?? -0.05;
  let additionalDiscount = 0;
  if (currentOccupancy < 0.85) additionalDiscount = -0.03;
  else if (currentOccupancy < 0.9) additionalDiscount = -0.02;

  const totalDiscount = baseDiscount + additionalDiscount;
  const recommendedListPrice = Math.round(valueRange.median * (1 + totalDiscount));

  return {
    valueRange,
    recommendedListPrice,
    pricingStrategy: determinePricingStrategy(marketType, assetSize, currentOccupancy),
    adjustmentFromMedian: totalDiscount,
  };
}

function determinePricingStrategy(
  marketType: MarketType,
  assetSize: AssetSize,
  currentOccupancy: number
): PricingStrategy {
  if (marketType === 'RURAL_MICRO') return 'SELL_FAST';
  if (marketType === 'REGIONAL' && assetSize === 'SMALL') return 'SELL_FAST';
  if (currentOccupancy < 0.85) return 'SELL_FAST';
  return 'BALANCED';
}

export function generateSellerRationale(
  priceRec: PriceRecommendation,
  marketType: MarketType,
  currentOccupancy: number,
  locale: 'fr' | 'en' = 'fr'
): string[] {
  const fmt = (n: number) =>
    n.toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    });

  const bullets: string[] = [];
  if (locale === 'fr') {
    bullets.push(
      `Fourchette de valeur : ${fmt(priceRec.valueRange.min)} – ${fmt(priceRec.valueRange.max)}`
    );
    bullets.push(`Valeur médiane : ${fmt(priceRec.valueRange.median)}`);
    const adj = Math.abs(priceRec.adjustmentFromMedian * 100).toFixed(1);
    bullets.push(
      priceRec.adjustmentFromMedian < 0
        ? `Prix de mise en marché recommandé : ${fmt(priceRec.recommendedListPrice)} (${adj} % sous la médiane pour favoriser la liquidité)`
        : `Prix de mise en marché recommandé : ${fmt(priceRec.recommendedListPrice)}`
    );
    bullets.push(
      priceRec.pricingStrategy === 'SELL_FAST'
        ? 'Stratégie : vente rapide — prix ajusté pour maximiser les chances de transaction'
        : 'Stratégie : équilibrée — prix réaliste avec marge de négociation'
    );
    if (currentOccupancy < 0.9) {
      bullets.push(
        `Taux d'occupation de ${(currentOccupancy * 100).toFixed(0)} % intégré à l'évaluation`
      );
    }
  } else {
    bullets.push(
      `Value range: ${fmt(priceRec.valueRange.min)} – ${fmt(priceRec.valueRange.max)}`
    );
    bullets.push(`Median value: ${fmt(priceRec.valueRange.median)}`);
    bullets.push(`Recommended list price: ${fmt(priceRec.recommendedListPrice)}`);
    bullets.push(
      priceRec.pricingStrategy === 'SELL_FAST'
        ? 'Strategy: sell fast — price adjusted for liquidity'
        : 'Strategy: balanced — realistic price with negotiation room'
    );
  }
  return bullets;
}
