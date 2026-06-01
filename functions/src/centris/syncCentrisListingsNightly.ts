/**
 * Synchronisation nocturne Centris / MLS — promotion listings_cache → residences.
 * Ignore catégoriquement les fiches `listingSource === 'off_market'`.
 */

import { getDb } from '../lib/firestore';
import {
  buildCentrisMlsStatusSyncPatch,
  shouldSkipCentrisListingSync,
} from './_vendored/listingSource';

const LISTINGS_CACHE = 'listings_cache';
const RESIDENCES = 'residences';

export interface CentrisSyncBatchResult {
  scanned: number;
  skippedOffMarket: number;
  skippedManualOverride: number;
  statusUpdated: number;
  noResidenceLink: number;
}

/** Applique le statut MLS sur une résidence liée — respecte off_market et override manuel. */
export async function applyCentrisStatusToResidence(
  residenceId: string,
  standardStatus: string
): Promise<'updated' | 'skipped_off_market' | 'skipped_manual' | 'skipped_no_patch' | 'not_found'> {
  const db = getDb();
  const ref = db.collection(RESIDENCES).doc(residenceId);
  const snap = await ref.get();
  if (!snap.exists) return 'not_found';

  const data = snap.data() ?? {};
  if (shouldSkipCentrisListingSync(data)) return 'skipped_off_market';

  const patch = buildCentrisMlsStatusSyncPatch(data, standardStatus);
  if (!patch) {
    if (data.isManuallyOverridden === true) return 'skipped_manual';
    return 'skipped_no_patch';
  }

  await ref.set(
    {
      ...patch,
      centrisLastSyncAtMillis: Date.now(),
      updatedAt: new Date(),
    },
    { merge: true }
  );
  return 'updated';
}

/**
 * Réconciliation nocturne — parcourt le cache Centris et promeut le statut RESO.
 * Les inscriptions hors marché ne sont jamais évaluées.
 */
export async function reconcileCentrisListingStatuses(): Promise<CentrisSyncBatchResult> {
  const db = getDb();
  const result: CentrisSyncBatchResult = {
    scanned: 0,
    skippedOffMarket: 0,
    skippedManualOverride: 0,
    statusUpdated: 0,
    noResidenceLink: 0,
  };

  let snap;
  try {
    snap = await db
      .collection(LISTINGS_CACHE)
      .where('source', '==', 'centris_odata')
      .limit(200)
      .get();
  } catch {
    return result;
  }

  for (const docSnap of snap.docs) {
    result.scanned++;
    const cache = docSnap.data();
    const residenceId = String(cache.residenceId ?? cache.linkedResidenceId ?? '').trim();
    const standardStatus = String(
      cache.standardStatus ?? cache.resoStandardStatus ?? cache.canonicalPreview?.standardStatus ?? ''
    ).trim();

    if (!residenceId || !standardStatus) {
      result.noResidenceLink++;
      continue;
    }

    const outcome = await applyCentrisStatusToResidence(residenceId, standardStatus);
    if (outcome === 'updated') result.statusUpdated++;
    else if (outcome === 'skipped_off_market') result.skippedOffMarket++;
    else if (outcome === 'skipped_manual') result.skippedManualOverride++;
  }

  return result;
}
