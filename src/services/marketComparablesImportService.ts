/**
 * Import manuel comparables GPS → market_analytics_raw (Sprint 0 ACM).
 */

import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  attachDedupeMetadata,
  marketTransactionFingerprint,
  stripDedupeFields,
  type ExistingComparableSaleDoc,
  type GpsComparableCsvRow,
} from '@primexpert/core/market';
import type { MarketGpsTransaction } from '@primexpert/core/market';

const MARKET_ANALYTICS_RAW = 'market_analytics_raw';
const DEFAULT_SILO = 'rpa_ri_chsld';

function inferAnneeDonnees(dateVente: string | null): number {
  if (dateVente && /^\d{4}/.test(dateVente)) return Number(dateVente.slice(0, 4));
  return new Date().getFullYear();
}

export function mapTransactionsToExistingDocs(
  transactions: MarketGpsTransaction[]
): ExistingComparableSaleDoc[] {
  return transactions.map((tx) => ({
    id: tx.id,
    adresse: tx.address,
    ville: tx.city,
    ville_comparable: tx.city,
    dateTransaction: tx.date,
    date_vente: tx.date,
    prixVente: tx.prixVente,
    prix_vente: tx.prixVente,
    source: tx.sourceDocumentName ?? tx.source,
  }));
}

export function prepareCsvImportWithDedupe(
  rows: GpsComparableCsvRow[],
  existingTransactions: MarketGpsTransaction[]
) {
  const existing = mapTransactionsToExistingDocs(existingTransactions);
  return attachDedupeMetadata(rows, existing);
}

export interface ImportGpsComparablesResult {
  imported: number;
  skipped: number;
  entryIds: string[];
}

export async function importGpsComparableRows(
  rows: Array<GpsComparableCsvRow & { _dedupe?: { userAction: 'import' | 'skip' } }>,
  brokerId: string
): Promise<ImportGpsComparablesResult> {
  const toImport = rows.filter((r) => r._dedupe?.userAction !== 'skip');
  if (!toImport.length) {
    return { imported: 0, skipped: rows.length, entryIds: [] };
  }

  const batch = writeBatch(db);
  const entryIds: string[] = [];
  const now = Date.now();

  for (const raw of toImport) {
    const row = stripDedupeFields(raw as GpsComparableCsvRow & Record<string, unknown>);
    const regionAdministrative = row.region?.trim() || row.ville_comparable;
    const anneeDonnees = inferAnneeDonnees(row.date_vente);
    const fingerprint = marketTransactionFingerprint({
      adresse: row.ville_comparable,
      ville: row.ville_comparable,
      dateTransaction: row.date_vente,
      prixVente: row.prix_vente,
      siloType: DEFAULT_SILO,
    });

    const entryRef = doc(db, MARKET_ANALYTICS_RAW, fingerprint);
    batch.set(
      entryRef,
      {
        dedupeFingerprint: fingerprint,
        siloType: DEFAULT_SILO,
        regionAdministrative,
        regionDisplayName: row.ville_comparable,
        anneeDonnees,
        provenance: 'gps_import_manuel',
        validatedAmounts: [],
        comparableSnapshot: {
          city: row.ville_comparable,
          units: row.nombre_unites ?? undefined,
          salePrice: row.prix_vente,
          netIncomePerUnit: row.prix_par_unite ?? undefined,
        },
        marketTransactionMeta: {
          adresse: row.ville_comparable,
          dateTransaction: row.date_vente ?? null,
          nbPortes: row.nombre_unites ?? null,
          prixParPorte: row.prix_par_unite ?? null,
          canalImport: row.canal_import,
          prixMiseEnMarche: row.prix_mise_en_marche ?? null,
          dom: row.dom ?? null,
          classeImmeuble: row.classe_immeuble ?? null,
          ecartListeVentePct: row.ecart_liste_vente_pct ?? null,
          importSource: 'csv',
          importedByUid: brokerId,
        },
        injectedAtMillis: now,
        validatedBy: brokerId,
      },
      { merge: true }
    );
    entryIds.push(fingerprint);
  }

  await batch.commit();

  return {
    imported: toImport.length,
    skipped: rows.length - toImport.length,
    entryIds,
  };
}

/** Déclenche téléchargement modèle CSV (navigateur). */
export { downloadGpsComparablesTemplate, exportGpsComparablesCsv } from '@primexpert/core/market';
