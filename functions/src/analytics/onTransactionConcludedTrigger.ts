/**
 * Trigger Firestore — Data Flywheel V3.5.
 * Intercepte les transactions conclues (PA acceptée / vendu) sur `residences`.
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { info as logInfo, error as logError } from 'firebase-functions/logger';

const VERTEX_RUNTIME_SA =
  process.env.VERTEX_RUNTIME_SA ||
  '250702494735-compute@developer.gserviceaccount.com';

export const onTransactionConcludedFlywheel = onDocumentUpdated(
  {
    document: 'residences/{residenceId}',
    memory: '512MiB',
    timeoutSeconds: 120,
    serviceAccount: VERTEX_RUNTIME_SA,
  },
  async (event) => {
    const residenceId = event.params.residenceId;
    const before = event.data?.before.data() as Record<string, unknown> | undefined;
    const after = event.data?.after.data() as Record<string, unknown> | undefined;
    if (!after) return;

    try {
      const { ingestInternalFlywheelTransaction } = await import('./flywheelIngestion');
      const result = await ingestInternalFlywheelTransaction(residenceId, before, after);
      if (result.ingested) {
        logInfo('[onTransactionConcludedFlywheel] ingested', {
          residenceId,
          analyticsDocId: result.analyticsDocId,
          transition: result.transition?.kind,
          snapshotUpdated: result.snapshotUpdated,
        });
        return;
      }
      if (result.skippedReason && result.skippedReason !== 'no_flywheel_transition') {
        logInfo('[onTransactionConcludedFlywheel] skipped', {
          residenceId,
          reason: result.skippedReason,
          transition: result.transition?.kind,
        });
      }
    } catch (e) {
      logError('[onTransactionConcludedFlywheel] failed', { residenceId, error: e });
    }
  }
);
