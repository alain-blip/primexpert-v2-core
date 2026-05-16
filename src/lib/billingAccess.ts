import type { BillingStatus } from '../types/billing';

/** Durée de grâce après échec de paiement (J45 ou renouvellement). */
export const GRACE_PERIOD_MS = 72 * 60 * 60 * 1000;

export interface BillingProfileSlice {
  role?: 'admin' | 'admin_system' | 'member';
  billingStatus?: BillingStatus;
  /** ISO 8601 — début des 72 h (écrit par webhook Stripe / Cloud Function). */
  gracePeriodStartedAt?: string;
}

/** Direction : jamais bloquée par le Chérif (gestion des comptes). */
export function isBillingExempt(profile: BillingProfileSlice | null | undefined): boolean {
  return profile?.role === 'admin_system';
}

export function resolveBillingStatus(profile: BillingProfileSlice | null | undefined): BillingStatus {
  if (!profile?.billingStatus) return 'active';
  return profile.billingStatus;
}

/**
 * Statut effectif côté client : si `grace_period` et 72 h dépassées,
 * traite comme `suspended` jusqu'à mise à jour Firestore par le backend.
 */
export function resolveEffectiveBillingStatus(
  profile: BillingProfileSlice | null | undefined
): BillingStatus {
  const raw = resolveBillingStatus(profile);
  if (raw !== 'grace_period') return raw;
  if (!profile?.gracePeriodStartedAt) return 'grace_period';
  const started = new Date(profile.gracePeriodStartedAt).getTime();
  if (Number.isNaN(started)) return 'grace_period';
  if (Date.now() - started >= GRACE_PERIOD_MS) return 'suspended';
  return 'grace_period';
}

export function isAccountSuspended(profile: BillingProfileSlice | null | undefined): boolean {
  if (isBillingExempt(profile)) return false;
  return resolveEffectiveBillingStatus(profile) === 'suspended';
}

export function isGracePeriod(profile: BillingProfileSlice | null | undefined): boolean {
  if (isBillingExempt(profile)) return false;
  return resolveEffectiveBillingStatus(profile) === 'grace_period';
}
