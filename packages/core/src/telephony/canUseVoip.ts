import { readTelephonyFromUserDoc, type UserTelephonySlice } from './types';

/**
 * TRUE uniquement si l'admin a assigné un `telephony.twilioNumber` au courtier.
 */
export function canUseVoip(
  user: UserTelephonySlice | Record<string, unknown> | null | undefined
): boolean {
  const telephony = readTelephonyFromUserDoc(user);
  return Boolean(telephony?.twilioNumber);
}
