/**
 * Helpers Firestore — silo `public_listings` & métadonnées syndication.
 *
 * SEULS points d'écriture autorisés vers `public_listings/{publicId}` et
 * `listing_mappings/{publicId}`. Aucune logique métier ici — l'anonymisation
 * est déléguée à `@primexpert/core/diffusion`.
 *
 * Génération d'IDs cryptographiques :
 *  - `publicId`   : UUID v4 non-corrélable (Node crypto.randomUUID).
 *  - `draftToken` : 48 caractères hex (24 octets) pour l'aperçu privé vendeur.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  PUBLIC_LISTING_STATUS,
  type PublicListing,
  type PublicListingStatus,
  type ResidenceForPublicListing,
} from './_vendored';
import { getDb } from '../lib/firestore';

export const RESIDENCES_COL = 'residences';
export const PUBLIC_LISTINGS_COL = 'public_listings';
export const LISTING_MAPPINGS_COL = 'listing_mappings';

export interface ResidenceSnapshot {
  /** Données brutes Firestore — entrée structurelle pour le core. */
  readonly data: ResidenceForPublicListing & Record<string, unknown>;
  readonly publicId: string | null;
  readonly wpPostId: number | null;
  readonly draftToken: string | null;
}

function generatePublicId(): string {
  return randomUUID();
}

function generateDraftToken(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Lit la résidence Firestore et extrait les métadonnées de syndication.
 * Lance si la résidence n'existe pas.
 */
export async function readResidenceForPublication(
  residenceId: string
): Promise<ResidenceSnapshot> {
  const db = getDb();
  const snap = await db.collection(RESIDENCES_COL).doc(residenceId).get();
  if (!snap.exists) {
    throw new Error(`[syndicationStore] Résidence ${residenceId} introuvable.`);
  }
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const syndRaw =
    typeof data.syndication === 'object' && data.syndication !== null
      ? (data.syndication as Record<string, unknown>)
      : {};

  return {
    data: data as ResidenceForPublicListing & Record<string, unknown>,
    publicId:
      typeof syndRaw.publicListingId === 'string' && syndRaw.publicListingId
        ? syndRaw.publicListingId
        : null,
    wpPostId:
      typeof syndRaw.wpPostId === 'number' && Number.isFinite(syndRaw.wpPostId)
        ? syndRaw.wpPostId
        : null,
    draftToken:
      typeof syndRaw.draftToken === 'string' && syndRaw.draftToken
        ? syndRaw.draftToken
        : null,
  };
}

export function resolvePublicId(existing: string | null): string {
  return existing ?? generatePublicId();
}

export function resolveDraftToken(existing: string | null): string {
  return existing ?? generateDraftToken();
}

/**
 * Upsert idempotent du document anonymisé dans `public_listings/{publicId}`
 * et du mapping `listing_mappings/{publicId}` (traçabilité publicId ⇄ residenceId).
 *
 * Atomique : `WriteBatch` Firestore — soit les deux passent, soit aucun.
 */
export async function writePublicListing(
  db: Firestore,
  listing: PublicListing,
  residenceId: string
): Promise<void> {
  const publicRef = db.collection(PUBLIC_LISTINGS_COL).doc(listing.publicId);
  const mappingRef = db.collection(LISTING_MAPPINGS_COL).doc(listing.publicId);
  const batch = db.batch();
  batch.set(publicRef, {
    ...listing,
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(
    mappingRef,
    {
      publicId: listing.publicId,
      residenceId,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();
}

export interface SyndicationMetadataPatch {
  publicListingId: string;
  publicListingStatus: PublicListingStatus;
  wpPostId?: number;
  wpUrl?: string;
  wpStatus?: string;
  draftToken?: string;
  lastPublishedAt?: FieldValue;
  lastHiddenAt?: FieldValue;
}

/**
 * Patch fusionné des métadonnées de syndication sur `residences/{id}`.
 *
 * NB : on ne touche QUE le sous-objet `syndication` — aucun risque d'écraser
 * d'autres champs canoniques de la fiche résidence (charte Zone Rouge §V).
 */
export async function updateResidenceSyndicationMetadata(
  db: Firestore,
  residenceId: string,
  patch: SyndicationMetadataPatch
): Promise<void> {
  await db
    .collection(RESIDENCES_COL)
    .doc(residenceId)
    .set({ syndication: { ...patch } }, { merge: true });
}

/**
 * Met à jour uniquement le statut de visibilité du document `public_listings`.
 * Utilisé par `hideListingHandler` pour retirer / archiver sans toucher au contenu.
 */
export async function updatePublicListingVisibility(
  db: Firestore,
  publicId: string,
  visibility: PublicListingStatus
): Promise<void> {
  await db
    .collection(PUBLIC_LISTINGS_COL)
    .doc(publicId)
    .set(
      {
        visibility,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

export { PUBLIC_LISTING_STATUS };
