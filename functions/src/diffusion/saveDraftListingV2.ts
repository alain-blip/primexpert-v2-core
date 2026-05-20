/**
 * Orchestrateur — sauvegarde brouillon (WP status `draft`).
 *
 * Différences avec `publishListingHandler` :
 *   - WP status forcé à `draft` (jamais visible publiquement).
 *   - `publicListingStatus` Firestore → `MASQUE`.
 *   - Génère un `draftToken` cryptographique (24 octets hex) au premier brouillon.
 *     Le token est sauvegardé dans `residences/{id}.syndication.draftToken`
 *     pour permettre l'aperçu privé du vendeur via URL signée.
 *
 * Sécurité du `draftToken` :
 *   - Généré côté serveur (`crypto.randomBytes(24)`).
 *   - Non corrélable avec `publicId` (entropie indépendante).
 *   - Jamais inclus dans `public_listings/{publicId}` ni envoyé à WordPress.
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
  resolveDraftToken,
  resolvePublicId,
  updateResidenceSyndicationMetadata,
  writePublicListing,
} from './syndicationStore';

export interface SaveDraftListingInput {
  residenceId: string;
  brokerId: string;
}

export interface SaveDraftListingResult {
  ok: true;
  publicId: string;
  wpPostId: number;
  wpUrl: string;
  draftToken: string;
  visibility: typeof PUBLIC_LISTING_STATUS.MASQUE;
}

export async function saveDraftListingHandler(
  input: SaveDraftListingInput
): Promise<SaveDraftListingResult> {
  // Garde-fous OACIQ : volontairement absents — usage interne (brouillon).
  const residence = await readResidenceForPublication(input.residenceId);
  const publicId = resolvePublicId(residence.publicId);
  const draftToken = resolveDraftToken(residence.draftToken);

  const listing = buildPublicListing(residence.data, publicId, {
    visibility: PUBLIC_LISTING_STATUS.MASQUE,
  });

  const wpPayload = buildWordPressPayload(
    listing,
    'draft',
    residence.wpPostId ?? undefined
  );
  const wp = await upsertWordPressPost(wpPayload);

  const db = getDb();
  await writePublicListing(db, listing, input.residenceId);
  await updateResidenceSyndicationMetadata(db, input.residenceId, {
    publicListingId: publicId,
    publicListingStatus: PUBLIC_LISTING_STATUS.MASQUE,
    wpPostId: wp.wpPostId,
    wpUrl: wp.wpUrl,
    wpStatus: wp.wpStatus,
    draftToken,
    lastPublishedAt: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    publicId,
    wpPostId: wp.wpPostId,
    wpUrl: wp.wpUrl,
    draftToken,
    visibility: PUBLIC_LISTING_STATUS.MASQUE,
  };
}
