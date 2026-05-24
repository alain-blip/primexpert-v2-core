/**
 * Injection HITL omnivore — routage macro / comparables / benchmarks (Admin SDK).
 * Écritures idempotentes via empreintes déterministes (@primexpert/core/market).
 */

import { getDb } from '../lib/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import {
  marketMacroRegionFingerprint,
  marketOperationalBenchmarkFingerprint,
  marketTransactionFingerprint,
} from './_vendored/marketDeduplication';

const MARKET_MACRO_STATS = 'market_macro_stats';
const MARKET_ANALYTICS_RAW = 'market_analytics_raw';
const MARKET_DOCUMENTS = 'market_documents';
const MARKET_SNAPSHOTS = 'marketSnapshots';
const SNAPSHOT_DOC_ID = 'v1';

export interface InjectMasterMarketPayload {
  documentId: string;
  brokerId: string;
  siloType?: string;
  selectedRegions: Array<Record<string, unknown>>;
  selectedTransactions: Array<Record<string, unknown>>;
  selectedOperationalBenchmarks: Array<Record<string, unknown>>;
}

export interface InjectMasterMarketResult {
  macroEntryIds: string[];
  analyticsEntryIds: string[];
  snapshotUpdated: boolean;
  macroNewCount: number;
  macroDuplicateCount: number;
  transactionsNewCount: number;
  transactionsDuplicateCount: number;
  benchmarksNewCount: number;
  benchmarksDuplicateCount: number;
}

function resolveAnnee(extracted: Record<string, unknown>): number {
  if (typeof extracted.anneeDonnees === 'number') return extracted.anneeDonnees;
  if (typeof extracted.anneePublication === 'number') return extracted.anneePublication;
  return new Date().getFullYear() - 1;
}

function resolveRegionAdministrative(row: Record<string, unknown>, fallback = 'Quebec'): string {
  const r = String(row.regionAdministrative ?? row.region ?? '').trim();
  return r || fallback;
}

async function classifyExistingIds(
  collectionName: string,
  ids: string[]
): Promise<Map<string, boolean>> {
  const db = getDb();
  const existsMap = new Map<string, boolean>();
  await Promise.all(
    ids.map(async (id) => {
      const snap = await db.collection(collectionName).doc(id).get();
      existsMap.set(id, snap.exists);
    })
  );
  return existsMap;
}

function appendSnapshotRows<T extends Record<string, unknown>>(
  prevRows: unknown[],
  incoming: T[],
  fingerprintKey: keyof T
): T[] {
  const existing = new Set<string>();
  for (const row of prevRows) {
    if (row && typeof row === 'object') {
      const fp = (row as Record<string, unknown>).dedupeFingerprint;
      if (typeof fp === 'string' && fp.length > 0) existing.add(fp);
    }
  }
  const merged: T[] = [];
  for (const row of prevRows) {
    if (row && typeof row === 'object') merged.push(row as T);
  }
  for (const row of incoming) {
    const fp = String(row[fingerprintKey] ?? '');
    if (!fp || existing.has(fp)) continue;
    merged.push(row);
    existing.add(fp);
  }
  return merged;
}

export async function injectMasterMarketExtractionServer(
  payload: InjectMasterMarketPayload
): Promise<InjectMasterMarketResult> {
  const {
    documentId,
    brokerId,
    siloType = 'rpa_ri_chsld',
    selectedRegions,
    selectedTransactions,
    selectedOperationalBenchmarks,
  } = payload;

  if (
    !selectedRegions.length &&
    !selectedTransactions.length &&
    !selectedOperationalBenchmarks.length
  ) {
    throw new Error('Sélectionnez au moins une donnée à conserver.');
  }

  const db = getDb();
  const docRef = db.collection(MARKET_DOCUMENTS).doc(documentId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error('Document marché introuvable.');

  const data = docSnap.data() ?? {};
  if (String(data.uploadedBy ?? '') !== brokerId) {
    throw new Error('Accès refusé.');
  }

  const extracted = (data.extractedData ?? {}) as Record<string, unknown>;
  const documentType = String(extracted.documentType ?? 'Statistiques du marché');
  const sourcePublisher = extracted.sourcePublisher ? String(extracted.sourcePublisher) : null;
  const anneeDonnees = resolveAnnee(extracted);

  const macroFingerprints = selectedRegions.map((region) =>
    marketMacroRegionFingerprint({
      regionAdministrative: resolveRegionAdministrative(region),
      anneeDonnees,
      documentType,
    })
  );

  const transactionFingerprints = selectedTransactions.map((tx) =>
    marketTransactionFingerprint({
      adresse: tx.adresse != null ? String(tx.adresse) : undefined,
      ville: String(tx.ville ?? tx.city ?? resolveRegionAdministrative(tx)),
      dateTransaction: tx.dateTransaction != null ? String(tx.dateTransaction) : null,
      prixVente: typeof tx.prixVente === 'number' ? tx.prixVente : null,
      siloType,
    })
  );

  const benchmarkFingerprints = selectedOperationalBenchmarks.map((bench) =>
    marketOperationalBenchmarkFingerprint({
      label: String(bench.label ?? 'Ratio'),
      regionAdministrative: resolveRegionAdministrative(bench),
      anneeDonnees,
      siloType,
    })
  );

  const [macroExists, txExists, benchExists] = await Promise.all([
    classifyExistingIds(MARKET_MACRO_STATS, macroFingerprints),
    classifyExistingIds(MARKET_ANALYTICS_RAW, transactionFingerprints),
    classifyExistingIds(MARKET_ANALYTICS_RAW, benchmarkFingerprints),
  ]);

  const batch = db.batch();
  const macroEntryIds: string[] = [];
  const analyticsEntryIds: string[] = [];
  const now = Date.now();
  let macroNewCount = 0;
  let macroDuplicateCount = 0;
  let transactionsNewCount = 0;
  let transactionsDuplicateCount = 0;
  let benchmarksNewCount = 0;
  let benchmarksDuplicateCount = 0;

  const snapshotMacroRows: Array<Record<string, unknown>> = [];
  const snapshotTxRows: Array<Record<string, unknown>> = [];
  const snapshotBenchRows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < selectedRegions.length; i++) {
    const region = selectedRegions[i];
    const fingerprint = macroFingerprints[i];
    const regionAdministrative = resolveRegionAdministrative(region);
    const isDuplicate = macroExists.get(fingerprint) === true;
    if (isDuplicate) macroDuplicateCount++;
    else macroNewCount++;

    const entryRef = db.collection(MARKET_MACRO_STATS).doc(fingerprint);
    batch.set(
      entryRef,
      {
        dedupeFingerprint: fingerprint,
        regionAdministrative,
        regionDisplayName: String(region.regionDisplayName ?? regionAdministrative),
        documentType,
        sourcePublisher,
        anneeDonnees,
        provenance: 'market_report',
        marketDocumentId: documentId,
        tauxPenetration: region.tauxPenetration ?? null,
        coutRemplacementNeuf: region.coutRemplacementNeuf ?? null,
        nouvellesUnitesEnChantier: region.nouvellesUnitesEnChantier ?? null,
        projetsEnChantier: region.projetsEnChantier ?? null,
        injectedAtMillis: now,
        validatedBy: brokerId,
      },
      { merge: true }
    );
    macroEntryIds.push(fingerprint);
    snapshotMacroRows.push({
      ...region,
      dedupeFingerprint: fingerprint,
      documentType,
      sourcePublisher,
      anneeDonnees,
      marketDocumentId: documentId,
      validatedAtMillis: now,
    });
  }

  for (let i = 0; i < selectedTransactions.length; i++) {
    const tx = selectedTransactions[i];
    const fingerprint = transactionFingerprints[i];
    const regionAdministrative = resolveRegionAdministrative(tx);
    const city = String(tx.ville ?? tx.city ?? regionAdministrative).trim();
    const isDuplicate = txExists.get(fingerprint) === true;
    if (isDuplicate) transactionsDuplicateCount++;
    else transactionsNewCount++;

    const prixVente = typeof tx.prixVente === 'number' ? tx.prixVente : null;
    const nbPortes = typeof tx.nbPortes === 'number' ? tx.nbPortes : null;
    const prixParPorte = typeof tx.prixParPorte === 'number' ? tx.prixParPorte : null;
    const tgaPct = typeof tx.tgaPct === 'number' ? tx.tgaPct : null;

    const entryRef = db.collection(MARKET_ANALYTICS_RAW).doc(fingerprint);
    batch.set(
      entryRef,
      {
        dedupeFingerprint: fingerprint,
        siloType,
        regionAdministrative,
        regionDisplayName: city,
        anneeDonnees,
        provenance: 'market_report',
        validatedAmounts: [],
        comparableSnapshot: {
          city,
          units: nbPortes ?? undefined,
          salePrice: prixVente ?? undefined,
          capRatePct: tgaPct ?? undefined,
          netIncomePerUnit: prixParPorte ?? undefined,
        },
        marketTransactionMeta: {
          rowId: String(tx.rowId ?? ''),
          adresse: tx.adresse ?? null,
          dateTransaction: tx.dateTransaction ?? null,
          prixParPi2: tx.prixParPi2 ?? null,
          typeImmeuble: tx.typeImmeuble ?? null,
          marketDocumentId: documentId,
        },
        injectedAtMillis: now,
        validatedBy: brokerId,
      },
      { merge: true }
    );
    analyticsEntryIds.push(fingerprint);
    snapshotTxRows.push({
      dedupeFingerprint: fingerprint,
      ville: tx.ville,
      adresse: tx.adresse,
      prixVente: tx.prixVente,
      nbPortes: tx.nbPortes,
      tgaPct: tx.tgaPct,
      prixParPorte: tx.prixParPorte,
      marketDocumentId: documentId,
      validatedAtMillis: now,
    });
  }

  for (let i = 0; i < selectedOperationalBenchmarks.length; i++) {
    const bench = selectedOperationalBenchmarks[i];
    const fingerprint = benchmarkFingerprints[i];
    const regionAdministrative = resolveRegionAdministrative(bench);
    const label = String(bench.label ?? 'Ratio').trim();
    const isDuplicate = benchExists.get(fingerprint) === true;
    if (isDuplicate) benchmarksDuplicateCount++;
    else benchmarksNewCount++;

    const amounts: Array<{ label: string; value: number; currency: string }> = [];
    if (typeof bench.montantParPorte === 'number') {
      amounts.push({ label: `${label} — par porte`, value: bench.montantParPorte, currency: 'CAD' });
    }
    if (typeof bench.montantAnnuel === 'number') {
      amounts.push({ label: `${label} — annuel`, value: bench.montantAnnuel, currency: 'CAD' });
    }
    if (typeof bench.ratioPct === 'number') {
      amounts.push({ label: `${label} — ratio (%)`, value: bench.ratioPct, currency: 'CAD' });
    }

    const entryRef = db.collection(MARKET_ANALYTICS_RAW).doc(fingerprint);
    batch.set(
      entryRef,
      {
        dedupeFingerprint: fingerprint,
        siloType,
        regionAdministrative,
        regionDisplayName: regionAdministrative,
        anneeDonnees,
        provenance: 'market_report',
        validatedAmounts: amounts,
        operationalBenchmarkMeta: {
          rowId: String(bench.rowId ?? ''),
          categorie: bench.categorie ?? null,
          marketDocumentId: documentId,
        },
        injectedAtMillis: now,
        validatedBy: brokerId,
      },
      { merge: true }
    );
    analyticsEntryIds.push(fingerprint);
    snapshotBenchRows.push({
      ...bench,
      dedupeFingerprint: fingerprint,
      marketDocumentId: documentId,
      validatedAtMillis: now,
    });
  }

  const snapshotRef = db.collection(MARKET_SNAPSHOTS).doc(SNAPSHOT_DOC_ID);
  const snapshotSnap = await snapshotRef.get();
  const prev = snapshotSnap.data() ?? {};

  batch.set(
    snapshotRef,
    {
      macroRegions: appendSnapshotRows(
        Array.isArray(prev.macroRegions) ? prev.macroRegions : [],
        snapshotMacroRows,
        'dedupeFingerprint'
      ),
      marketTransactions: appendSnapshotRows(
        Array.isArray(prev.marketTransactions) ? prev.marketTransactions : [],
        snapshotTxRows,
        'dedupeFingerprint'
      ),
      operationalBenchmarks: appendSnapshotRows(
        Array.isArray(prev.operationalBenchmarks) ? prev.operationalBenchmarks : [],
        snapshotBenchRows,
        'dedupeFingerprint'
      ),
      lastMacroInjectionAt: FieldValue.serverTimestamp(),
      lastMacroDocumentType: documentType,
    },
    { merge: true }
  );

  batch.update(docRef, {
    isValidated: true,
    validatedAtMillis: now,
    parsingStatus: 'verified',
  });

  await batch.commit();

  return {
    macroEntryIds,
    analyticsEntryIds,
    snapshotUpdated: true,
    macroNewCount,
    macroDuplicateCount,
    transactionsNewCount,
    transactionsDuplicateCount,
    benchmarksNewCount,
    benchmarksDuplicateCount,
  };
}

/** @deprecated Alias — regions seules */
export async function injectMarketMacroStatsServer(
  payload: InjectMasterMarketPayload
): Promise<{ entryIds: string[]; snapshotUpdated: boolean }> {
  const result = await injectMasterMarketExtractionServer(payload);
  return {
    entryIds: [...result.macroEntryIds, ...result.analyticsEntryIds],
    snapshotUpdated: result.snapshotUpdated,
  };
}
