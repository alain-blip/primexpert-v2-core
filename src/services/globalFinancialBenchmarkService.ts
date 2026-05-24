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

const CACHE_KEY = 'primexpert_global_fin_benchmark_v1';
const TTL_MS = 15 * 60 * 1000;

let inflightPromise: Promise<GlobalFinancialBenchmarkPayload> | null = null;

function readCache(): GlobalFinancialBenchmarkPayload | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { t, payload } = JSON.parse(raw) as { t: number; payload: GlobalFinancialBenchmarkPayload };
    if (Date.now() - t > TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

function writeCache(payload: GlobalFinancialBenchmarkPayload): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), payload }));
  } catch {
    /* quota */
  }
}

export function readGlobalFinancialBenchmarkCache(): GlobalFinancialBenchmarkPayload | null {
  return readCache();
}

export async function fetchGlobalFinancialBenchmark(options?: {
  forceRefresh?: boolean;
}): Promise<GlobalFinancialBenchmarkPayload> {
  if (!options?.forceRefresh) {
    const cached = readCache();
    if (cached) return cached;
  }

  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    try {
      const fn = httpsCallable<Record<string, never>, GlobalFinancialBenchmarkPayload>(
        getFunctionsInstance(),
        'getGlobalFinancialBenchmark'
      );
      const res = await fn({});
      const data = res.data;
      writeCache(data);
      return data;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}
