/**
 * Comparables Centris / Matrix — calcul TGA réel (RNE / prix de vente).
 */

import {
  computeCapitalizationRatePct,
  resolveNetOperatingIncome,
  resolveNoiFromValueAndCapRatePct,
} from '../financial/capitalization';
import { normalizeAdministrativeRegion } from './marketRegionNormalize';
import { normalizeRpaBuildingClass } from './gpsCapRateByRegionClass';

export interface CentrisComparableListing {
  mlsNumber: string;
  soldPrice: number;
  revenuBrutEffectif: number;
  densesExploitation: number;
  netOperatingIncome: number;
  calculatedCapRate: number;
  closedAtMillis: number;
  regionAdministrative: string;
  classeImmeuble: string;
}

export type CentrisComparableListingWithSource = CentrisComparableListing & {
  source: 'listings_cache' | 'market_analytics_raw';
  docId: string;
};

export interface TerritorialComparableQuery {
  regionAdministrative: string;
  classeImmeuble?: string | null;
}

export interface TerritorialComparableMergeResult {
  comparables: CentrisComparableListingWithSource[];
  medianTgaPct: number | null;
  sampleCount: number;
  filterScope: 'REGION_CLASS' | 'REGION' | 'ALL';
}

export function calculateComparableCapRate(
  listing: Omit<CentrisComparableListing, 'calculatedCapRate'>
): number {
  const rne = resolveNetOperatingIncome({
    netOperatingIncome: listing.netOperatingIncome,
    revenuBrutEffectif: listing.revenuBrutEffectif,
    depensesExploitation: listing.densesExploitation,
  });
  if (rne == null) return 0;
  return computeCapitalizationRatePct(rne, listing.soldPrice, 2) ?? 0;
}

function parseNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseMillis(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  if (typeof v === 'object' && v !== null && 'toMillis' in v) {
    try {
      return (v as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  if (typeof v === 'string' && v.trim()) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

function buildComparable(
  partial: Omit<CentrisComparableListing, 'calculatedCapRate' | 'netOperatingIncome'> & {
    netOperatingIncome?: number;
  }
): CentrisComparableListing | null {
  if (!partial.mlsNumber || partial.soldPrice <= 0) return null;
  const netOperatingIncome =
    resolveNetOperatingIncome({
      netOperatingIncome: partial.netOperatingIncome,
      revenuBrutEffectif: partial.revenuBrutEffectif,
      depensesExploitation: partial.densesExploitation,
    }) ?? 0;
  const row: Omit<CentrisComparableListing, 'calculatedCapRate'> = {
    ...partial,
    netOperatingIncome,
  };
  const calculatedCapRate = calculateComparableCapRate(row);
  if (calculatedCapRate <= 0) {
    const capFromSnap = parseNum((partial as { capRatePct?: number }).capRatePct);
    if (capFromSnap > 0) {
      return { ...row, calculatedCapRate: capFromSnap };
    }
    return null;
  }
  return { ...row, calculatedCapRate };
}

/** Mappe une entrée `market_analytics_raw`. */
export function mapMarketAnalyticsRawToComparable(
  id: string,
  data: Record<string, unknown>
): CentrisComparableListingWithSource | null {
  const snap = (data.comparableSnapshot ?? {}) as Record<string, unknown>;
  const meta = (data.marketTransactionMeta ?? {}) as Record<string, unknown>;
  const soldPrice = parseNum(snap.salePrice ?? meta.prixVente ?? data.prixVente);
  const capRatePct = parseNum(snap.capRatePct ?? data.capRatePct);
  const rbe = parseNum(data.revenuBrutEffectif ?? snap.revenuBrutEffectif);
  const depenses = parseNum(data.depensesExploitation ?? snap.depensesExploitation);
  const region = normalizeAdministrativeRegion(String(data.regionAdministrative ?? '').trim());
  const classe =
    normalizeRpaBuildingClass(
      snap.assetClassLabel ?? meta.classeImmeuble ?? data.assetClassLabel ?? data.classeImmeuble
    ) ?? '—';

  const closedAtMillis =
    parseMillis(data.injectedAtMillis) ||
    parseMillis(meta.dateTransaction) ||
    (typeof data.anneeDonnees === 'number'
      ? Date.UTC(data.anneeDonnees, 5, 1)
      : 0);

  const built = buildComparable({
    mlsNumber: String(meta.mlsNumber ?? meta.ListingId ?? id).trim(),
    soldPrice,
    revenuBrutEffectif: rbe,
    densesExploitation: depenses,
    netOperatingIncome:
      resolveNoiFromValueAndCapRatePct(soldPrice, capRatePct) ?? 0,
    closedAtMillis,
    regionAdministrative: region,
    classeImmeuble: classe,
    capRatePct,
  } as Omit<CentrisComparableListing, 'calculatedCapRate' | 'netOperatingIncome'> & {
    capRatePct?: number;
  });

  if (!built) return null;
  return { ...built, source: 'market_analytics_raw', docId: id };
}

/** Mappe un document `listings_cache` Centris. */
export function mapListingsCacheToComparable(
  id: string,
  data: Record<string, unknown>
): CentrisComparableListingWithSource | null {
  const preview = (data.canonicalPreview ?? {}) as Record<string, unknown>;
  const financials = (data.financials ?? preview.financials ?? {}) as Record<string, unknown>;
  const soldPrice = parseNum(
    preview.prixVente ?? preview.soldPrice ?? preview.prixDemande ?? data.soldPrice
  );
  const rbe = parseNum(financials.revenuBrutEffectif ?? preview.revenuBrutEffectif);
  const depenses = parseNum(financials.depensesExploitation ?? preview.depensesExploitation);
  const region = normalizeAdministrativeRegion(
    String(preview.regionAdministrative ?? data.regionAdministrative ?? '').trim()
  );
  const classe =
    normalizeRpaBuildingClass(preview.classeImmeuble ?? data.classeImmeuble) ?? '—';

  const built = buildComparable({
    mlsNumber: String(data.centrisListingId ?? preview.mlsNumber ?? id).trim(),
    soldPrice,
    revenuBrutEffectif: rbe,
    densesExploitation: depenses,
    closedAtMillis:
      parseMillis(data.closedAtMillis) ||
      parseMillis(data.modificationTimestamp) ||
      parseMillis(data.receivedAt),
    regionAdministrative: region,
    classeImmeuble: classe,
  });

  if (!built) return null;
  return { ...built, source: 'listings_cache', docId: id };
}

export function filterTerritorialComparables(
  rows: CentrisComparableListingWithSource[],
  query: TerritorialComparableQuery
): CentrisComparableListingWithSource[] {
  const regionTarget = normalizeAdministrativeRegion(query.regionAdministrative.trim());
  const classTarget = query.classeImmeuble
    ? normalizeRpaBuildingClass(query.classeImmeuble)
    : null;

  const regionClass = rows.filter((row) => {
    const regionOk = row.regionAdministrative === regionTarget;
    const classOk = !classTarget || row.classeImmeuble === classTarget;
    return regionOk && classOk;
  });
  if (regionClass.length >= 2) return regionClass;

  const regionOnly = rows.filter((row) => row.regionAdministrative === regionTarget);
  if (regionOnly.length >= 2) return regionOnly;

  return rows;
}

export function sortComparablesByRecencyDesc(
  rows: CentrisComparableListingWithSource[]
): CentrisComparableListingWithSource[] {
  return [...rows].sort((a, b) => b.closedAtMillis - a.closedAtMillis);
}

export function medianComparableCapRate(rows: CentrisComparableListing[]): number | null {
  const vals = rows
    .map((r) => r.calculatedCapRate)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid]! : (vals[mid - 1]! + vals[mid]!) / 2;
}

export function mergeCentrisTerritorialComparables(
  cacheRows: CentrisComparableListingWithSource[],
  analyticsRows: CentrisComparableListingWithSource[],
  query: TerritorialComparableQuery
): TerritorialComparableMergeResult {
  const merged = sortComparablesByRecencyDesc([...cacheRows, ...analyticsRows]);
  const regionTarget = normalizeAdministrativeRegion(query.regionAdministrative.trim());
  const classTarget = query.classeImmeuble
    ? normalizeRpaBuildingClass(query.classeImmeuble)
    : null;

  const regionClass = merged.filter(
    (r) =>
      r.regionAdministrative === regionTarget &&
      (!classTarget || r.classeImmeuble === classTarget)
  );
  if (regionClass.length >= 2) {
    return {
      comparables: regionClass,
      medianTgaPct: medianComparableCapRate(regionClass),
      sampleCount: regionClass.length,
      filterScope: 'REGION_CLASS',
    };
  }

  const regionOnly = merged.filter((r) => r.regionAdministrative === regionTarget);
  if (regionOnly.length >= 2) {
    return {
      comparables: regionOnly,
      medianTgaPct: medianComparableCapRate(regionOnly),
      sampleCount: regionOnly.length,
      filterScope: 'REGION',
    };
  }

  return {
    comparables: merged,
    medianTgaPct: medianComparableCapRate(merged),
    sampleCount: merged.length,
    filterScope: 'ALL',
  };
}

/** Alias mandate — préférer `mapMarketAnalyticsRawToComparable`. */
export const mapMarketAnalyticsRawToCentrisComparable = mapMarketAnalyticsRawToComparable;

export const mapListingsCacheToCentrisComparable = mapListingsCacheToComparable;

export const filterCentrisComparablesByTerritory = filterTerritorialComparables;

export const sortCentrisComparablesByRecency = sortComparablesByRecencyDesc;

export const medianCentrisCapRate = medianComparableCapRate;
