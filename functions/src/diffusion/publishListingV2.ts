/**
 * Orchestrateur — publication officielle (WP status `publish`).
 *
 * Séquence ACID :
 *   1. Lire `residences/{residenceId}`.
 *   2. Anonymiser via `buildPublicListing()` du core.
 *   3. POST/PUT WordPress (publish) — APPEL EXTERNE EN PREMIER.
 *   4. Si WP réussit ⇒ écrire `public_listings/{publicId}` + maj syndication.
 *   5. Si WP échoue ⇒ exception remontée — Firestore reste intact.
 *
 * Pattern de compensation : WP avant Firestore. Idempotence garantie par
 * `wpPostId` (PUT en cas de retry, jamais de doublon WP).
 */

import { FieldValue } from 'firebase-admin/firestore';
import {
  PUBLIC_LISTING_STATUS,
  buildPublicListing,
} from './_vendored';
import { getDb } from '../lib/firestore';
import { buildWordPressPayload } from './buildWordPressPayload';
import { upsertWordPressPost } from './wordPressClient';
import {
  readResidenceForPublication,
  resolvePublicId,
  updatePublicListingVisibility,
  updateResidenceSyndicationMetadata,
  writePublicListing,
} from './syndicationStore';

export interface PublishListingInput {
  residenceId: string;
  brokerId: string;
}

export interface PublishListingResult {
  ok: true;
  publicId: string;
  wpPostId: number;
  wpUrl: string;
  visibility: typeof PUBLIC_LISTING_STATUS.VISIBLE;
}

export async function publishListingHandler(
  input: PublishListingInput
): Promise<PublishListingResult> {
  // TODO: Inject Guardrails — Sprint Jour 4 (28 points Due Diligence)
  const residence = await readResidenceForPublication(input.residenceId);
  const publicId = resolvePublicId(residence.publicId);

  const listing = buildPublicListing(residence.data, publicId, {
    visibility: PUBLIC_LISTING_STATUS.VISIBLE,
  });

  const wpPayload = buildWordPressPayload(
    listing,
    'publish',
    residence.wpPostId ?? undefined
  );
  const wp = await upsertWordPressPost(wpPayload);

  const db = getDb();
  await writePublicListing(db, listing, input.residenceId);
  await updateResidenceSyndicationMetadata(db, input.residenceId, {
    publicListingId: publicId,
    publicListingStatus: PUBLIC_LISTING_STATUS.VISIBLE,
    wpPostId: wp.wpPostId,
    wpUrl: wp.wpUrl,
    wpStatus: wp.wpStatus,
    lastPublishedAt: FieldValue.serverTimestamp(),
  });

  if (residence.publicId === publicId) {
    await updatePublicListingVisibility(
      db,
      publicId,
      PUBLIC_LISTING_STATUS.VISIBLE
    );
  }

  return {
    ok: true,
    publicId,
    wpPostId: wp.wpPostId,
    wpUrl: wp.wpUrl,
    visibility: PUBLIC_LISTING_STATUS.VISIBLE,
  };
}
