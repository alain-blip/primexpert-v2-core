/**
 * Cloud Function — synchronisation nocturne Centris / MLS.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { reconcileCentrisListingStatuses } from './syncCentrisListingsNightly';

/** 02:30 America/Toronto — réconciliation statuts RESO (ignore Off-Market). */
export const centrisListingsSyncNightly = onSchedule(
  {
    schedule: '30 2 * * *',
    timeZone: 'America/Toronto',
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const result = await reconcileCentrisListingStatuses();
    console.info('[centrisListingsSyncNightly] done', result);
  }
);
