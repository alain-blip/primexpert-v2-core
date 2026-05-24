import { useEffect, useState } from 'react';
import {
  fetchGlobalFinancialBenchmark,
  readGlobalFinancialBenchmarkCache,
} from '../services/globalFinancialBenchmarkService';
import {
  GLOBAL_FINANCIAL_BENCHMARK_MIN_SAMPLES,
  PORTFOLIO_EXPENSE_RATIO_TOLERANCE,
  type GlobalFinancialBenchmarkPayload,
} from '@primexpert/core/financial';

export interface UseGlobalFinancialBenchmarkState {
  means: Record<string, number | null> | null;
  medians: Record<string, number | null> | null;
  counts: Record<string, number> | null;
  minSamples: number;
  thresholdFactor: number;
  scannedResidences: number | null;
  summary: GlobalFinancialBenchmarkPayload['summary'] | null;
  loading: boolean;
  error: string | null;
}

export function useGlobalFinancialBenchmark(enabled: boolean): UseGlobalFinancialBenchmarkState {
  const cached = typeof window !== 'undefined' ? readGlobalFinancialBenchmarkCache() : null;
  const [state, setState] = useState<UseGlobalFinancialBenchmarkState>({
    means: cached?.means ?? null,
    medians: cached?.medians ?? null,
    counts: cached?.counts ?? null,
    minSamples: cached?.minSamples ?? GLOBAL_FINANCIAL_BENCHMARK_MIN_SAMPLES,
    thresholdFactor: cached?.thresholdFactor ?? PORTFOLIO_EXPENSE_RATIO_TOLERANCE,
    scannedResidences: cached?.scannedResidences ?? null,
    summary: cached?.summary ?? null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;

    const hit = readGlobalFinancialBenchmarkCache();
    if (hit) {
      setState({
        means: hit.means ?? null,
        medians: hit.medians ?? null,
        counts: hit.counts ?? null,
        minSamples: hit.minSamples ?? GLOBAL_FINANCIAL_BENCHMARK_MIN_SAMPLES,
        thresholdFactor: hit.thresholdFactor ?? PORTFOLIO_EXPENSE_RATIO_TOLERANCE,
        scannedResidences: hit.scannedResidences ?? null,
        summary: hit.summary ?? null,
        loading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchGlobalFinancialBenchmark()
      .then((data) => {
        if (cancelled) return;
        setState({
          means: data.means ?? null,
          medians: data.medians ?? null,
          counts: data.counts ?? null,
          minSamples: data.minSamples ?? GLOBAL_FINANCIAL_BENCHMARK_MIN_SAMPLES,
          thresholdFactor: data.thresholdFactor ?? PORTFOLIO_EXPENSE_RATIO_TOLERANCE,
          scannedResidences: data.scannedResidences ?? null,
          summary: data.summary ?? null,
          loading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'Benchmark indisponible',
          means: null,
          medians: null,
          counts: null,
          summary: null,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
