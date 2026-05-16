import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import type { TenantContext } from '@primexpert/core/tenant';
import type { AssetNiche } from '../types/residence';
import {
  fetchResidencesPage,
  listResidencesPipeline,
  searchResidencesByAddressPrefix,
  type Residence,
} from '../services/residences';

function tenantCtx(uid: string): TenantContext {
  return { tenantId: uid, mode: 'strict' };
}

/**
 * Pipeline « actif » uniquement (exclut `unsigned` côté serveur si l’index existe).
 * `silo` : filtre Firestore CPE/Plex ; RPA inclut les fiches sans `assetNiche` (post-filtre).
 */
export function usePipelineResidences(
  tenantId: string | undefined,
  enabled = true,
  silo?: AssetNiche
) {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !enabled) {
      setResidences([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    listResidencesPipeline(tenantCtx(tenantId), { silo })
      .then((rows) => {
        if (!cancelled) setResidences(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, enabled, silo]);

  return { residences, loading, error };
}

/**
 * Inventaire complet avec lazy load (pages de 50) et recherche préfixe optionnelle.
 */
export function useInventoryResidences(
  tenantId: string | undefined,
  opts: { enabled: boolean; searchPrefix: string },
  silo?: AssetNiche
) {
  const { enabled, searchPrefix } = opts;
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const reset = useCallback(() => {
    setResidences([]);
    cursorRef.current = null;
    setHasMore(true);
    setError(null);
  }, []);

  const loadInitial = useCallback(async () => {
    if (!tenantId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const sp = searchPrefix.trim();
      if (sp) {
        const rows = await searchResidencesByAddressPrefix(tenantCtx(tenantId), sp, 80, { silo });
        setResidences(rows);
        setHasMore(false);
        cursorRef.current = null;
        return;
      }
      const page = await fetchResidencesPage(tenantCtx(tenantId), {
        pageSize: 50,
        startAfterDoc: null,
        silo,
      });
      setResidences(page.rows);
      cursorRef.current = page.lastDoc;
      setHasMore(page.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tenantId, enabled, searchPrefix, silo]);

  useEffect(() => {
    if (!enabled || !tenantId) {
      reset();
      return;
    }
    void loadInitial();
  }, [tenantId, enabled, searchPrefix, silo, loadInitial, reset]);

  const loadMore = useCallback(async () => {
    if (!tenantId || !enabled || !hasMore || loadingMore || searchPrefix.trim()) return;
    setLoadingMore(true);
    try {
      const page = await fetchResidencesPage(tenantCtx(tenantId), {
        pageSize: 50,
        startAfterDoc: cursorRef.current,
        silo,
      });
      cursorRef.current = page.lastDoc;
      setHasMore(page.hasMore);
      setResidences((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const merged = [...prev];
        for (const r of page.rows) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            merged.push(r);
          }
        }
        return merged;
      });
    } finally {
      setLoadingMore(false);
    }
  }, [tenantId, enabled, hasMore, loadingMore, searchPrefix, silo]);

  return {
    residences,
    loading: loading || loadingMore,
    error,
    loadMore,
    hasMore: hasMore && !searchPrefix.trim(),
    reset,
  };
}

/** @deprecated Utiliser `usePipelineResidences` ou `useInventoryResidences`. */
export type UseResidencesMode = 'active-only' | 'all';
