import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import type { OAuthStatePayload } from './nylas/types';

const VERTEX_RUNTIME_SA =
  '250702494735-compute@developer.gserviceaccount.com';

setGlobalOptions({
  region: process.env.FUNCTION_REGION || 'us-central1',
  maxInstances: 20,
  secrets: [
    'NYLAS_API_KEY',
    'NYLAS_CLIENT_ID',
    'NYLAS_CLIENT_SECRET',
    'NYLAS_WEBHOOK_SECRET',
  ],
});

/** Scan sécurité d’un document (après téléversement). */
export const propertyDocumentScanDocument = onCall({ invoker: 'public' }, async (request) => {
  try {
    const { scanSinglePropertyDocument } = await import('./documents/scanPropertyDocument');
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Connexion requise.');
    }
    const propertyId = String(request.data?.propertyId ?? '').trim();
    const documentId = String(request.data?.documentId ?? '').trim();
    if (!propertyId || !documentId) {
      throw new HttpsError('invalid-argument', 'propertyId et documentId requis.');
    }
    const result = await scanSinglePropertyDocument(propertyId, documentId, request.auth.uid);
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[propertyDocumentScanDocument]', e);
    const msg = e instanceof Error ? e.message : String(e);
    throw new HttpsError('failed-precondition', msg);
  }
});

/** Parseur IA Gemini — document financier (clean + parsing pending). */
export const propertyDocumentParseIA = onCall(
  {
    invoker: 'public',
    serviceAccount: VERTEX_RUNTIME_SA,
  },
  async (request) => {
    try {
      const { parseSinglePropertyDocument } = await import('./documents/parsePropertyDocument');
      if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'Connexion requise.');
      }
      const propertyId = String(request.data?.propertyId ?? '').trim();
      const documentId = String(request.data?.documentId ?? '').trim();
      if (!propertyId || !documentId) {
        throw new HttpsError('invalid-argument', 'propertyId et documentId requis.');
      }
      const result = await parseSinglePropertyDocument(
        propertyId,
        documentId,
        request.auth.uid
      );
      return { ok: true, ...result };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error('[propertyDocumentParseIA]', e);
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpsError('failed-precondition', msg);
    }
  }
);

/** Réconcilie les analyses IA en attente pour une fiche. */
export const propertyDocumentsReconcileParse = onCall(
  {
    invoker: 'public',
    serviceAccount: VERTEX_RUNTIME_SA,
  },
  async (request) => {
    try {
      const { reconcilePendingPropertyParses } = await import('./documents/parsePropertyDocument');
      if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'Connexion requise.');
      }
      const propertyId = String(request.data?.propertyId ?? '').trim();
      if (!propertyId) {
        throw new HttpsError('invalid-argument', 'propertyId requis.');
      }
      const result = await reconcilePendingPropertyParses(propertyId, request.auth.uid);
      return { ok: true, ...result };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error('[propertyDocumentsReconcileParse]', e);
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpsError('failed-precondition', msg);
    }
  }
);

/** Réconcilie les fichiers restés en `virusScanStatus: pending`. */
export const propertyDocumentsReconcileScan = onCall({ invoker: 'public' }, async (request) => {
  try {
    const { reconcilePendingPropertyDocuments } = await import('./documents/scanPropertyDocument');
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Connexion requise.');
    }
    const propertyId = String(request.data?.propertyId ?? '').trim();
    if (!propertyId) {
      throw new HttpsError('invalid-argument', 'propertyId requis.');
    }
    const result = await reconcilePendingPropertyDocuments(propertyId, request.auth.uid);
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[propertyDocumentsReconcileScan]', e);
    const msg = e instanceof Error ? e.message : String(e);
    throw new HttpsError('failed-precondition', msg);
  }
});

/** URL OAuth Hosted Auth Nylas (Gmail / Microsoft). */
export const nylasGetAuthUrl = onCall({ invoker: 'public' }, async (request) => {
  try {
    const { buildNylasAuthUrl } = await import('./nylas/oauth');
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
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[nylasGetAuthUrl]', e);
    const msg = e instanceof Error ? e.message : String(e);
    throw new HttpsError('failed-precondition', msg);
  }
});

/** Callback OAuth après consentement Google/Microsoft. */
export const nylasOAuthCallback = onRequest(async (req, res) => {
  const {
    attachGrantToUserAccount,
    decodeOAuthState,
    exchangeCodeForGrant,
    oauthErrorRedirect,
    oauthSuccessRedirect,
  } = await import('./nylas/oauth');
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

/** Webhook Nylas — challenge instantané + ACK < 2 s, sync messagerie en arrière-plan. */
export const nylasWebhook = onRequest(
  {
    cors: false,
    invoker: 'public',
    region: 'us-central1',
    timeoutSeconds: 60,
    maxInstances: 10,
  },
  async (req, res) => {
    const { handleNylasWebhookRequest } = await import('./nylas/webhookHandler');
    await handleNylasWebhookRequest(req, res);
  }
);

/** Envoi sortant via API Nylas + miroir Firestore. */
export const nylasSendMessage = onCall({ invoker: 'public' }, async (request) => {
  try {
    const { getDb } = await import('./lib/firestore');
    const { sendNylasOutboundMessage } = await import('./nylas/sendOutbound');
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

    const userSnap = await getDb().collection('users').doc(brokerId).get();
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
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[nylasSendMessage]', e);
    const msg = e instanceof Error ? e.message : String(e);
    throw new HttpsError('internal', msg);
  }
});

/** Archive ou corbeille — API Nylas v3 + Firestore. */
export const nylasUpdateThreadFolder = onCall({ invoker: 'public' }, async (request) => {
  try {
    const { moveNylasThreadToFolder } = await import('./nylas/updateThreadFolder');
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Connexion requise.');
    }
    const brokerId = request.auth.uid;
    const threadId = String(request.data?.threadId ?? '');
    const accountId = String(request.data?.accountId ?? '');
    const folderRaw = String(request.data?.folder ?? '').toUpperCase();
    const folder = folderRaw === 'TRASH' ? 'TRASH' : folderRaw === 'ARCHIVE' ? 'ARCHIVE' : '';

    if (!threadId || !accountId || !folder) {
      throw new HttpsError(
        'invalid-argument',
        'threadId, accountId et folder (ARCHIVE|TRASH) requis.'
      );
    }

    const { getDb } = await import('./lib/firestore');
    const userSnap = await getDb().collection('users').doc(brokerId).get();
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

    await moveNylasThreadToFolder({ brokerId, grantId, threadId, folder });
    return { ok: true, folder };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[nylasUpdateThreadFolder]', e);
    const msg = e instanceof Error ? e.message : String(e);
    throw new HttpsError('internal', msg);
  }
});

/** Mise à jour vendeur — envoi Nylas vers destinataire (nouveau fil ou fil existant). */
export const nylasSendSellerUpdate = onCall({ invoker: 'public' }, async (request) => {
  try {
    const { sendNylasToRecipient } = await import('./nylas/sendToRecipient');
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Connexion requise.');
    }
    const brokerId = request.auth.uid;
    const toEmail = String(request.data?.toEmail ?? '').trim();
    const body = String(request.data?.body ?? '').trim();
    const accountId = String(request.data?.accountId ?? '');
    const subject = String(request.data?.subject ?? 'Mise à jour sur votre inscription').trim();
    const toName = String(request.data?.toName ?? '').trim() || undefined;
    const propertyId = String(request.data?.propertyId ?? '').trim() || undefined;
    const propertyLabel = String(request.data?.propertyLabel ?? '').trim() || undefined;

    if (!toEmail || !body || !accountId) {
      throw new HttpsError('invalid-argument', 'toEmail, body et accountId requis.');
    }

    const { getDb } = await import('./lib/firestore');
    const userSnap = await getDb().collection('users').doc(brokerId).get();
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

    const result = await sendNylasToRecipient({
      brokerId,
      accountId,
      grantId,
      toEmail,
      toName,
      subject,
      body,
      fromEmailAddress:
        typeof acc?.emailAddress === 'string' ? acc.emailAddress : undefined,
      propertyId,
      propertyLabel,
    });

    return { ok: true, threadId: result.threadId };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[nylasSendSellerUpdate]', e);
    const msg = e instanceof Error ? e.message : String(e);
    throw new HttpsError('internal', msg);
  }
});
