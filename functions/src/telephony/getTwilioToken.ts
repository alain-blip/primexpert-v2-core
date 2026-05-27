import { onRequest } from 'firebase-functions/v2/https';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { canUseVoip } from './_vendored/canUseVoip';
import {
  diagnoseTwilioVoiceJwtSecrets,
  type TwilioVoiceJwtSecrets,
} from './twilioSecrets';
import { TWILIO_VOIP_SECRETS, twilioTwimlAppSid, twilioApiKey, twilioApiSecret, twilioSid } from './twilioVoipRuntime';

const VOIP_CORS_ORIGINS = [
  'https://primexpert-app-v2.web.app',
  'https://primexpert-app-v2.firebaseapp.com',
  'https://primexpert.app',
  'https://www.primexpert.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

async function verifyBearerUid(req: Request): Promise<string> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHENTICATED');
  }
  const idToken = authHeader.slice('Bearer '.length);
  const decoded = await getAuth().verifyIdToken(idToken);
  return decoded.uid;
}

/** Lit les secrets via `defineSecret` (dernière version liée au déploiement). */
function readTwilioSecretsFromRuntime(): TwilioVoiceJwtSecrets {
  const accountSid = twilioSid.value().trim();
  const apiKey = twilioApiKey.value().trim();
  const apiSecret = twilioApiSecret.value().trim();
  const twimlAppSid = twilioTwimlAppSid.value().trim();
  return {
    accountSid,
    apiKey,
    apiSecret,
    twimlAppSid,
    accountSidSource: 'TWILIO_SID',
  };
}

/**
 * GET /getTwilioToken — JWT Voice SDK (navigateur).
 * Refus 403 si `users/{uid}.telephony.twilioNumber` absent (garde admin).
 */
export const getTwilioToken = onRequest(
  {
    region: 'us-central1',
    memory: '256MiB',
    maxInstances: 10,
    cors: VOIP_CORS_ORIGINS,
    secrets: [...TWILIO_VOIP_SECRETS],
  },
  async (req, res: Response) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({ error: 'Méthode non autorisée' });
      return;
    }

    try {
      const { getDb } = await import('../lib/firestore');
      getDb();
      const userId = await verifyBearerUid(req);
      const userSnap = await getDb().collection('users').doc(userId).get();
      const userData = userSnap.exists ? userSnap.data() : null;

      if (!canUseVoip(userData)) {
        res.status(403).json({
          error:
            'Téléphonie non activée : un numéro doit être assigné par l’administrateur (telephony.twilioNumber).',
          code: 'VOIP_NOT_PROVISIONED',
        });
        return;
      }

      let twilioSecrets: TwilioVoiceJwtSecrets | null = null;
      try {
        twilioSecrets = readTwilioSecretsFromRuntime();
        if (
          !twilioSecrets.accountSid ||
          !twilioSecrets.apiKey ||
          !twilioSecrets.apiSecret ||
          !twilioSecrets.twimlAppSid
        ) {
          twilioSecrets = null;
        }
      } catch (e) {
        console.error('[getTwilioToken] journal de conformité — lecture secrets', e);
        twilioSecrets = null;
      }

      const diag = diagnoseTwilioVoiceJwtSecrets(twilioSecrets);

      if (!twilioSecrets) {
        console.error('[getTwilioToken] journal de conformité — secrets Twilio manquants', {
          present: diag.present,
          issues: diag.issues,
        });
        res.status(500).json({ error: 'Twilio non configuré sur le serveur' });
        return;
      }

      if (!diag.verificationClesConforme) {
        console.warn(
          '[getTwilioToken] journal de conformité — vérification de conformité des clés (écart détecté)',
          {
            accountSidSource: diag.accountSidSource,
            masked: diag.masked,
            issues: diag.issues,
            verificationClesConforme: false,
          }
        );
        res.status(503).json({
          error:
            'Téléphonie : vérification de conformité des clés Twilio non passée. Contactez l’administrateur.',
          code: 'VOIP_SECRET_NON_CONFORME',
          issues: diag.issues,
        });
        return;
      }

      const { accountSid, apiKey, apiSecret, twimlAppSid, accountSidSource } = twilioSecrets;

      const { default: twilio } = await import('twilio');
      const AccessToken = twilio.jwt.AccessToken;
      const VoiceGrant = AccessToken.VoiceGrant;

      const identity = userId;
      const accessToken = new AccessToken(accountSid, apiKey, apiSecret, {
        identity,
        ttl: 3600,
      });

      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: true,
      });
      accessToken.addGrant(voiceGrant);

      const jwt = accessToken.toJwt();

      console.info('[getTwilioToken] jeton Voice émis — journal de conformité', {
        userId,
        identity,
        accountSidSource,
        masked: diag.masked,
        verificationClesConforme: true,
      });

      res.json({
        token: jwt,
        identity,
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'UNAUTHENTICATED') {
        res.status(401).json({ error: 'Non authentifié' });
        return;
      }
      console.error('[getTwilioToken]', e);
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  }
);
