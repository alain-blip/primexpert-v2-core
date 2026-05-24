/**
 * Agrégats Dashboard GPS — KPI et séries graphiques (moteur V2 uniquement).
 */

import {
  median,
  type MarketGpsRegionalPl,
  type MarketGpsTransaction,
} from './marketGpsViewModel';
import { coerceToGpsFilterRegion, compareGpsRegionsForDisplay } from './marketRegionNormalize';

export interface MarketGpsRegionMetricRow {
  region: string;
  tgaMedian?: number;
  prixUnitMedian?: number;
  count: number;
}

export interface MarketGpsCapacityBucket {
  id: string;
  labelFr: string;
  labelEn: string;
  min: number;
  max: number;
  prixUnitMedian?: number;
  count: number;
}

export interface MarketGpsDashboardMetrics {
  transactionCount: number;
  /** TGA médian — pourcentage (ex. 8,5). */
  tgaMedian?: number;
  /** Multiplicateur revenu brut médian. */
  mrbMedian?: number;
  /** Prix / unité médian ($). */
  prixUnitMedian?: number;
  /** Ratio des dépenses d'exploitation (RDE) médian — pourcentage. */
  rdeMedian?: number;
  byRegion: MarketGpsRegionMetricRow[];
  byCapacity: MarketGpsCapacityBucket[];
}

const CAPACITY_BUCKETS: Omit<MarketGpsCapacityBucket, 'prixUnitMedian' | 'count'>[] = [
  { id: 'small', labelFr: 'Petite (1-20)', labelEn: 'Small (1-20)', min: 1, max: 20 },
  { id: 'medium', labelFr: 'Moyenne (21-50)', labelEn: 'Medium (21-50)', min: 21, max: 50 },
  { id: 'large', labelFr: 'Grande (51-100)', labelEn: 'Large (51-100)', min: 51, max: 100 },
  { id: 'xlarge', labelFr: 'Très grande (100+)', labelEn: 'Very large (100+)', min: 101, max: Infinity },
];

/** Prix / unité de vente — privilégie prix ÷ unités lorsque disponible. */
export function effectiveSalePricePerUnit(tx: MarketGpsTransaction): number | undefined {
  if (tx.prixVente != null && tx.nbPortes != null && tx.nbPortes > 0) {
    return tx.prixVente / tx.nbPortes;
  }
  return tx.prixParPorte;
}

function computeMrbValues(
  transactions: MarketGpsTransaction[],
  rbePerUnitByRegion: Map<string, number>
): number[] {
  const out: number[] = [];
  for (const tx of transactions) {
    if (tx.prixVente == null || tx.nbPortes == null || tx.nbPortes <= 0) continue;
    const rbePerUnit = rbePerUnitByRegion.get(tx.region);
    if (rbePerUnit == null || rbePerUnit <= 0) continue;
    const grossRevenue = rbePerUnit * tx.nbPortes;
    if (grossRevenue <= 0) continue;
    out.push(tx.prixVente / grossRevenue);
  }
  return out;
}

function aggregateRdeMedian(statements: MarketGpsRegionalPl[]): number | undefined {
  const vals = statements
    .map((s) => s.rdePct?.median)
    .filter((v): v is number => v != null && Number.isFinite(v));
  return median(vals);
}

export function computeMarketGpsDashboardMetrics(
  transactions: MarketGpsTransaction[],
  regionalPlStatements: MarketGpsRegionalPl[]
): MarketGpsDashboardMetrics {
  const tgaValues = transactions
    .map((t) => t.tgaPct)
    .filter((v): v is number => v != null && Number.isFinite(v));

  const prixUnitValues = transactions
    .map((t) => effectiveSalePricePerUnit(t))
    .filter((v): v is number => v != null && Number.isFinite(v));

  const rbePerUnitByRegion = new Map<string, number>();
  for (const pl of regionalPlStatements) {
    if (pl.rbePerUnit?.median != null) {
      rbePerUnitByRegion.set(pl.region, pl.rbePerUnit.median);
    }
  }

  const mrbValues = computeMrbValues(transactions, rbePerUnitByRegion);

  const byRegionMap = new Map<string, MarketGpsTransaction[]>();
  for (const tx of transactions) {
    if (!tx.region || tx.region === '—') continue;
    const region = coerceToGpsFilterRegion(tx.region, tx.city);
    const list = byRegionMap.get(region) ?? [];
    list.push(tx);
    byRegionMap.set(region, list);
  }

  const byRegion: MarketGpsRegionMetricRow[] = [...byRegionMap.entries()]
    .map(([region, rows]) => ({
      region,
      tgaMedian: median(
        rows.map((r) => r.tgaPct).filter((v): v is number => v != null && Number.isFinite(v))
      ),
      prixUnitMedian: median(
        rows
          .map((r) => effectiveSalePricePerUnit(r))
          .filter((v): v is number => v != null && Number.isFinite(v))
      ),
      count: rows.length,
    }))
    .sort((a, b) => {
      const cmp = compareGpsRegionsForDisplay(a.region, b.region);
      if (cmp !== 0) return cmp;
      return b.count - a.count;
    });

  const byCapacity: MarketGpsCapacityBucket[] = CAPACITY_BUCKETS.map((bucket) => {
    const rows = transactions.filter(
      (t) =>
        t.nbPortes != null &&
        t.nbPortes >= bucket.min &&
        (bucket.max === Infinity ? true : t.nbPortes <= bucket.max)
    );
    const prixVals = rows
      .map((r) => effectiveSalePricePerUnit(r))
      .filter((v): v is number => v != null && Number.isFinite(v));
    return {
      ...bucket,
      prixUnitMedian: median(prixVals),
      count: rows.length,
    };
  });

  return {
    transactionCount: transactions.length,
    tgaMedian: median(tgaValues),
    mrbMedian: median(mrbValues),
    prixUnitMedian: median(prixUnitValues),
    rdeMedian: aggregateRdeMedian(regionalPlStatements),
    byRegion,
    byCapacity,
  };
}
