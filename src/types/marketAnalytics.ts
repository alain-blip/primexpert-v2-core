/** Segmentation Big Data — entrées anonymisées `market_analytics_raw`. */

export type MarketSiloType =
  | 'rpa_ri_chsld'
  | 'plex_multi'
  | 'cpe'
  | 'condo_unifamilial'
  | 'fonds_de_commerce';

export type MarketDataProvenance = 'etats_financiers' | 'rapport_evaluation';

export interface MarketAnalyticsValidatedAmount {
  label: string;
  value: number;
  currency?: string;
  expenseKey?: string;
}

export interface MarketAnalyticsComparable {
  label: string;
  salePrice?: number;
  capRatePct?: number;
  regionKey?: string;
}

export interface MarketAnalyticsRawEntry {
  siloType: MarketSiloType;
  regionAdministrative: string;
  regionDisplayName: string;
  anneeDonnees: number;
  provenance: MarketDataProvenance;
  validatedAmounts: MarketAnalyticsValidatedAmount[];
  comparables?: MarketAnalyticsComparable[];
  injectedAtMillis: number;
}
