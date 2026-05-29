/**
 * Conformité photo de profil courtier — normes publicitaires OACIQ (> 5 ans interdit).
 *
 * Champs persistés sur `users/{uid}` ; `isProfilePhotoExpired` est dérivé côté core.
 */

/** Durée maximale d'utilisation d'une photo de profil en publicité (5 ans). */
export const BROKER_PROFILE_PHOTO_MAX_AGE_DAYS = 1826;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Sous-ensemble des champs profil courtier liés à la validité chronologique de la photo. */
export interface BrokerProfilePhotoComplianceFields {
  profilePhotoUploadedAtMillis: number;
  /**
   * Dérivé — true si l'âge de la photo dépasse 1826 jours.
   * Ne pas persister sans recalcul via `deriveBrokerProfilePhotoCompliance`.
   */
  isProfilePhotoExpired: boolean;
}

/** Calcule si la photo de profil est expirée aux fins de conformité publicitaire. */
export function isBrokerProfilePhotoExpired(
  profilePhotoUploadedAtMillis: number,
  referenceNowMillis: number = Date.now()
): boolean {
  if (!Number.isFinite(profilePhotoUploadedAtMillis) || profilePhotoUploadedAtMillis <= 0) {
    return true;
  }
  const ageMillis = referenceNowMillis - profilePhotoUploadedAtMillis;
  return ageMillis > BROKER_PROFILE_PHOTO_MAX_AGE_DAYS * MS_PER_DAY;
}

/** Construit les champs de conformité photo (upload + indicateur dérivé). */
export function deriveBrokerProfilePhotoCompliance(
  profilePhotoUploadedAtMillis: number,
  referenceNowMillis: number = Date.now()
): BrokerProfilePhotoComplianceFields {
  return {
    profilePhotoUploadedAtMillis,
    isProfilePhotoExpired: isBrokerProfilePhotoExpired(
      profilePhotoUploadedAtMillis,
      referenceNowMillis
    ),
  };
}

/** Valide le bloc photo profil avant diffusion publicitaire automatisée. */
export function validateBrokerProfilePhotoForPublication(
  fields: BrokerProfilePhotoComplianceFields | null | undefined
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
