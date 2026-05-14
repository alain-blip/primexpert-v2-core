/**
 * withTenantFilter — Multi-tenant query helper (Firestore)
 *
 * Brief « SYSTÈME SILOS 2026 v4 » §5 — multi-tenant via `courtiersResponsables`.
 * Charte v2026.2 §IV — Source de vérité pipeline.
 *
 * Pourquoi ce helper :
 *   En V1 (Silo A) Alain est seul, donc pas de filtrage tenant.
 *   En V2 (Silo B) chaque courtier voit SES résidences. Toutes les queries
 *   doivent passer par ce helper pour garantir l'isolation.
 *
 * IMPORTANT :
 *   - Ce filtre doit être DOUBLÉ par des Firestore Security Rules côté serveur.
 *     Sans Security Rules, le filtre client est contournable.
 *   - Le champ canonique `courtiersResponsables` est défini dans dbSchema.js
 *     (V1) et NE JAMAIS être renommé (Charte §V Zone Rouge).
 */

import { TENANT_FIELD, ORG_FIELD, type TenantContext } from './types';

/**
 * Résout l'organizationId effectif depuis un contexte tenant.
 * Fallback : si non fourni, retourne tenantId (solo = auto-org à 1).
 */
export function resolveOrganizationId(ctx: TenantContext): string {
  return ctx.organizationId ?? ctx.tenantId;
}

/**
 * Type minimal pour interopérer avec Firestore sans dépendre du SDK ici.
 * (Le SDK Firebase est branché côté `packages/web`, pas dans le core.)
 */
export interface QueryConstraint {
  type: 'where';
  field: string;
  op: '==' | 'in' | 'array-contains';
  value: unknown;
}

/**
 * Renvoie la liste des contraintes à ajouter à une query Firestore pour
 * filtrer par tenant.
 *
 * @example
 * import { query, where, collection } from 'firebase/firestore';
 * import { tenantConstraints } from '@primexpert/core/tenant';
 *
 * const constraints = tenantConstraints({ tenantId: user.uid, mode: 'strict' });
 * const q = query(
 *   collection(db, 'residences'),
 *   ...constraints.map(c => where(c.field, c.op, c.value))
 * );
 */
export function tenantConstraints(ctx: TenantContext): QueryConstraint[] {
  if (ctx.mode === 'admin') {
    return [];
  }

  if (!ctx.tenantId) {
    throw new Error(
      '[withTenantFilter] tenantId requis en mode strict. ' +
      'Vérifier que auth.currentUser est chargé avant la query.'
    );
  }

  return [
    { type: 'where', field: TENANT_FIELD, op: '==', value: ctx.tenantId },
  ];
}

/**
 * Vérifie qu'un document appartient bien au tenant courant.
 * À utiliser en complément des Security Rules pour les écritures.
 */
export function assertTenantOwnership<T extends Record<string, unknown>>(
  doc: T,
  ctx: TenantContext
): T {
  if (ctx.mode === 'admin') {
    return doc;
  }

  const owner = doc[TENANT_FIELD];

  if (owner !== ctx.tenantId) {
    throw new Error(
      `[withTenantFilter] Tenant mismatch: doc.${TENANT_FIELD}="${String(owner)}" ` +
      `vs ctx.tenantId="${ctx.tenantId}"`
    );
  }

  return doc;
}

/**
 * Estampille un document à écrire avec le tenant courant + l'organisation
 * (Phase D-4 hybride préparé).
 *
 * Champs injectés :
 *   - courtiersResponsables : UN seul courtier OACIQ-responsable (== tenantId)
 *   - organizationId        : visibilité agence (== tenantId pour solo)
 *
 * À utiliser AVANT addDoc / setDoc en V2.
 */
export function stampTenant<T extends Record<string, unknown>>(
  doc: T,
  ctx: TenantContext
): T & { [TENANT_FIELD]: string; [ORG_FIELD]: string } {
  return {
    ...doc,
    [TENANT_FIELD]: ctx.tenantId,
    [ORG_FIELD]: resolveOrganizationId(ctx),
  };
}
