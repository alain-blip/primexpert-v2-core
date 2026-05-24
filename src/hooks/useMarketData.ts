/**
 * Lecture seule — market_analytics_raw + marketSnapshots/v1.
 * Paradigme Archiviste + Statisticien (médianes, P&L régional, nettoyage régions).
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  cleanseMarketRegion,
  cleanseTransactionRow,
  computeRegionalPlStatements,
  computeRegionalSummaries,
  normalizeRatioLabelKey,
  parseMarketDateToMillis,
  sortTransactionsDesc,
  buildGpsRegionFilterOptions,
  type MarketGpsPlLine,
  type MarketGpsRatioSample,
  type MarketGpsRegionalPl,
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

function coerceYear(v: unknown): number | undefined {
  if (typeof v === 'number' && v > 1800 && v < 2100) return Math.round(v);
  if (typeof v === 'string' && /^\d{4}$/.test(v.trim())) return Number(v.trim());
  return undefined;
}

function coerceMarketDateString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    return new Date(v).toISOString().slice(0, 10);
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.toMillis === 'function') {
      return new Date((o.toMillis as () => number)()).toISOString().slice(0, 10);
    }
    if (typeof o.seconds === 'number') {
      return new Date(o.seconds * 1000).toISOString().slice(0, 10);
    }
  }
  const s = String(v).trim();
  return s || null;
}

function mapAnalyticsTransaction(
  id: string,
  data: Record<string, unknown>,
  docNames: Map<string, string>
): MarketGpsTransaction | null {
  if (!data.comparableSnapshot || typeof data.comparableSnapshot !== 'object') return null;

  const snap = data.comparableSnapshot as Record<string, unknown>;
  const txMeta = (data.marketTransactionMeta ?? {}) as Record<string, unknown>;
  const rawRegion = String(data.regionAdministrative ?? '').trim() || '—';
  const city = String(snap.city ?? data.regionDisplayName ?? rawRegion).trim();
  const region = cleanseMarketRegion(rawRegion, city);
  const anneeDonnees =
    typeof data.anneeDonnees === 'number' ? data.anneeDonnees : undefined;
  const date =
    coerceMarketDateString(txMeta.dateTransaction) ??
    (anneeDonnees != null ? String(anneeDonnees) : null);
  const sortMillis = parseMarketDateToMillis(date, anneeDonnees);
  const docId = txMeta.marketDocumentId;
  const adresse = txMeta.adresse != null ? String(txMeta.adresse).trim() : '';

  const nbPortes =
    typeof snap.units === 'number'
      ? snap.units
      : typeof txMeta.nbPortes === 'number'
        ? txMeta.nbPortes
        : undefined;

  const anneeConstruction =
    coerceYear(txMeta.anneeConstruction) ??
    coerceYear(snap.yearBuilt) ??
    coerceYear(txMeta.yearBuilt);

  const sourceDocumentId =
    typeof docId === 'string' && docId.trim() ? docId.trim() : undefined;
  const sourceDocumentName = sourceDocumentId
    ? resolveDocLabel(sourceDocumentId, docNames)
    : undefined;

  return cleanseTransactionRow({
    id,
    region,
    city,
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
    anneeConstruction,
    vendeur: txMeta.vendeur != null ? String(txMeta.vendeur).trim() : undefined,
    acheteur: txMeta.acheteur != null ? String(txMeta.acheteur).trim() : undefined,
    typeImmeuble:
      txMeta.typeImmeuble != null ? String(txMeta.typeImmeuble).trim() : undefined,
    source: adresse || sourceDocumentName || '—',
    sourceDocumentId,
    sourceDocumentName,
  });
}

function extractRatioSamplesFromAnalytics(
  data: Record<string, unknown>
): MarketGpsRatioSample[] {
  const benchMeta = (data.operationalBenchmarkMeta ?? {}) as Record<string, unknown>;
  if (!benchMeta || typeof benchMeta !== 'object' || !Object.keys(benchMeta).length) {
    return [];
  }

  const rawRegion = String(data.regionAdministrative ?? '').trim();
  const city = String(data.regionDisplayName ?? '').trim();
  const region = cleanseMarketRegion(rawRegion, city);
  if (!region || region === '—') return [];

  const anneeDonnees =
    typeof data.anneeDonnees === 'number' ? data.anneeDonnees : undefined;
  const sortMillis = parseMarketDateToMillis(
    anneeDonnees != null ? String(anneeDonnees) : null,
    anneeDonnees
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
    if (/porte|unit[eé]|\/\s*unit|annuel/i.test(a.label) && Number.isFinite(a.value)) {
      if (/ratio/i.test(a.label)) continue;
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
  const rawRegion = String(row.regionAdministrative ?? '—').trim();
  const city = String(row.ville ?? row.adresse ?? rawRegion).trim();
  const region = cleanseMarketRegion(rawRegion, city);
  const date = coerceMarketDateString(row.dateTransaction);
  const anneeDonnees =
    typeof row.anneeDonnees === 'number' ? row.anneeDonnees : coerceYear(row.anneeDonnees);
  const sortMillis = parseMarketDateToMillis(
    date ?? (anneeDonnees != null ? String(anneeDonnees) : null),
    anneeDonnees
  );
  const fp =
    typeof row.dedupeFingerprint === 'string' ? row.dedupeFingerprint : `snap-tx-${index}`;

  const sourceDocumentId =
    typeof row.marketDocumentId === 'string' ? row.marketDocumentId : undefined;

  return cleanseTransactionRow({
    id: fp,
    region,
    city,
    address: row.adresse != null ? String(row.adresse).trim() : '',
    date,
    sortMillis,
    prixVente: typeof row.prixVente === 'number' ? row.prixVente : undefined,
    nbPortes: typeof row.nbPortes === 'number' ? row.nbPortes : undefined,
    prixParPorte: typeof row.prixParPorte === 'number' ? row.prixParPorte : undefined,
    tgaPct: typeof row.tgaPct === 'number' ? row.tgaPct : undefined,
    prixParPi2: typeof row.prixParPi2 === 'number' ? row.prixParPi2 : undefined,
    anneeConstruction: coerceYear(row.anneeConstruction),
    vendeur: row.vendeur != null ? String(row.vendeur).trim() : undefined,
    acheteur: row.acheteur != null ? String(row.acheteur).trim() : undefined,
    typeImmeuble: row.typeImmeuble != null ? String(row.typeImmeuble).trim() : undefined,
    source: row.adresse
      ? String(row.adresse)
      : resolveDocLabel(row.marketDocumentId, docNames),
    sourceDocumentId,
    sourceDocumentName: sourceDocumentId
      ? resolveDocLabel(sourceDocumentId, docNames)
      : undefined,
  });
}

function extractRatioSamplesFromSnapshotBench(
  row: Record<string, unknown>
): MarketGpsRatioSample[] {
  const rawRegion = String(row.regionAdministrative ?? '').trim();
  const region = cleanseMarketRegion(rawRegion);
  if (!region || region === '—') return [];

  const label = String(row.label ?? 'Ratio').trim();
  const labelKey = normalizeRatioLabelKey(label);
  const anneeDonnees =
    typeof row.anneeDonnees === 'number' ? row.anneeDonnees : coerceYear(row.anneeDonnees);
  const sortMillis = parseMarketDateToMillis(
    anneeDonnees != null ? String(anneeDonnees) : null,
    anneeDonnees
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
  const rawRegion = String(row.regionAdministrative ?? '').trim();
  const region = rawRegion ? cleanseMarketRegion(rawRegion) : '';
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

function cleanseRatioSample(s: MarketGpsRatioSample): MarketGpsRatioSample {
  return { ...s, region: cleanseMarketRegion(s.region) };
}

export interface UseMarketDataResult {
  transactions: MarketGpsTransaction[];
  regionalSummaries: MarketGpsRegionalSummary[];
  regionalPlStatements: MarketGpsRegionalPl[];
  ratioSamples: MarketGpsRatioSample[];
  ratioSampleCount: number;
  loading: boolean;
  error: string | null;
  regions: string[];
  totalTransactionCount: number;
  totalRegionCount: number;
}

export type { MarketGpsPlLine, MarketGpsRegionalPl, MarketGpsTransaction };

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
          ratios.push(...extractRatioSamplesFromAnalytics(data));
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
          const region = cleanseMarketRegion(String(row.regionAdministrative ?? '').trim());
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
      const cleaned = cleanseRatioSample(s);
      const key = `${keyPrefix}|${cleaned.region}|${cleaned.labelKey}|${cleaned.ratioPct ?? ''}|${cleaned.montantParPorte ?? ''}|${cleaned.sortMillis}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(cleaned);
    };
    for (const s of analyticsRatioSamples) add(s, 'a');
    for (const s of snapshotRatioSamples) add(s, 's');
    return merged;
  }, [analyticsRatioSamples, snapshotRatioSamples]);

  const regionalSummaries = useMemo(
    () => computeRegionalSummaries(ratioSamples, macroByRegion),
    [ratioSamples, macroByRegion]
  );

  const regionalPlStatements = useMemo(
    () => computeRegionalPlStatements(ratioSamples, macroByRegion),
    [ratioSamples, macroByRegion]
  );

  const regions = useMemo(() => {
    const labels: string[] = [];
    for (const t of transactions) {
      if (t.region && t.region !== '—') labels.push(t.region);
    }
    for (const s of regionalPlStatements) {
      if (s.region && s.region !== '—') labels.push(s.region);
    }
    for (const s of ratioSamples) {
      if (s.region && s.region !== '—') labels.push(s.region);
    }
    return buildGpsRegionFilterOptions(labels);
  }, [transactions, regionalPlStatements, ratioSamples]);

  return {
    transactions,
    regionalSummaries,
    regionalPlStatements,
    ratioSamples,
    ratioSampleCount: ratioSamples.length,
    loading: loadingAnalytics || loadingSnapshot,
    error,
    regions,
    totalTransactionCount: transactions.length,
    totalRegionCount: regionalPlStatements.length,
  };
}
