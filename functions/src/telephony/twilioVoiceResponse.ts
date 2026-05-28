import { onRequest } from 'firebase-functions/v2/https';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { readTelephonyFromUserDoc } from './_vendored/types';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatE164(to: string): string {
  if (to.startsWith('+')) return to;
  const digits = to.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return to;
}

/**
 * TwiML sortant — Voice SDK `device.connect({ params: { To, brokerId, … } })`.
 * Caller ID = `users/{brokerId}.telephony.twilioNumber` (sinon secret env).
 */
export const twilioVoiceResponse = onRequest(
  {
    region: 'us-central1',
    memory: '256MiB',
    maxInstances: 10,
    cors: true,
    secrets: ['TWILIO_VOICE_FROM', 'TWILIO_PHONE_NUMBER'],
  },
  async (req: Request, res: Response) => {
    const params =
      req.method === 'POST'
        ? { ...req.query, ...(req.body as Record<string, string>) }
        : req.query;
    const to = String(params.To ?? '').trim();
    const brokerId = String(params.brokerId ?? '').trim();

    if (!to) {
      res
        .status(400)
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="fr-CA">Numéro de destination manquant</Say></Response>'
        );
      return;
    }

    let callerId =
      process.env.TWILIO_VOICE_FROM?.trim() ||
      process.env.TWILIO_PHONE_NUMBER?.trim() ||
      '';

    if (brokerId) {
      try {
        const { getDb } = await import('../lib/firestore');
        const snap = await getDb().collection('users').doc(brokerId).get();
        const telephony = readTelephonyFromUserDoc(snap.data());
        if (telephony?.twilioNumber) callerId = telephony.twilioNumber;
      } catch (e) {
        console.warn('[twilioVoiceResponse] lecture telephony', e);
      }
    }

    if (!callerId) {
      res
        .status(500)
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="fr-CA">Numéro sortant non configuré</Say></Response>'
        );
      return;
    }

    const formattedNumber = formatE164(to);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-CA">Connexion en cours</Say>
  <Dial callerId="${escapeXml(callerId)}">
    <Number>${escapeXml(formattedNumber)}</Number>
  </Dial>
</Response>`;

    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  }
);
