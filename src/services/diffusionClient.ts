/**
 * Client Diffusion Web — appels Cloud Functions (publication / brouillon / retrait).
 * Secrets WordPress restent côté Functions uniquement.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';

const region = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';
const functions = getFunctions(app, region);

export type PublicListingStatusUi = 'VISIBLE' | 'MASQUE' | 'SUSPENDU' | 'ARCHIVE';

export interface DiffusionCallableBase {
  residenceId: string;
}

export interface PublishListingResult {
  ok: true;
  publicId: string;
  wpPostId: number;
  wpUrl: string;
  visibility: 'VISIBLE';
}

export interface SaveDraftListingResult {
  ok: true;
  publicId: string;
  wpPostId: number;
  wpUrl: string;
  draftToken: string;
  visibility: 'MASQUE';
}

export interface HideListingInput extends DiffusionCallableBase {
  mode?: 'MASQUE' | 'ARCHIVE';
}

export interface HideListingResult {
  ok: true;
  publicId: string;
  wpPostId: number;
  visibility: PublicListingStatusUi;
}

function extractCallableMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message);
  }
  return err instanceof Error ? err.message : String(err);
}

export async function publishListingViaCallable(
  residenceId: string
): Promise<PublishListingResult> {
  const fn = httpsCallable<DiffusionCallableBase, PublishListingResult>(
    functions,
    'diffusionPublishListing'
  );
  try {
    const { data } = await fn({ residenceId });
    if (!data?.ok) throw new Error('Publication refusée par le serveur.');
    return data;
  } catch (err) {
    throw new Error(extractCallableMessage(err));
  }
}

export async function saveDraftListingViaCallable(
  residenceId: string
): Promise<SaveDraftListingResult> {
  const fn = httpsCallable<DiffusionCallableBase, SaveDraftListingResult>(
    functions,
    'diffusionSaveDraftListing'
  );
  try {
    const { data } = await fn({ residenceId });
    if (!data?.ok) throw new Error('Sauvegarde brouillon refusée par le serveur.');
    return data;
  } catch (err) {
    throw new Error(extractCallableMessage(err));
  }
}

export async function hideListingViaCallable(
  residenceId: string,
  mode: 'MASQUE' | 'ARCHIVE' = 'MASQUE'
): Promise<HideListingResult> {
  const fn = httpsCallable<HideListingInput, HideListingResult>(
    functions,
    'diffusionHideListing'
  );
  try {
    const { data } = await fn({ residenceId, mode });
    if (!data?.ok) throw new Error('Retrait refusé par le serveur.');
    return data;
  } catch (err) {
    throw new Error(extractCallableMessage(err));
  }
}
