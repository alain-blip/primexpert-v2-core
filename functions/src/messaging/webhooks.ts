/**
 * Webhooks omnicanaux — Twilio SMS + Meta Messenger / Instagram (Gen2 Montréal).
 */

import type { Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { createHmac } from 'node:crypto';
import { ingestTwilioInboundSms } from './ingestOmnichannelMessage';
import { ingestOmnichannelMessage } from './ingestOmnichannelMessage';
import { resolveBrokerByTwilioNumber } from './resolveBrokerAndContact';
const MONTREAL = 'northamerica-northeast1' as const;

function twimlEmpty(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
}

function verifyTwilioSignature(req: Request, authToken: string): boolean {
  const signature = req.get('X-Twilio-Signature');
  if (!signature || !authToken) return false;
  const url = `https://${req.get('host')}${req.originalUrl}`;
  const params = req.body as Record<string, string>;
  const keys = Object.keys(params).sort();
  let data = url;
  for (const key of keys) {
    data += key + params[key];
  }
  const expected = createHmac('sha1', authToken).update(data).digest('base64');
  return expected === signature;
}

/** POST — SMS entrant Twilio (application/x-www-form-urlencoded). */
export async function handleTwilioSmsWebhook(req: Request, res: Response): Promise<void> {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || '';
  if (authToken && !verifyTwilioSignature(req, authToken)) {
    logger.warn('[twilioSmsWebhook] signature invalide');
    res.status(403).send('Forbidden');
    return;
  }

  const body = req.body as Record<string, string>;
  const from = String(body.From ?? '').trim();
  const to = String(body.To ?? '').trim();
  const text = String(body.Body ?? '').trim();
  const messageSid = String(body.MessageSid ?? body.SmsSid ?? `sms_${Date.now()}`);

  res.status(200).type('text/xml').send(twimlEmpty());

  if (!from || !to || !text) {
    logger.info('[twilioSmsWebhook] payload incomplet, ignoré');
    return;
  }

  setImmediate(() => {
    void ingestTwilioInboundSms({ toNumber: to, fromNumber: from, body: text, messageSid })
      .then((result) => {
        if (!result) {
          logger.warn('[twilioSmsWebhook] courtier non résolu', { to });
          return;
        }
        logger.info('[twilioSmsWebhook] ingéré', {
          threadId: result.threadId,
          messageId: result.messageId,
          isCritical: result.isCritical,
        });
      })
      .catch((e) => logger.error('[twilioSmsWebhook] ingest failed', e));
  });
}

/** GET — vérification webhook Meta. POST — messages Messenger / Instagram. */
export async function handleMetaMessagingWebhook(req: Request, res: Response): Promise<void> {
  const verifyToken = process.env.META_VERIFY_TOKEN?.trim() || '';

  if (req.method === 'GET') {
    const mode = String(req.query['hub.mode'] ?? '');
    const token = String(req.query['hub.verify_token'] ?? '');
    const challenge = String(req.query['hub.challenge'] ?? '');
    if (mode === 'subscribe' && token && token === verifyToken) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send('Forbidden');
    return;
  }

  res.status(200).send('EVENT_RECEIVED');

  const payload = req.body as {
    object?: string;
    entry?: Array<{
      id?: string;
      messaging?: Array<{
        sender?: { id?: string };
        recipient?: { id?: string };
        timestamp?: number;
        message?: { mid?: string; text?: string };
      }>;
    }>;
  };

  setImmediate(() => {
    void processMetaPayload(payload).catch((e) =>
      logger.error('[metaMessagingWebhook] process failed', e)
    );
  });
}

async function processMetaPayload(payload: {
  object?: string;
  entry?: Array<{
    id?: string;
    messaging?: Array<{
      sender?: { id?: string };
      recipient?: { id?: string };
      timestamp?: number;
      message?: { mid?: string; text?: string };
    }>;
  }>;
}): Promise<void> {
  const channel = payload.object === 'instagram' ? 'instagram' : 'facebook';
  for (const entry of payload.entry ?? []) {
    const pageId = entry.id ?? '';
    for (const ev of entry.messaging ?? []) {
      const text = ev.message?.text?.trim();
      const senderId = ev.sender?.id;
      const recipientId = ev.recipient?.id;
      const mid = ev.message?.mid ?? `meta_${Date.now()}`;
      if (!text || !senderId || !recipientId) continue;

      const broker = await resolveBrokerByTwilioNumber(recipientId);
      if (!broker) {
        logger.warn('[metaMessagingWebhook] courtier non lié au pageId/recipient', {
          recipientId,
        });
        continue;
      }

      await ingestOmnichannelMessage({
        brokerId: broker.uid,
        orgId: broker.orgId,
        channel,
        direction: 'inbound',
        body: text,
        contactName: channel === 'instagram' ? 'Instagram' : 'Facebook',
        externalThreadKey: `meta_${senderId}`,
        externalMessageId: mid,
        metadata: {
          externalSenderId: senderId,
          externalRecipientId: recipientId,
          metaMessageId: mid,
          metaPageId: pageId,
        },
        matchedContactId: null,
      });
    }
  }
}

export const MESSAGING_WEBHOOK_REGION = MONTREAL;
