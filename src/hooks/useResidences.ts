import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import type { UserProfile } from '../lib/auth';
import { buildResidenceTenantContext } from '../lib/tenantContext';
import type { AssetNiche } from '../types/residence';
import {
  fetchResidencesPage,
  fetchSharedCatalogResidencesPage,
  listResidencesPipeline,
  searchResidencesByAddressPrefix,
  type Residence,
} from '../services/residences';

function tenantCtx(profile: Pick<UserProfile, 'uid' | 'role' | 'orgId'>) {
  return buildResidenceTenantContext(profile);
}

/**
 * Pipeline « actif » uniquement (exclut `unsigned` côté serveur si l’index existe).
 * `silo` : filtre Firestore CPE/Plex ; RPA inclut les fiches sans `assetNiche` (post-filtre).
 */
export function usePipelineResidences(
  profile: Pick<UserProfile, 'uid' | 'role' | 'orgId'> | null | undefined,
  enabled = true,
  silo?: AssetNiche
) {
  const tenantId = profile?.uid;
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !profile || !enabled) {
      setResidences([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    listResidencesPipeline(tenantCtx(profile), { silo })
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
  }, [profile, enabled, silo]);

  const patchResidenceStatus = useCallback((residenceId: string, status: Residence['status']) => {
    setResidences((prev) => patchResidenceStatusInList(prev, residenceId, status));
  }, []);

  return { residences, loading, error, patchResidenceStatus };
}

function patchResidenceStatusInList(
  rows: Residence[],
  residenceId: string,
  status: Residence['status']
): Residence[] {
  return rows.map((r) => (r.id === residenceId ? { ...r, status } : r));
}

/**
 * Inventaire complet avec lazy load (pages de 50) et recherche préfixe optionnelle.
 */
export function useInventoryResidences(
  profile: Pick<UserProfile, 'uid' | 'role' | 'orgId'> | null | undefined,
  opts: { enabled: boolean; searchPrefix: string },
  silo?: AssetNiche
) {
  const tenantId = profile?.uid;
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
        const rows = await searchResidencesByAddressPrefix(tenantCtx(profile), sp, 80, { silo });
        setResidences(rows);
        setHasMore(false);
        cursorRef.current = null;
        return;
      }
      const [mine, catalog] = await Promise.all([
        fetchResidencesPage(tenantCtx(profile), {
          pageSize: 50,
          startAfterDoc: null,
          silo,
        }),
        fetchSharedCatalogResidencesPage({ pageSize: 50, startAfterDoc: null, silo }),
      ]);
      const seen = new Set<string>();
      const merged: Residence[] = [];
      for (const r of [...mine.rows, ...catalog.rows]) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        merged.push(r);
      }
      setResidences(merged);
      cursorRef.current = mine.lastDoc;
      setHasMore(mine.hasMore || catalog.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [profile, enabled, searchPrefix, silo]);

  useEffect(() => {
    if (!enabled || !tenantId) {
      reset();
      return;
    }
    void loadInitial();
  }, [profile, enabled, searchPrefix, silo, loadInitial, reset]);

  const loadMore = useCallback(async () => {
    if (!tenantId || !enabled || !hasMore || loadingMore || searchPrefix.trim()) return;
    setLoadingMore(true);
    try {
      const page = await fetchResidencesPage(tenantCtx(profile), {
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
  }, [profile, enabled, hasMore, loadingMore, searchPrefix, silo]);

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
