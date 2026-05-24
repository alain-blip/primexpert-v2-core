/** Ligne unifiée — Tableau des données du marché (Dashboard GPS V2). */

export type MarketDashboardDataType = 'transaction' | 'ratio' | 'macro';

export interface MarketDashboardRow {
  id: string;
  dataType: MarketDashboardDataType;
  region: string;
  city: string;
  date: string | null;
  keyMetric: string;
  source: string;
  anneeDonnees?: number;
  injectedAtMillis?: number;
}

export const MARKET_DATA_TYPE_LABELS: Record<
  MarketDashboardDataType,
  { fr: string; en: string }
> = {
  transaction: { fr: 'Transaction', en: 'Transaction' },
  ratio: { fr: 'Ratio', en: 'Ratio' },
  macro: { fr: 'Macro', en: 'Macro' },
};
