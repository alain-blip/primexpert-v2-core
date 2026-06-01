/**
 * Hook — comparables territoriaux Centris / GPS pour l'ACM (V3.2).
 */

import { useEffect, useMemo, useState } from 'react';
import type { TerritorialComparableMergeResult } from '@primexpert/core/market';
import { subscribeTerritorialCompetition } from '../services/marketAnalyticsService';

export interface UseTerritorialCompetitionOptions {
  regionAdministrative?: string | null;
  classeImmeuble?: string | null;
  enabled?: boolean;
}

export function useTerritorialCompetition(options: UseTerritorialCompetitionOptions) {
  const { regionAdministrative, classeImmeuble, enabled = true } = options;
  const [data, setData] = useState<TerritorialComparableMergeResult | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const filterKey = useMemo(
    () => `${regionAdministrative ?? ''}|${classeImmeuble ?? ''}|${enabled}`,
    [regionAdministrative, classeImmeuble, enabled]
  );

  useEffect(() => {
    if (!enabled || !regionAdministrative?.trim()) {
      setData(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const unsub = subscribeTerritorialCompetition({
      regionAdministrative,
      classeImmeuble,
      enabled,
      onData: (result) => {
        setData(result);
        setLoading(false);
      },
      onError: (err) => {
        setError(err);
        setLoading(false);
      },
    });

    return unsub;
  }, [filterKey, regionAdministrative, classeImmeuble, enabled]);

  return {
    data,
    comparables: data?.comparables ?? [],
    medianTgaPct: data?.medianTgaPct ?? null,
    sampleCount: data?.sampleCount ?? 0,
    filterScope: data?.filterScope ?? 'ALL',
    loading,
    error,
    regionAdministrative: regionAdministrative ?? null,
    classeImmeuble: classeImmeuble ?? null,
  };
}
