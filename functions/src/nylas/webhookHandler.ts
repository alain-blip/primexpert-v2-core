import type { Request, Response } from 'express';
import { markNylasMessageOpened } from './markMessageOpened';
import { resolveAccountByGrant, syncNylasMessageToFirestore } from './syncInboundMessage';
import type { NylasMessageOpenedObject, NylasMessageObject, NylasWebhookEnvelope } from './types';

/** GET — challenge Nylas (vérification webhook). */
export function handleNylasWebhookChallenge(req: Request, res: Response): void {
  const challenge = req.query.challenge;
  if (typeof challenge === 'string' && challenge.length > 0) {
    res.status(200).send(challenge);
    return;
  }
  res.status(400).send('missing challenge');
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

/** POST — événements Nylas → Firestore. */
export async function handleNylasWebhookEvent(req: Request, res: Response): Promise<void> {
  try {
    const envelope = req.body as NylasWebhookEnvelope;
    const type = envelope.type ?? '';

    if (isMessageOpenedType(type)) {
      const opened = envelope.data?.object as NylasMessageOpenedObject | undefined;
      const grantId = opened?.grant_id ?? envelope.data?.grant_id;
      if (!grantId || !opened?.message_id) {
        res.status(200).json({ ok: true, skipped: 'no open payload' });
        return;
      }

      const updated = await markNylasMessageOpened(grantId, opened);
      console.info('[nylasWebhook] message.opened', {
        grantId,
        messageId: opened.message_id,
        updated,
      });
      res.status(200).json({ ok: true, updated });
      return;
    }

    if (!isMessageWebhookType(type)) {
      res.status(200).json({ ok: true, skipped: true, type });
      return;
    }

    const message = envelope.data?.object as NylasMessageObject | undefined;
    const grantId = message?.grant_id ?? envelope.data?.grant_id;
    if (!message?.id || !grantId) {
      res.status(200).json({ ok: true, skipped: 'no message' });
      return;
    }

    const account = await resolveAccountByGrant(grantId);
    if (!account) {
      console.warn('[nylasWebhook] grant inconnu — ajoutez nylasGrantId au compte', grantId);
      res.status(200).json({ ok: true, skipped: 'unknown grant', grantId });
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

    console.info('[nylasWebhook] synced', {
      type,
      grantId,
      messageId: message.id,
      uid: account.uid,
      accountId: account.accountId,
      direction,
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[nylasWebhook]', e);
    res.status(500).json({ error: String(e) });
  }
}
