/**
 * Orchestrateur — retrait du web (WP status `draft` ou `private`).
 *
 *   - `mode = MASQUE`   → WP `draft`    (retirable, modifiable, re-publiable)
 *   - `mode = ARCHIVE`  → WP `private`  (définitif : vendu / abandonné)
 *
 * NB : on n'envoie QUE le statut (`updateWordPressPostStatus`) — titre, contenu
 * et meta WP sont préservés. La fiche peut donc être réactivée plus tard sans
 * perte de données côté WordPress.
 *
 * Préconditions :
 *   - `residences/{id}.syndication.publicListingId` doit exister.
 *   - `residences/{id}.syndication.wpPostId` doit être un nombre > 0.
 *   Sinon : Error (le caller transformera en `HttpsError failed-precondition`).
 */

import { FieldValue } from 'firebase-admin/firestore';
import {
  PUBLIC_LISTING_STATUS,
  type PublicListingStatus,
} from './_vendored';
import { getDb } from '../lib/firestore';
import { updateWordPressPostStatus } from './wordPressClient';
import {
  readResidenceForPublication,
  updatePublicListingVisibility,
  updateResidenceSyndicationMetadata,
} from './syndicationStore';

export type HideListingMode =
  | typeof PUBLIC_LISTING_STATUS.MASQUE
  | typeof PUBLIC_LISTING_STATUS.ARCHIVE;

export interface HideListingInput {
  residenceId: string;
  brokerId: string;
  /** Défaut `MASQUE`. `ARCHIVE` est réservé aux fiches définitivement retirées. */
  mode?: HideListingMode;
}

export interface HideListingResult {
  ok: true;
  publicId: string;
  wpPostId: number;
  visibility: PublicListingStatus;
}

export async function hideListingHandler(
  input: HideListingInput
): Promise<HideListingResult> {
  // Garde-fous OACIQ : volontairement absents — retrait toujours autorisé.
  const residence = await readResidenceForPublication(input.residenceId);
  if (!residence.publicId) {
    throw new Error(
      '[hideListing] Résidence non publiée — aucun publicListingId en métadonnées.'
    );
  }
  if (!residence.wpPostId) {
    throw new Error(
      '[hideListing] Aucun wpPostId associé à la résidence — rien à retirer.'
    );
  }

  const mode: HideListingMode = input.mode ?? PUBLIC_LISTING_STATUS.MASQUE;
  const wpStatus =
    mode === PUBLIC_LISTING_STATUS.ARCHIVE ? 'private' : 'draft';

  const wp = await updateWordPressPostStatus({
    wpPostId: residence.wpPostId,
    status: wpStatus,
  });

  const db = getDb();
  await updatePublicListingVisibility(db, residence.publicId, mode);
  await updateResidenceSyndicationMetadata(db, input.residenceId, {
    publicListingId: residence.publicId,
    publicListingStatus: mode,
    wpPostId: residence.wpPostId,
    wpStatus: wp.wpStatus,
    lastHiddenAt: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    publicId: residence.publicId,
    wpPostId: residence.wpPostId,
    visibility: mode,
  };
}
