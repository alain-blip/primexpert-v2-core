/**
 * useMarketSnapshot — hook lecture seule sur `marketSnapshots/v1`.
 * Retourne un `PortfolioBenchmarkContext` typé prêt à brancher dans
 * `computePerformanceAudit360`. Si le document Firestore est absent ou
 * incomplet, `snapshot` reste `null` et le moteur 360° utilise son repli
 * sectoriel (`buildSectorBenchmarkContext`) — aucune régression.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { PortfolioBenchmarkContext } from '@primexpert/core/financial';
import { db } from '../lib/firebase';

interface MarketSnapshotDoc {
  source?: unknown;
  minSamples?: unknown;
  means?: unknown;
  counts?: unknown;
  updatedAt?: unknown;
  scope?: unknown;
}

export interface MarketSnapshotState {
  snapshot: PortfolioBenchmarkContext | null;
  loading: boolean;
  hasPortfolio: boolean;
  scope: string | null;
  updatedAt: unknown;
}

function parseRatioMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || value === undefined || value === '') continue;
    const numeric =
      typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : Number(value);
    if (!Number.isFinite(numeric)) continue;
    out[key] = numeric;
  }
  return out;
}

function parseCountMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const numeric =
      typeof value === 'string' ? parseInt(value.replace(/[^\d.-]/g, ''), 10) : Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) continue;
    out[key] = Math.floor(numeric);
  }
  return out;
}

function buildContextFromDoc(data: MarketSnapshotDoc): PortfolioBenchmarkContext | null {
  const means = parseRatioMap(data.means);
  if (Object.keys(means).length === 0) return null;
  const counts = parseCountMap(data.counts);
  const minSamples =
    typeof data.minSamples === 'number' && Number.isFinite(data.minSamples) && data.minSamples > 0
      ? Math.floor(data.minSamples)
      : 3;
  const source: PortfolioBenchmarkContext['source'] =
    data.source === 'sector_ref' ? 'sector_ref' : 'portfolio';
  return { means, counts, minSamples, source };
}

export function useMarketSnapshot(): MarketSnapshotState {
  const [state, setState] = useState<MarketSnapshotState>({
    snapshot: null,
    loading: true,
    hasPortfolio: false,
    scope: null,
    updatedAt: null,
  });

  useEffect(() => {
    const ref = doc(db, 'marketSnapshots', 'v1');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setState({
            snapshot: null,
            loading: false,
            hasPortfolio: false,
            scope: null,
            updatedAt: null,
          });
          return;
        }
        const data = snap.data() as MarketSnapshotDoc;
        const ctx = buildContextFromDoc(data);
        setState({
          snapshot: ctx,
          loading: false,
          hasPortfolio: ctx?.source === 'portfolio',
          scope: typeof data.scope === 'string' && data.scope.trim() ? data.scope : null,
          updatedAt: data.updatedAt ?? null,
        });
      },
      () => {
        setState({
          snapshot: null,
          loading: false,
          hasPortfolio: false,
          scope: null,
          updatedAt: null,
        });
      }
    );
    return () => unsub();
  }, []);

  return state;
}
