/**
 * residences.ts — Service multi-tenant pour la collection `residences`
 *
 * Brief « SYSTÈME SILOS 2026 v4 » §5 — preuve de vie multi-tenant
 * Charte v2026.2 §IV — Source de Vérité Pipeline
 *
 * Toute query sur `residences` PASSE par ce service.
 * Garantie : un courtier ne voit JAMAIS les résidences d'un autre courtier.
 *
 * Le filtrage client (via @primexpert/core/tenant) est DOUBLÉ par les
 * Firestore Security Rules côté serveur (à mettre en place en Phase C).
 */

import { collection, query, where, getDocs, type DocumentData, type QuerySnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { tenantConstraints, TENANT_FIELD, type TenantContext } from '@primexpert/core/tenant';

/**
 * Statut canonique pipeline (Charte §V Zone Rouge — ne JAMAIS renommer).
 */
export type ResidenceStatus =
  | 'prospect'
  | 'mandate'
  | 'promise'
  | 'expired'
  | 'unsigned'
  | 'sold';

/**
 * Forme minimale d'une résidence côté UI V2.
 * Reflet partiel de Copilote-RPA `dbSchema.js` TRANSACTION_FIELDS.
 */
export interface Residence {
  id: string;
  address: string;
  city: string;
  price: number;
  status: ResidenceStatus;
  date: string;
  /** Multi-tenant : doit toujours contenir le brokerId du propriétaire de la fiche. */
  courtiersResponsables?: string;
}

/**
 * Récupère les résidences du tenant courant.
 *
 * @param ctx contexte tenant — `{ tenantId: profile.uid, mode: 'strict' }`
 * @returns liste filtrée par `courtiersResponsables == ctx.tenantId`
 */
export async function listResidences(ctx: TenantContext): Promise<Residence[]> {
  const constraints = tenantConstraints(ctx);

  const baseRef = collection(db, 'residences');
  const q = constraints.length === 0
    ? query(baseRef)
    : query(baseRef, ...constraints.map((c) => where(c.field, c.op, c.value)));

  let snapshot: QuerySnapshot<DocumentData>;
  try {
    snapshot = await getDocs(q);
  } catch (error) {
    console.error('[residences.listResidences] Firestore query failed:', error);
    return [];
  }

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      address: String(data.address ?? data.adresse ?? '—'),
      city: String(data.city ?? data.ville ?? '—'),
      price: Number(data.price ?? data.prixAnnonce ?? data.askingPrice ?? 0),
      status: (data.status ?? data.pipelineStatus ?? 'prospect') as ResidenceStatus,
      date: String(data.date ?? data.updatedAt ?? ''),
      courtiersResponsables: data[TENANT_FIELD],
    } satisfies Residence;
  });
}
