import type { Request, Response } from 'express';
import { resolveAccountByGrant, syncNylasMessageToFirestore } from './syncInboundMessage';
import type { NylasWebhookEnvelope } from './types';

/** GET — challenge Nylas (vérification webhook). */
export function handleNylasWebhookChallenge(req: Request, res: Response): void {
  const challenge = req.query.challenge;
  if (typeof challenge === 'string' && challenge.length > 0) {
    res.status(200).send(challenge);
    return;
  }
  res.status(400).send('missing challenge');
}

/** POST — message.created → Firestore. */
export async function handleNylasWebhookEvent(req: Request, res: Response): Promise<void> {
  try {
    const envelope = req.body as NylasWebhookEnvelope;
    const type = envelope.type ?? '';
    if (!type.startsWith('message.')) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const message = envelope.data?.object;
    const grantId = message?.grant_id;
    if (!message?.id || !grantId) {
      res.status(200).json({ ok: true, skipped: 'no message' });
      return;
    }

    const account = await resolveAccountByGrant(grantId);
    if (!account) {
      console.warn('[nylasWebhook] grant inconnu', grantId);
      res.status(200).json({ ok: true, skipped: 'unknown grant' });
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

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[nylasWebhook]', e);
    res.status(500).json({ error: String(e) });
  }
}
