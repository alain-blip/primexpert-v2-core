/**
 * Ingestion serveur — Data Flywheel V3.5 vers Big Data provincial.
 */

import { getDb } from '../lib/firestore';
import { refreshRegionalMarketSnapshotForFlywheel } from '../documents/injectMarketMacroStats';
import {
  buildAnonymizedFlywheelAnalyticsDoc,
  buildFlywheelSnapshotRow,
  detectFlywheelStatusTransition,
  type FlywheelPipelineColumn,
} from './_vendored/internalMarketFlywheel';

const MARKET_ANALYTICS_RAW = 'market_analytics_raw';

export interface FlywheelIngestionResult {
  ingested: boolean;
  skippedReason?: string;
  analyticsDocId?: string;
  snapshotUpdated: boolean;
  transition?: FlywheelPipelineColumn;
}

export async function ingestInternalFlywheelTransaction(
  residenceId: string,
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>
): Promise<FlywheelIngestionResult> {
  const transition = detectFlywheelStatusTransition(before, after);
  if (!transition) {
    return { ingested: false, skippedReason: 'no_flywheel_transition', snapshotUpdated: false };
  }

  const ingestionState = (after.internalFlywheelIngestion ?? {}) as Record<string, unknown>;
  const markerKey = transition.kind === 'promise' ? 'promiseAtMillis' : 'soldAtMillis';
  if (typeof ingestionState[markerKey] === 'number' && ingestionState[markerKey] > 0) {
    return {
      ingested: false,
      skippedReason: 'already_ingested',
      snapshotUpdated: false,
      transition,
    };
  }

  const db = getDb();
  const financialSnap = await db.doc(`residences/${residenceId}/financial/dataV2`).get();
  const financialData = financialSnap.exists
    ? ((financialSnap.data() ?? {}) as Record<string, unknown>)
    : null;

  const closedAtMillis = Date.now();
  const analyticsDoc = buildAnonymizedFlywheelAnalyticsDoc({
    residenceData: after,
    financialData,
    transition,
    closedAtMillis,
  });

  if (!analyticsDoc) {
    return {
      ingested: false,
      skippedReason: 'insufficient_anonymized_payload',
      snapshotUpdated: false,
      transition,
    };
  }

  const analyticsRef = db.collection(MARKET_ANALYTICS_RAW).doc(analyticsDoc.dedupeFingerprint);
  const existing = await analyticsRef.get();
  if (!existing.exists) {
    await analyticsRef.set(analyticsDoc, { merge: false });
  }

  const snapshotRow = buildFlywheelSnapshotRow(analyticsDoc);
  const snapshotUpdated = await refreshRegionalMarketSnapshotForFlywheel(snapshotRow);

  await db.collection('residences').doc(residenceId).set(
    {
      internalFlywheelIngestion: {
        ...ingestionState,
        [markerKey]: closedAtMillis,
        lastAnalyticsDocId: analyticsDoc.dedupeFingerprint,
        lastTransitionKind: transition.kind,
        updatedAtMillis: closedAtMillis,
      },
    },
    { merge: true }
  );

  return {
    ingested: true,
    analyticsDocId: analyticsDoc.dedupeFingerprint,
    snapshotUpdated,
    transition,
  };
}
