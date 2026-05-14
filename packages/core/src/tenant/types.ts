/**
 * Multi-tenant — Types
 *
 * Brief « SYSTÈME SILOS 2026 v4 » §1 + §4 (Drive multi-tenant).
 * Charte v2026.2 §IV — Source de Vérité Pipeline.
 */

/**
 * Identifiant tenant. En V2 SaaS, c'est l'UID Firebase Auth du courtier
 * (`auth.currentUser.uid`).
 */
export type TenantId = string;

/**
 * Champ canonique IMPUTABILITÉ — Le courtier OACIQ-responsable du dossier.
 *
 * Source : `dbSchema.js` (V1) — TRANSACTION_FIELDS.courtiersResponsables
 *   { type: 'string', aliases: ['courtierResponsable'] }
 *
 * RÈGLE : UN SEUL courtier (string), pas une liste. C'est lui qui signe,
 * lui qui est responsable juridiquement OACIQ §IV.
 *
 * IMPORTANT : ne JAMAIS renommer ce champ (Charte §V Zone Rouge).
 */
export const TENANT_FIELD = 'courtiersResponsables' as const;

/**
 * Champ canonique VISIBILITÉ — L'organisation propriétaire (Phase D-4 hybride).
 *
 * Brief « SYSTÈME SILOS 2026 v4 » D-4 :
 *   - Solo (MVP)  : organizationId == brokerId (auto-organisation à 1)
 *   - Agence (Phase E) : organizationId pointe vers organizations/{orgId}
 *                        avec une liste `members: [uid1, uid2, ...]`.
 *
 * Stratégie hybride préparée :
 *   - On INJECTE ce champ dans toutes les écritures dès maintenant.
 *   - On NE FILTRE PAS encore là-dessus (les rules restent sur TENANT_FIELD).
 *   - Le jour où une agence signe : on bascule les rules en 2 jours,
 *     sans toucher au sanctuaire V1 ni à la conformité OACIQ.
 */
export const ORG_FIELD = 'organizationId' as const;

/**
 * Mode tenant.
 * - `strict`  : query renvoie SEULEMENT les docs où le champ tenant == tenantId
 * - `admin`   : query renvoie tout (utilisateur admin global, pour migrations)
 */
export type TenantMode = 'strict' | 'admin';

/**
 * Contexte tenant à propager dans toutes les couches métier.
 *
 * Phase B (Silos 2026) : tenantId + mode.
 * Phase D-4 (hybride)  : ajout de organizationId (optionnel pour rétrocompat).
 *                        Si absent au runtime, fallback = tenantId (solo).
 */
export interface TenantContext {
  /** L'UID du courtier OACIQ-responsable (== auth.currentUser.uid) */
  tenantId: TenantId;
  /** L'ID de l'organisation (agence). Fallback = tenantId pour solo. */
  organizationId?: TenantId;
  mode: TenantMode;
  /** Optionnel — pour audit log */
  source?: 'auth' | 'admin-override' | 'system';
}
