import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import {
  attachGrantToUserAccount,
  buildNylasAuthUrl,
  decodeOAuthState,
  exchangeCodeForGrant,
  oauthErrorRedirect,
  oauthSuccessRedirect,
} from './nylas/oauth';
import { sendNylasOutboundMessage } from './nylas/sendOutbound';
import {
  handleNylasWebhookChallenge,
  handleNylasWebhookEvent,
} from './nylas/webhookHandler';
import { db } from './lib/firestore';
import type { OAuthStatePayload } from './nylas/types';

setGlobalOptions({
  region: process.env.FUNCTION_REGION || 'us-central1',
  maxInstances: 20,
});

/** URL OAuth Hosted Auth Nylas (Gmail / Microsoft). */
export const nylasGetAuthUrl = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Connexion requise.');
  }
  const accountId = String(request.data?.accountId ?? '');
  const label = String(request.data?.label ?? 'Boîte courriel');
  const provider =
    request.data?.provider === 'outlook' ? 'outlook' : ('gmail' as const);
  if (!accountId) {
    throw new HttpsError('invalid-argument', 'accountId requis.');
  }

  const state: OAuthStatePayload = {
    uid: request.auth.uid,
    accountId,
    provider,
    label,
    returnUrl: String(request.data?.returnUrl ?? 'https://primexpert-app-v2.web.app'),
  };

  return { url: buildNylasAuthUrl(state) };
});

/** Callback OAuth après consentement Google/Microsoft. */
export const nylasOAuthCallback = onRequest(async (req, res) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const stateRaw = typeof req.query.state === 'string' ? req.query.state : '';
    const err = typeof req.query.error === 'string' ? req.query.error : '';

    if (err) {
      res.redirect(302, oauthErrorRedirect(err));
      return;
    }
    if (!code || !stateRaw) {
      res.redirect(302, oauthErrorRedirect('Paramètres OAuth invalides.'));
      return;
    }

    const state = decodeOAuthState(stateRaw);
    if (!state) {
      res.redirect(302, oauthErrorRedirect('État OAuth invalide.'));
      return;
    }

    const { grantId, email } = await exchangeCodeForGrant(code);
    await attachGrantToUserAccount(state.uid, state.accountId, grantId, email);
    res.redirect(302, oauthSuccessRedirect(state.accountId));
  } catch (e) {
    console.error('[nylasOAuthCallback]', e);
    res.redirect(302, oauthErrorRedirect(String(e)));
  }
});

/** Webhook Nylas — challenge GET + événements POST. */
export const nylasWebhook = onRequest(
  { cors: false, invoker: 'public' },
  async (req, res) => {
    if (req.method === 'GET') {
      handleNylasWebhookChallenge(req, res);
      return;
    }
    if (req.method === 'POST') {
      await handleNylasWebhookEvent(req, res);
      return;
    }
    res.status(405).send('Method not allowed');
  }
);

/** Envoi sortant via API Nylas + miroir Firestore. */
export const nylasSendMessage = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Connexion requise.');
  }
  const brokerId = request.auth.uid;
  const threadId = String(request.data?.threadId ?? '');
  const body = String(request.data?.body ?? '').trim();
  const accountId = String(request.data?.accountId ?? '');

  if (!threadId || !body || !accountId) {
    throw new HttpsError('invalid-argument', 'threadId, body et accountId requis.');
  }

  const userSnap = await db.collection('users').doc(brokerId).get();
  const accounts = userSnap.data()?.emailAccounts;
  if (!Array.isArray(accounts)) {
    throw new HttpsError('failed-precondition', 'Aucun compte courriel configuré.');
  }

  const acc = accounts.find(
    (a: Record<string, unknown>) => a && a.id === accountId
  ) as Record<string, unknown> | undefined;
  const grantId = typeof acc?.nylasGrantId === 'string' ? acc.nylasGrantId : '';
  if (!grantId) {
    throw new HttpsError(
      'failed-precondition',
      'Ce compte n’est pas relié à Nylas. Reconnectez la boîte dans Paramètres.'
    );
  }

  await sendNylasOutboundMessage({
    brokerId,
    accountId,
    grantId,
    threadId,
    body,
    fromEmailAddress:
      typeof acc?.emailAddress === 'string' ? acc.emailAddress : undefined,
  });

  return { ok: true };
});
