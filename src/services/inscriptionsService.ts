/**
 * Inscriptions CRM — mutations Firestore (collection canonique `residences`).
 */

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TENANT_FIELD, type TenantContext } from '@primexpert/core/tenant';
import {
  buildInscriptionBrokerageStatusPatch,
  type InscriptionBrokerageStatus,
} from '@primexpert/core/residence';
import {
  DEFAULT_LISTING_SOURCE,
  type ListingSource,
} from '@primexpert/core/residence';
import type { AssetNiche } from '../types/residence';
import { getResidenceById, type Residence } from './residences';

export type { ListingSource, InscriptionBrokerageStatus };

export interface CreateInscriptionInput {
  listingSource: ListingSource;
  address: string;
  city: string;
  price?: number;
  assetNiche?: AssetNiche;
  initialStatus?: InscriptionBrokerageStatus;
  residenceName?: string;
}

export interface CreateInscriptionResult {
  id: string;
  listingSource: ListingSource;
}

/** Crée une fiche inscription (résidence) avec source Centris ou hors marché. */
export async function createInscription(
  ctx: TenantContext,
  input: CreateInscriptionInput
): Promise<CreateInscriptionResult> {
  const address = input.address.trim();
  const city = input.city.trim();
  if (!address || !city) {
    throw new Error('Adresse et ville requises pour créer une inscription.');
  }

  const listingSource = input.listingSource ?? DEFAULT_LISTING_SOURCE;
  const price = Math.max(0, Math.round(input.price ?? 0));
  const statusPatch =
    listingSource === 'off_market' && input.initialStatus
      ? buildInscriptionBrokerageStatusPatch(input.initialStatus)
      : { status: 'prospect', statut: 'prospect' };

  const col = collection(db, 'residences');
  const docRef = await addDoc(col, {
    ...statusPatch,
    listingSource,
    address,
    city,
    ville: city,
    price,
    prixDemande: price,
    askingPrice: price,
    prixAnnonce: price,
    [TENANT_FIELD]: ctx.tenantId,
    assetNiche: input.assetNiche ?? 'RPA',
    residenceName: input.residenceName?.trim() || address,
    isManuallyOverridden: listingSource === 'off_market',
    lastManualStatusUpdateAt:
      listingSource === 'off_market' ? Date.now() : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: docRef.id, listingSource };
}

/** Met à jour le statut courtage — force le verrou manuel anti-sync MLS. */
export async function updateInscriptionStatus(
  ctx: TenantContext,
  inscriptionId: string,
  newStatus: InscriptionBrokerageStatus
): Promise<void> {
  if (!inscriptionId) throw new Error('Identifiant d\'inscription requis.');

  const existing = await getResidenceById(ctx, inscriptionId);
  if (!existing) throw new Error('Inscription introuvable ou accès refusé.');

  const statusPatch = buildInscriptionBrokerageStatusPatch(newStatus);
  const ref = doc(db, 'residences', inscriptionId);
  await updateDoc(ref, {
    ...statusPatch,
    isManuallyOverridden: true,
    lastManualStatusUpdateAt: Date.now(),
    updatedAt: serverTimestamp(),
  });
}

/** Active l'édition manuelle sur une fiche Centris synchronisée. */
export async function enableManualStatusOverride(
  ctx: TenantContext,
  inscriptionId: string
): Promise<void> {
  const existing = await getResidenceById(ctx, inscriptionId);
  if (!existing) throw new Error('Inscription introuvable ou accès refusé.');
  await updateDoc(doc(db, 'residences', inscriptionId), {
    isManuallyOverridden: true,
    lastManualStatusUpdateAt: Date.now(),
    updatedAt: serverTimestamp(),
  });
}

export function mapResidenceToInscriptionFields(residence: Residence): {
  listingSource: ListingSource;
  isManuallyOverridden: boolean;
  lastManualStatusUpdateAt?: number;
} {
  return {
    listingSource: residence.listingSource ?? DEFAULT_LISTING_SOURCE,
    isManuallyOverridden: residence.isManuallyOverridden === true,
    lastManualStatusUpdateAt: residence.lastManualStatusUpdateAt,
  };
}
