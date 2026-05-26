import type { TenantContext } from '@primexpert/core/tenant';
import type { UserProfile } from './auth';

/** Direction ou admin agence — vue globale résidences (god mode). */
export function isAgencyAdminRole(
  role: UserProfile['role'] | string | undefined
): boolean {
  return role === 'admin' || role === 'admin_system';
}

/**
 * Contexte tenant pour requêtes `residences` — strict courtier ou admin sans filtre UID.
 */
export function buildResidenceTenantContext(
  profile: Pick<UserProfile, 'uid' | 'role' | 'orgId'>
): TenantContext {
  const admin = isAgencyAdminRole(profile.role);
  return {
    tenantId: profile.uid,
    organizationId: profile.orgId,
    mode: admin ? 'admin' : 'strict',
    source: admin ? 'admin-override' : 'auth',
  };
}
