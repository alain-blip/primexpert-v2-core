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
    memory: '1GiB',
    timeoutSeconds: 540,
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

/** Parseur IA — rapport macro marché (Vault global market_documents). */
export const marketDocumentParseIA = onCall(
  {
    invoker: 'public',
    serviceAccount: VERTEX_RUNTIME_SA,
    memory: '2GiB',
    timeoutSeconds: 540,
  },
  async (request) => {
    try {
      const { parseSingleMarketDocument } = await import('./documents/parseMarketDocument');
      if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'Connexion requise.');
      }
      const documentId = String(request.data?.documentId ?? '').trim();
      if (!documentId) {
        throw new HttpsError('invalid-argument', 'documentId requis.');
      }
      const result = await parseSingleMarketDocument(documentId, request.auth.uid);
      return { ok: true, ...result };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error('[marketDocumentParseIA]', e);
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpsError('failed-precondition', msg);
    }
  }
);

/** Injection HITL omnivore → market_macro_stats + market_analytics_raw + marketSnapshots/v1. */
export const injectMarketMacroStats = onCall({ invoker: 'public' }, async (request) => {
  try {
    const { injectMasterMarketExtractionServer } = await import('./documents/injectMarketMacroStats');
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Connexion requise.');
    }
    const documentId = String(request.data?.documentId ?? '').trim();
    const selectedRegions = Array.isArray(request.data?.selectedRegions)
      ? request.data.selectedRegions
      : [];
    const selectedTransactions = Array.isArray(request.data?.selectedTransactions)
      ? request.data.selectedTransactions
      : [];
    const selectedOperationalBenchmarks = Array.isArray(request.data?.selectedOperationalBenchmarks)
      ? request.data.selectedOperationalBenchmarks
      : [];
    const siloType = String(request.data?.siloType ?? 'rpa_ri_chsld').trim();
    if (!documentId) {
      throw new HttpsError('invalid-argument', 'documentId requis.');
    }
    const result = await injectMasterMarketExtractionServer({
      documentId,
      brokerId: request.auth.uid,
      siloType,
      selectedRegions,
      selectedTransactions,
      selectedOperationalBenchmarks,
    });
    return {
      ok: true,
      entryIds: [...result.macroEntryIds, ...result.analyticsEntryIds],
      macroEntryIds: result.macroEntryIds,
      analyticsEntryIds: result.analyticsEntryIds,
      snapshotUpdated: result.snapshotUpdated,
      macroNewCount: result.macroNewCount,
      macroDuplicateCount: result.macroDuplicateCount,
      transactionsNewCount: result.transactionsNewCount,
      transactionsDuplicateCount: result.transactionsDuplicateCount,
      benchmarksNewCount: result.benchmarksNewCount,
      benchmarksDuplicateCount: result.benchmarksDuplicateCount,
    };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[injectMarketMacroStats]', e);
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

/** Corps complet d’un message — GET Nylas + mise à jour Firestore si vide. */
export const nylasFetchMessageBody = onCall({ invoker: 'public' }, async (request) => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Connexion requise.');
    }
    const brokerId = request.auth.uid;
    const threadId = String(request.data?.threadId ?? '');
    const messageId = String(request.data?.messageId ?? '');
    const accountId = String(request.data?.accountId ?? '');

    if (!threadId || !messageId || !accountId) {
      throw new HttpsError(
        'invalid-argument',
        'threadId, messageId et accountId requis.'
      );
    }

    const { hydrateFirestoreMessageBody, resolveGrantIdForAccount } = await import(
      './nylas/hydrateMessageBody'
    );
    const grantId = await resolveGrantIdForAccount(brokerId, accountId);
    if (!grantId) {
      throw new HttpsError(
        'failed-precondition',
        'Ce compte n’est pas relié à Nylas.'
      );
    }

    const result = await hydrateFirestoreMessageBody({
      brokerId,
      threadId,
      messageId,
      accountId,
      grantId,
    });

    return { ok: true, body: result.body, updated: result.updated };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[nylasFetchMessageBody]', e);
    const msg = e instanceof Error ? e.message : String(e);
    throw new HttpsError('internal', msg);
  }
});

function mapNylasCallableError(e: unknown, logLabel: string): HttpsError {
  if (e instanceof HttpsError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  const grpcCode = (e as { code?: number })?.code;
  console.error(`[${logLabel}]`, e);
  if (
    grpcCode === 9 ||
    msg.includes('FAILED_PRECONDITION') ||
    msg.includes('requires an index')
  ) {
    return new HttpsError(
      'failed-precondition',
      `Index Firestore manquant pour la messagerie : ${msg}`
    );
  }
  if (msg.includes('NYLAS_API_KEY') || msg.includes('NYLAS_CLIENT_ID')) {
    return new HttpsError(
      'failed-precondition',
      `Secret Nylas manquant côté Functions : ${msg}`
    );
  }
  return new HttpsError('internal', msg);
}

/** Récupère les messages Nylas d’un fil vide et les écrit dans Firestore. */
export const nylasHydrateThread = onCall({ invoker: 'public' }, async (request) => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Connexion requise.');
    }
    const brokerId = request.auth.uid;
    const threadId = String(request.data?.threadId ?? '');
    const accountId = String(request.data?.accountId ?? '');

    if (!threadId || !accountId) {
      throw new HttpsError('invalid-argument', 'threadId et accountId requis.');
    }

    const { hydrateThreadForBroker } = await import('./nylas/hydrateThreadMessages');
    const result = await hydrateThreadForBroker({ brokerId, threadId, accountId });
    return { ok: true, ...result };
  } catch (e) {
    throw mapNylasCallableError(e, 'nylasHydrateThread');
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

// ============================================================================
// DIFFUSION WEB — silo public_listings + pont WordPress (rpaavendre.com)
// ============================================================================

const WP_SECRETS = [
  'WP_SITE_URL',
  'WP_USERNAME',
  'WP_APP_PASSWORD',
] as const;

/** Diffusion Web — publication officielle (WP `publish` + silo VISIBLE). */
export const diffusionPublishListing = onCall(
  { invoker: 'public', secrets: [...WP_SECRETS] },
  async (request) => {
    try {
      if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'Connexion requise.');
      }
      const residenceId = String(request.data?.residenceId ?? '').trim();
      if (!residenceId) {
        throw new HttpsError('invalid-argument', 'residenceId requis.');
      }
      const { publishListingHandler } = await import('./diffusion/publishListingV2');
      return await publishListingHandler({
        residenceId,
        brokerId: request.auth.uid,
      });
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error('[diffusionPublishListing]', e);
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpsError('failed-precondition', msg);
    }
  }
);

/** Diffusion Web — brouillon (WP `draft` + silo MASQUE + draftToken vendeur). */
export const diffusionSaveDraftListing = onCall(
  { invoker: 'public', secrets: [...WP_SECRETS] },
  async (request) => {
    try {
      if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'Connexion requise.');
      }
      const residenceId = String(request.data?.residenceId ?? '').trim();
      if (!residenceId) {
        throw new HttpsError('invalid-argument', 'residenceId requis.');
      }
      const { saveDraftListingHandler } = await import('./diffusion/saveDraftListingV2');
      return await saveDraftListingHandler({
        residenceId,
        brokerId: request.auth.uid,
      });
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error('[diffusionSaveDraftListing]', e);
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpsError('failed-precondition', msg);
    }
  }
);

/** Diffusion Web — retrait (WP `draft`/`private` + silo MASQUE/ARCHIVE). */
export const diffusionHideListing = onCall(
  { invoker: 'public', secrets: [...WP_SECRETS] },
  async (request) => {
    try {
      if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'Connexion requise.');
      }
      const residenceId = String(request.data?.residenceId ?? '').trim();
      if (!residenceId) {
        throw new HttpsError('invalid-argument', 'residenceId requis.');
      }
      const rawMode = String(request.data?.mode ?? 'MASQUE').trim().toUpperCase();
      const mode =
        rawMode === 'ARCHIVE' ? ('ARCHIVE' as const) : ('MASQUE' as const);
      const { hideListingHandler } = await import('./diffusion/hideListingV2');
      return await hideListingHandler({
        residenceId,
        brokerId: request.auth.uid,
        mode,
      });
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error('[diffusionHideListing]', e);
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpsError('failed-precondition', msg);
    }
  }
);

/** Sélection documentaire — envoi Nylas avec liens Prime-Drive signés. */
export const sendDocumentSelection = onCall({ invoker: 'public' }, async (request) => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Connexion requise.');
    }
    const brokerId = request.auth.uid;
    const documentIds = Array.isArray(request.data?.documentIds)
      ? (request.data.documentIds as unknown[]).map((id) => String(id).trim()).filter(Boolean)
      : [];
    const targetRole = String(request.data?.targetRole ?? 'custom').trim() as
      | 'buyer'
      | 'notary'
      | 'banker'
      | 'custom';
    const recipientEmail = String(request.data?.recipientEmail ?? '').trim();
    const subject = String(request.data?.subject ?? '').trim();
    const message = String(request.data?.message ?? '').trim();
    const accountId = String(request.data?.accountId ?? '').trim() || undefined;
    const propertyId = String(request.data?.propertyId ?? '').trim() || undefined;
    const contactId = String(request.data?.contactId ?? '').trim() || undefined;

    if (!documentIds.length || !recipientEmail || !subject || !message) {
      throw new HttpsError(
        'invalid-argument',
        'documentIds, recipientEmail, subject et message requis.'
      );
    }

    const { sendDocumentSelectionEmail } = await import('./emails/sendDocumentSelection');
    const result = await sendDocumentSelectionEmail({
      brokerId,
      documentIds,
      targetRole,
      recipientEmail,
      subject,
      message,
      accountId,
      propertyId,
      contactId,
    });

    return { ok: true, sentCount: result.sentCount, threadId: result.threadId };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[sendDocumentSelection]', e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Nylas') || msg.includes('courriel')) {
      throw new HttpsError('failed-precondition', msg);
    }
    throw new HttpsError('internal', msg);
  }
});

/** Benchmark portefeuille — médianes dépense/RBE (IQR, dataV2). */
export { getGlobalFinancialBenchmark } from './benchmark/getGlobalFinancialBenchmark';
