/**
 * Conformité photo de profil courtier — normes publicitaires OACIQ (> 5 ans interdit).
 *
 * Champs persistés sur `users/{uid}` ; `isProfilePhotoExpired` est dérivé côté core.
 */

/** Durée maximale d'utilisation d'une photo de profil en publicité (5 ans au Québec). */
export const PHOTO_VALIDITY_MAX_DAYS = 1826;

/** Alias historique — préférer `PHOTO_VALIDITY_MAX_DAYS`. */
export const BROKER_PROFILE_PHOTO_MAX_AGE_DAYS = PHOTO_VALIDITY_MAX_DAYS;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface BrokerPhotoComplianceResult {
  profilePhotoUploadedAtMillis: number;
  isProfilePhotoExpired: boolean;
  daysRemaining: number;
}

/** @deprecated Préférer `BrokerPhotoComplianceResult`. */
export type BrokerProfilePhotoComplianceFields = BrokerPhotoComplianceResult;

export function deriveBrokerProfilePhotoCompliance(
  uploadedAtMillis: number,
  nowMillis: number = Date.now()
): BrokerPhotoComplianceResult {
  if (!uploadedAtMillis || uploadedAtMillis <= 0) {
    return { profilePhotoUploadedAtMillis: 0, isProfilePhotoExpired: true, daysRemaining: 0 };
  }
  const msElapsed = nowMillis - uploadedAtMillis;
  const daysElapsed = msElapsed / MS_PER_DAY;
  const daysRemaining = Math.max(0, Math.floor(PHOTO_VALIDITY_MAX_DAYS - daysElapsed));
  return {
    profilePhotoUploadedAtMillis: uploadedAtMillis,
    isProfilePhotoExpired: daysElapsed >= PHOTO_VALIDITY_MAX_DAYS,
    daysRemaining,
  };
}

/** Calcule si la photo de profil est expirée aux fins de conformité publicitaire. */
export function isBrokerProfilePhotoExpired(
  profilePhotoUploadedAtMillis: number,
  referenceNowMillis: number = Date.now()
): boolean {
  return deriveBrokerProfilePhotoCompliance(
    profilePhotoUploadedAtMillis,
    referenceNowMillis
  ).isProfilePhotoExpired;
}

/** Valide le bloc photo profil avant diffusion publicitaire automatisée. */
export function validateBrokerProfilePhotoForPublication(
  fields: BrokerPhotoComplianceResult | null | undefined
): { ok: true } | { ok: false; issues: string[] } {
  if (!fields) {
    return { ok: false, issues: ['profilePhotoUploadedAtMillis absent'] };
  }
  const issues: string[] = [];
  if (
    !Number.isFinite(fields.profilePhotoUploadedAtMillis) ||
    fields.profilePhotoUploadedAtMillis <= 0
  ) {
    issues.push('profilePhotoUploadedAtMillis invalide');
  }
  if (fields.isProfilePhotoExpired) {
    issues.push('photo de profil expirée (> 5 ans) — utilisation publicitaire interdite');
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
