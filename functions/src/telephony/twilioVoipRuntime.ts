/**
 * Secrets VOIP — liaison explicite Gen2 (`defineSecret`) pour forcer
 * l’association aux dernières versions Secret Manager à chaque déploiement.
 */
import { defineSecret } from 'firebase-functions/params';

export const twilioSid = defineSecret('TWILIO_SID');
export const twilioApiKey = defineSecret('TWILIO_API_KEY');
export const twilioApiSecret = defineSecret('TWILIO_API_SECRET');
export const twilioTwimlAppSid = defineSecret('TWILIO_TWIML_APP_SID');

/** Ordre stable — réexporté dans `functions/src/index.ts` (commentaire SSOT). */
export const TWILIO_VOIP_SECRETS = [
  twilioApiKey,
  twilioApiSecret,
  twilioTwimlAppSid,
  twilioSid,
] as const;
