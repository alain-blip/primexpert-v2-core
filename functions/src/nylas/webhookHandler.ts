/**
 * Webhook Nylas — challenge instantané + ACK HTTP < 2 s, traitement Firestore en arrière-plan.
 * SSOT messagerie : `users/{uid}/email_threads` + métadonnées d'analyse sur `messages`.
 */

import type { Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { markNylasMessageOpened } from './markMessageOpened';
import { resolveAccountByGrant, syncNylasMessageToFirestore } from './syncInboundMessage';
import type {
  NylasMessageOpenedObject,
  NylasMessageObject,
  NylasWebhookEnvelope,
} from './types';
import { verifyNylasWebhookSignature } from './verifyWebhookSignature';

/** Extrait le challenge Nylas (query GET ou corps POST de vérification). */
export function extractNylasChallenge(req: Request): string | null {
  const fromQuery = req.query?.challenge;
  if (typeof fromQuery === 'string' && fromQuery.trim().length > 0) {
    return fromQuery.trim();
  }

  const body = req.body as Record<string, unknown> | undefined;
  const fromBody = body?.challenge;
  if (typeof fromBody === 'string' && fromBody.trim().length > 0) {
    return fromBody.trim();
  }

  return null;
}

/** Répond au protocole challenge — texte brut, arrêt strict de la requête. */
export function respondNylasChallenge(req: Request, res: Response): boolean {
  const challenge = extractNylasChallenge(req);
  if (!challenge) return false;

  logger.info('[nylasWebhook] challenge reçu', {
    method: req.method,
    length: challenge.length,
  });
  res.status(200).type('text/plain').send(challenge);
  return true;
}

function isMessageWebhookType(type: string): boolean {
  return (
    type === 'message.created' ||
    type === 'message.created.truncated' ||
    type === 'message.created.transformed' ||
    type === 'message.updated'
  );
}

function isMessageOpenedType(type: string): boolean {
  return type === 'message.opened';
}

/**
 * Traitement métier Nylas — exécuté après l’ACK HTTP (ne pas bloquer la socket Nylas).
 */
async function processNylasWebhookPayload(body: unknown): Promise<void> {
  const envelope = (body ?? {}) as NylasWebhookEnvelope;
  const type = envelope.type ?? '';

  if (isMessageOpenedType(type)) {
    const opened = envelope.data?.object as NylasMessageOpenedObject | undefined;
    const grantId = opened?.grant_id ?? envelope.data?.grant_id;
    if (!grantId || !opened?.message_id) {
      logger.info('[nylasWebhook] message.opened ignoré — payload incomplet', { type });
      return;
    }

    const updated = await markNylasMessageOpened(grantId, opened);
    logger.info('[nylasWebhook] message.opened', {
      grantId,
      messageId: opened.message_id,
      updated,
    });
    return;
  }

  if (!isMessageWebhookType(type)) {
    logger.info('[nylasWebhook] événement ignoré', { type });
    return;
  }

  const message = envelope.data?.object as NylasMessageObject | undefined;
  const grantId = message?.grant_id ?? envelope.data?.grant_id;
  if (!message?.id || !grantId) {
    logger.info('[nylasWebhook] message.* ignoré — pas de message', { type });
    return;
  }

  const account = await resolveAccountByGrant(grantId);
  if (!account) {
    logger.warn('[nylasWebhook] grant inconnu — ajoutez nylasGrantId au compte', { grantId });
    return;
  }

  const fromEmail = message.from?.[0]?.email?.toLowerCase();
  const myEmail = account.email?.toLowerCase();
  const direction =
    fromEmail && myEmail && fromEmail === myEmail ? 'outbound' : 'inbound';

  await syncNylasMessageToFirestore({
    brokerId: account.uid,
    accountId: account.accountId,
    grantId,
    message,
    direction,
  });

  logger.info('[nylasWebhook] synced', {
    type,
    grantId,
    messageId: message.id,
    uid: account.uid,
    accountId: account.accountId,
    direction,
  });
}

function scheduleWebhookProcessing(body: unknown): void {
  void processNylasWebhookPayload(body).catch((e) => {
    logger.error('[nylasWebhook] échec traitement arrière-plan', {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
  });
}

/**
 * Point d’entrée unique GET/POST — challenge prioritaire, signature POST, ACK, traitement async.
 */
export async function handleNylasWebhookRequest(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (respondNylasChallenge(req, res)) return;

    if (req.method === 'GET') {
      res.status(400).type('text/plain').send('missing challenge');
      return;
    }

    if (req.method === 'HEAD') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).type('text/plain').send('Method not allowed');
      return;
    }

    if (!verifyNylasWebhookSignature(req)) {
      logger.warn('[nylasWebhook] signature invalide ou absente');
      res.status(401).type('text/plain').send('Unauthorized');
      return;
    }

    const payload =
      req.body && typeof req.body === 'object'
        ? req.body
        : {};

    res.status(200).json({ success: true });
    scheduleWebhookProcessing(payload);
  } catch (e) {
    logger.error('[nylasWebhook] erreur handler HTTP', {
      error: e instanceof Error ? e.message : String(e),
    });
    if (!res.headersSent) {
      res.status(500).type('text/plain').send('Internal error');
    }
  }
}

/** @deprecated Utiliser handleNylasWebhookRequest */
export function handleNylasWebhookChallenge(req: Request, res: Response): void {
  if (!respondNylasChallenge(req, res)) {
    res.status(400).type('text/plain').send('missing challenge');
  }
}

/** @deprecated Utiliser handleNylasWebhookRequest */
export async function handleNylasWebhookEvent(
  req: Request,
  res: Response
): Promise<void> {
  await handleNylasWebhookRequest(req, res);
}
