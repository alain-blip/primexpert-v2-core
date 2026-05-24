/**
 * Types partagés — stress tests & stratégie de prix (ACM).
 */

export interface Range {
  min: number;
  max: number;
}

export interface RangeWithMedian extends Range {
  median: number;
}

export type MarketType = 'METRO' | 'SECONDARY' | 'REGIONAL' | 'RURAL_MICRO';
export type AssetSize = 'SMALL' | 'MID' | 'LARGE';
export type PricingStrategy = 'SELL_FAST' | 'BALANCED';

export interface StressTestResult {
  occupancyRate: number;
  noi: number;
  valueRange: Range;
}

export interface StressTests {
  occ85: StressTestResult;
  occ90: StressTestResult;
  occ100: StressTestResult;
}

export interface PriceRecommendation {
  valueRange: RangeWithMedian;
  recommendedListPrice: number;
  pricingStrategy: PricingStrategy;
  adjustmentFromMedian: number;
}
