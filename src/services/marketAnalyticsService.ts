/**
 * Requêtage territorial — comparables Centris (`listings_cache`) + Big Data (`market_analytics_raw`).
 */

import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  mapListingsCacheToComparable,
  mapMarketAnalyticsRawToComparable,
  mergeCentrisTerritorialComparables,
  type TerritorialComparableMergeResult,
  type TerritorialComparableQuery,
} from '@primexpert/core/market';
import { db } from '../lib/firebase';

const LISTINGS_CACHE = 'listings_cache';
const MARKET_ANALYTICS_RAW = 'market_analytics_raw';

export type { TerritorialComparableMergeResult, TerritorialComparableQuery };

export async function fetchTerritorialCentrisComparables(
  params: TerritorialComparableQuery & { maxDocs?: number }
): Promise<TerritorialComparableMergeResult> {
  const maxDocs = params.maxDocs ?? 400;
  const region = params.regionAdministrative?.trim();
  if (!region) {
    return { comparables: [], medianTgaPct: null, sampleCount: 0, filterScope: 'ALL' };
  }

  const cacheQ = query(
    collection(db, LISTINGS_CACHE),
    where('source', '==', 'centris_odata'),
    limit(Math.min(maxDocs, 200))
  );
  const analyticsQ = query(
    collection(db, MARKET_ANALYTICS_RAW),
    where('regionAdministrative', '==', region),
    limit(Math.min(maxDocs, 200))
  );

  const [cacheSnap, analyticsSnap] = await Promise.all([
    getDocs(cacheQ).catch(() => null),
    getDocs(analyticsQ).catch(() => null),
  ]);

  const cacheRows = (cacheSnap?.docs ?? [])
    .map((d) => mapListingsCacheToComparable(d.id, d.data() as Record<string, unknown>))
    .filter((r): r is NonNullable<typeof r> => r != null);

  const analyticsRows = (analyticsSnap?.docs ?? [])
    .map((d) => mapMarketAnalyticsRawToComparable(d.id, d.data() as Record<string, unknown>))
    .filter((r): r is NonNullable<typeof r> => r != null);

  return mergeCentrisTerritorialComparables(cacheRows, analyticsRows, {
    regionAdministrative: region,
    classeImmeuble: params.classeImmeuble ?? null,
  });
}

export interface SubscribeTerritorialCompetitionOptions extends TerritorialComparableQuery {
  enabled?: boolean;
  onData: (result: TerritorialComparableMergeResult) => void;
  onError?: (error: Error) => void;
}

/** Abonnement — ré-exécute le merge à chaque changement `market_analytics_raw`. */
export function subscribeTerritorialCompetition(
  options: SubscribeTerritorialCompetitionOptions
): Unsubscribe {
  const { enabled = true, onData, onError, regionAdministrative, classeImmeuble } = options;
  if (!enabled || !regionAdministrative?.trim()) {
    onData({ comparables: [], medianTgaPct: null, sampleCount: 0, filterScope: 'ALL' });
    return () => undefined;
  }

  let cancelled = false;
  const refresh = () => {
    void fetchTerritorialCentrisComparables({
      regionAdministrative,
      classeImmeuble,
    })
      .then((result) => {
        if (!cancelled) onData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      });
  };

  refresh();

  const q = query(
    collection(db, MARKET_ANALYTICS_RAW),
    where('regionAdministrative', '==', regionAdministrative.trim()),
    limit(200)
  );

  return onSnapshot(
    q,
    () => refresh(),
    (err) => onError?.(err)
  );
}
