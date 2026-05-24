/**
 * Lecture seule — market_analytics_raw + marketSnapshots/v1.
 * Paradigme Archiviste (fenêtre temporelle) + Statisticien (médianes régionales).
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  computeRegionalSummaries,
  normalizeRatioLabelKey,
  parseMarketDateToMillis,
  sortTransactionsDesc,
  type MarketGpsRatioSample,
  type MarketGpsRegionalSummary,
  type MarketGpsTransaction,
} from '@primexpert/core/market';

const MARKET_ANALYTICS_RAW = 'market_analytics_raw';
const MARKET_SNAPSHOTS = 'marketSnapshots';
const SNAPSHOT_DOC_ID = 'v1';
const MARKET_DOCUMENTS = 'market_documents';

function resolveDocLabel(docId: unknown, names: Map<string, string>): string {
  if (typeof docId !== 'string' || !docId.trim()) return '—';
  return names.get(docId) ?? `${docId.slice(0, 10)}…`;
}

function mapAnalyticsTransaction(
  id: string,
  data: Record<string, unknown>,
  docNames: Map<string, string>
): MarketGpsTransaction | null {
  if (!data.comparableSnapshot || typeof data.comparableSnapshot !== 'object') return null;

  const snap = data.comparableSnapshot as Record<string, unknown>;
  const txMeta = (data.marketTransactionMeta ?? {}) as Record<string, unknown>;
  const region = String(data.regionAdministrative ?? '').trim() || '—';
  const anneeDonnees =
    typeof data.anneeDonnees === 'number' ? data.anneeDonnees : undefined;
  const injectedAtMillis =
    typeof data.injectedAtMillis === 'number' ? data.injectedAtMillis : undefined;
  const date =
    txMeta.dateTransaction != null
      ? String(txMeta.dateTransaction)
      : anneeDonnees != null
        ? String(anneeDonnees)
        : null;
  const sortMillis = parseMarketDateToMillis(date, anneeDonnees, injectedAtMillis);
  const docId = txMeta.marketDocumentId;
  const adresse = txMeta.adresse != null ? String(txMeta.adresse).trim() : '';

  const nbPortes =
    typeof snap.units === 'number'
      ? snap.units
      : typeof txMeta.nbPortes === 'number'
        ? txMeta.nbPortes
        : undefined;

  return {
    id,
    region,
    city: String(snap.city ?? data.regionDisplayName ?? region).trim(),
    address: adresse,
    date,
    sortMillis,
    prixVente: typeof snap.salePrice === 'number' ? snap.salePrice : undefined,
    nbPortes,
    prixParPorte:
      typeof snap.netIncomePerUnit === 'number' ? snap.netIncomePerUnit : undefined,
    tgaPct: typeof snap.capRatePct === 'number' ? snap.capRatePct : undefined,
    prixParPi2:
      typeof txMeta.prixParPi2 === 'number' ? txMeta.prixParPi2 : undefined,
    source: adresse || resolveDocLabel(docId, docNames),
  };
}

function extractRatioSamplesFromAnalytics(
  id: string,
  data: Record<string, unknown>
): MarketGpsRatioSample[] {
  const benchMeta = (data.operationalBenchmarkMeta ?? {}) as Record<string, unknown>;
  if (!benchMeta || typeof benchMeta !== 'object' || !Object.keys(benchMeta).length) {
    return [];
  }

  const region = String(data.regionAdministrative ?? '').trim();
  if (!region || region === '—') return [];

  const anneeDonnees =
    typeof data.anneeDonnees === 'number' ? data.anneeDonnees : undefined;
  const injectedAtMillis =
    typeof data.injectedAtMillis === 'number' ? data.injectedAtMillis : undefined;
  const sortMillis = parseMarketDateToMillis(
    anneeDonnees != null ? String(anneeDonnees) : null,
    anneeDonnees,
    injectedAtMillis
  );

  const amounts = Array.isArray(data.validatedAmounts)
    ? (data.validatedAmounts as Array<{ label: string; value: number }>)
    : [];

  const samples: MarketGpsRatioSample[] = [];
  const baseLabel =
    amounts[0]?.label?.split('—')[0]?.trim() ??
    (benchMeta.categorie != null ? String(benchMeta.categorie) : 'Ratio');

  for (const a of amounts) {
    const labelKey = normalizeRatioLabelKey(a.label || baseLabel);
    const labelDisplay = a.label?.split('—')[0]?.trim() || baseLabel;
    if (/ratio/i.test(a.label) && Number.isFinite(a.value)) {
      samples.push({
        region,
        labelKey,
        labelDisplay,
        ratioPct: a.value,
        sortMillis,
      });
    }
    if (/porte|unit[eé]|\/\s*unit/i.test(a.label) && Number.isFinite(a.value)) {
      samples.push({
        region,
        labelKey,
        labelDisplay,
        montantParPorte: a.value,
        sortMillis,
      });
    }
  }

  if (!samples.length && amounts.length) {
    const labelKey = normalizeRatioLabelKey(baseLabel);
    for (const a of amounts) {
      if (!Number.isFinite(a.value)) continue;
      samples.push({
        region,
        labelKey,
        labelDisplay: baseLabel,
        ratioPct: /%|ratio/i.test(a.label) ? a.value : undefined,
        montantParPorte: /porte|unit[eé]|\/\s*unit/i.test(a.label) ? a.value : undefined,
        sortMillis,
      });
    }
  }

  return samples.length ? samples : [];
}

function mapSnapshotTransaction(
  row: Record<string, unknown>,
  index: number,
  docNames: Map<string, string>
): MarketGpsTransaction {
  const region = String(row.regionAdministrative ?? '—').trim();
  const date = row.dateTransaction != null ? String(row.dateTransaction) : null;
  const injectedAtMillis =
    typeof row.validatedAtMillis === 'number' ? row.validatedAtMillis : undefined;
  const sortMillis = parseMarketDateToMillis(date, undefined, injectedAtMillis);
  const fp =
    typeof row.dedupeFingerprint === 'string' ? row.dedupeFingerprint : `snap-tx-${index}`;

  return {
    id: fp,
    region,
    city: String(row.ville ?? row.adresse ?? region).trim(),
    address: row.adresse != null ? String(row.adresse).trim() : '',
    date,
    sortMillis,
    prixVente: typeof row.prixVente === 'number' ? row.prixVente : undefined,
    nbPortes: typeof row.nbPortes === 'number' ? row.nbPortes : undefined,
    prixParPorte: typeof row.prixParPorte === 'number' ? row.prixParPorte : undefined,
    tgaPct: typeof row.tgaPct === 'number' ? row.tgaPct : undefined,
    prixParPi2: typeof row.prixParPi2 === 'number' ? row.prixParPi2 : undefined,
    source: row.adresse
      ? String(row.adresse)
      : resolveDocLabel(row.marketDocumentId, docNames),
  };
}

function extractRatioSamplesFromSnapshotBench(
  row: Record<string, unknown>
): MarketGpsRatioSample[] {
  const region = String(row.regionAdministrative ?? '').trim();
  if (!region || region === '—') return [];

  const label = String(row.label ?? 'Ratio').trim();
  const labelKey = normalizeRatioLabelKey(label);
  const sortMillis = parseMarketDateToMillis(
    null,
    undefined,
    typeof row.validatedAtMillis === 'number' ? row.validatedAtMillis : undefined
  );
  const samples: MarketGpsRatioSample[] = [];

  if (typeof row.ratioPct === 'number') {
    samples.push({
      region,
      labelKey,
      labelDisplay: label,
      ratioPct: row.ratioPct,
      sortMillis,
    });
  }
  if (typeof row.montantParPorte === 'number') {
    samples.push({
      region,
      labelKey,
      labelDisplay: label,
      montantParPorte: row.montantParPorte,
      sortMillis,
    });
  }
  return samples;
}

function formatMacroHint(row: Record<string, unknown>, locale: 'fr' | 'en'): string {
  const parts: string[] = [];
  const cout = row.coutRemplacementNeuf as { montant?: number; unite?: string } | undefined;
  if (cout && typeof cout.montant === 'number') {
    const u = cout.unite === 'pi2' ? 'pi²' : cout.unite ?? 'unité';
    parts.push(
      locale === 'fr'
        ? `Coût remplacement : ${cout.montant.toLocaleString('fr-CA', { maximumFractionDigits: 0 })} $/${u}`
        : `Replacement cost: ${cout.montant.toLocaleString('en-CA', { maximumFractionDigits: 0 })} $/${u}`
    );
  }
  if (typeof row.nouvellesUnitesEnChantier === 'number') {
    parts.push(
      locale === 'fr'
        ? `Unités en chantier : ${row.nouvellesUnitesEnChantier}`
        : `Units under construction: ${row.nouvellesUnitesEnChantier}`
    );
  }
  return parts.join(' · ');
}

export interface UseMarketDataResult {
  transactions: MarketGpsTransaction[];
  regionalSummaries: MarketGpsRegionalSummary[];
  ratioSampleCount: number;
  loading: boolean;
  error: string | null;
  regions: string[];
  totalTransactionCount: number;
  totalRegionCount: number;
}

export function useMarketData(locale: 'fr' | 'en', brokerId?: string | null): UseMarketDataResult {
  const [analyticsTransactions, setAnalyticsTransactions] = useState<MarketGpsTransaction[]>(
    []
  );
  const [analyticsRatioSamples, setAnalyticsRatioSamples] = useState<MarketGpsRatioSample[]>(
    []
  );
  const [snapshotTransactions, setSnapshotTransactions] = useState<MarketGpsTransaction[]>([]);
  const [snapshotRatioSamples, setSnapshotRatioSamples] = useState<MarketGpsRatioSample[]>([]);
  const [macroByRegion, setMacroByRegion] = useState<Map<string, string>>(new Map());
  const [docNames, setDocNames] = useState<Map<string, string>>(new Map());
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const col = collection(db, MARKET_ANALYTICS_RAW);
    const unsub = onSnapshot(
      col,
      (snap) => {
        setLoadingAnalytics(false);
        setError(null);
        const txs: MarketGpsTransaction[] = [];
        const ratios: MarketGpsRatioSample[] = [];
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const tx = mapAnalyticsTransaction(d.id, data, docNames);
          if (tx) txs.push(tx);
          ratios.push(...extractRatioSamplesFromAnalytics(d.id, data));
        });
        setAnalyticsTransactions(txs);
        setAnalyticsRatioSamples(ratios);
      },
      (err) => {
        setLoadingAnalytics(false);
        setError(err.message);
        setAnalyticsTransactions([]);
        setAnalyticsRatioSamples([]);
      }
    );
    return () => unsub();
  }, [docNames]);

  useEffect(() => {
    const ref = doc(db, MARKET_SNAPSHOTS, SNAPSHOT_DOC_ID);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setLoadingSnapshot(false);
        if (!snap.exists()) {
          setSnapshotTransactions([]);
          setSnapshotRatioSamples([]);
          setMacroByRegion(new Map());
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        const regions = Array.isArray(data.macroRegions) ? data.macroRegions : [];
        const txs = Array.isArray(data.marketTransactions) ? data.marketTransactions : [];
        const benches = Array.isArray(data.operationalBenchmarks)
          ? data.operationalBenchmarks
          : [];

        const macroMap = new Map<string, string>();
        for (const r of regions) {
          const row = r as Record<string, unknown>;
          const region = String(row.regionAdministrative ?? '').trim();
          if (region) macroMap.set(region, formatMacroHint(row, locale));
        }
        setMacroByRegion(macroMap);

        setSnapshotTransactions(
          txs.map((r, i) =>
            mapSnapshotTransaction(r as Record<string, unknown>, i, docNames)
          )
        );
        const benchSamples: MarketGpsRatioSample[] = [];
        for (const b of benches) {
          benchSamples.push(
            ...extractRatioSamplesFromSnapshotBench(b as Record<string, unknown>)
          );
        }
        setSnapshotRatioSamples(benchSamples);
      },
      () => {
        setLoadingSnapshot(false);
        setSnapshotTransactions([]);
        setSnapshotRatioSamples([]);
        setMacroByRegion(new Map());
      }
    );
    return () => unsub();
  }, [locale, docNames]);

  useEffect(() => {
    if (!brokerId) {
      setDocNames(new Map());
      return;
    }
    const q = query(collection(db, MARKET_DOCUMENTS), where('uploadedBy', '==', brokerId));
    const unsub = onSnapshot(q, (snap) => {
      const map = new Map<string, string>();
      snap.forEach((d) => {
        map.set(d.id, String(d.data().fileName ?? d.id));
      });
      setDocNames(map);
    });
    return () => unsub();
  }, [brokerId]);

  const transactions = useMemo(() => {
    const byId = new Map<string, MarketGpsTransaction>();
    for (const t of analyticsTransactions) byId.set(t.id, t);
    for (const t of snapshotTransactions) {
      if (!byId.has(t.id)) byId.set(t.id, t);
    }
    return sortTransactionsDesc([...byId.values()]);
  }, [analyticsTransactions, snapshotTransactions]);

  const ratioSamples = useMemo(() => {
    const seen = new Set<string>();
    const merged: MarketGpsRatioSample[] = [];
    const add = (s: MarketGpsRatioSample, keyPrefix: string) => {
      const key = `${keyPrefix}|${s.region}|${s.labelKey}|${s.ratioPct ?? ''}|${s.montantParPorte ?? ''}|${s.sortMillis}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(s);
    };
    for (const s of analyticsRatioSamples) add(s, 'a');
    for (const s of snapshotRatioSamples) add(s, 's');
    return merged;
  }, [analyticsRatioSamples, snapshotRatioSamples]);

  const regionalSummaries = useMemo(
    () => computeRegionalSummaries(ratioSamples, macroByRegion),
    [ratioSamples, macroByRegion]
  );

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) {
      if (t.region && t.region !== '—') set.add(t.region);
    }
    for (const s of regionalSummaries) {
      if (s.region && s.region !== '—') set.add(s.region);
    }
    return [...set].sort((a, b) => a.localeCompare(b, locale === 'fr' ? 'fr-CA' : 'en-CA'));
  }, [transactions, regionalSummaries, locale]);

  return {
    transactions,
    regionalSummaries,
    ratioSampleCount: ratioSamples.length,
    loading: loadingAnalytics || loadingSnapshot,
    error,
    regions,
    totalTransactionCount: transactions.length,
    totalRegionCount: regionalSummaries.length,
  };
}
