/**
 * Benchmark portefeuille — callable getGlobalFinancialBenchmark (cache session 15 min).
 */

import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { app } from '../lib/firebase';
import type { GlobalFinancialBenchmarkPayload } from '@primexpert/core/financial';

const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';

let functionsInstance: Functions | null = null;

function getFunctionsInstance(): Functions {
  if (!functionsInstance) {
    functionsInstance = getFunctions(app, functionsRegion);
  }
  return functionsInstance;
}

const TTL_MS = 15 * 60 * 1000;

let inflightPromise: Promise<GlobalFinancialBenchmarkPayload> | null = null;

function buildCacheKey(regionAdministrative?: string, assetClassLabel?: string): string {
  const region = (regionAdministrative ?? 'all').trim() || 'all';
  const klass = (assetClassLabel ?? 'all').trim() || 'all';
  return `primexpert_global_fin_benchmark_v2__${region}__${klass}`;
}

function readCache(cacheKey: string): GlobalFinancialBenchmarkPayload | null {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const { t, payload } = JSON.parse(raw) as { t: number; payload: GlobalFinancialBenchmarkPayload };
    if (Date.now() - t > TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, payload: GlobalFinancialBenchmarkPayload): void {
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), payload }));
  } catch {
    /* quota */
  }
}

export function readGlobalFinancialBenchmarkCache(input?: {
  regionAdministrative?: string;
  assetClassLabel?: string;
}): GlobalFinancialBenchmarkPayload | null {
  const cacheKey = buildCacheKey(input?.regionAdministrative, input?.assetClassLabel);
  return readCache(cacheKey);
}

export async function fetchGlobalFinancialBenchmark(options?: {
  forceRefresh?: boolean;
  regionAdministrative?: string;
  assetClassLabel?: string;
}): Promise<GlobalFinancialBenchmarkPayload> {
  const cacheKey = buildCacheKey(options?.regionAdministrative, options?.assetClassLabel);
  if (!options?.forceRefresh) {
    const cached = readCache(cacheKey);
    if (cached) return cached;
  }

  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    try {
      const fn = httpsCallable<
        { regionAdministrative?: string; assetClassLabel?: string },
        GlobalFinancialBenchmarkPayload
      >(
        getFunctionsInstance(),
        'getGlobalFinancialBenchmark'
      );
      const res = await fn({
        ...(options?.regionAdministrative
          ? { regionAdministrative: options.regionAdministrative }
          : {}),
        ...(options?.assetClassLabel ? { assetClassLabel: options.assetClassLabel } : {}),
      });
      const data = res.data;
      writeCache(cacheKey, data);
      return data;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}
