/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/telephony/
 * Régénéré : functions/scripts/sync-core-telephony.cjs (prebuild)
 */
/**
 * Téléphonie VOIP — champs canoniques sur `users/{uid}.telephony`.
 * Attribution par l'admin (pas de facturation intégrée en Phase 0–1).
 */

export interface UserTelephony {
  /** Numéro Twilio E.164 assigné par l'admin (obligatoire pour VOIP). */
  twilioNumber: string;
  /** Cellulaire de secours / callback PSTN (optionnel en Phase 1). */
  agentCellNumber?: string | null;
}

/** Objet utilisateur minimal pour les gardes (profil client ou doc Firestore). */
export interface UserTelephonySlice {
  telephony?: UserTelephony | null;
}

function normalizeE164ish(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

/**
 * Lit `telephony` depuis un document `users/{uid}` (ou profil hydraté).
 */
export function readTelephonyFromUserDoc(
  user: UserTelephonySlice | Record<string, unknown> | null | undefined
): UserTelephony | null {
  if (!user || typeof user !== 'object') return null;
  const raw = (user as UserTelephonySlice).telephony;
  if (!raw || typeof raw !== 'object') return null;

  const twilioNumber = normalizeE164ish((raw as UserTelephony).twilioNumber);
  if (!twilioNumber) return null;

  const agentCell = normalizeE164ish((raw as UserTelephony).agentCellNumber);
  return {
    twilioNumber,
    ...(agentCell ? { agentCellNumber: agentCell } : {}),
  };
}
