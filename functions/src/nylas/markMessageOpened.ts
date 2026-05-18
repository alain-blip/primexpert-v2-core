import { FieldValue } from 'firebase-admin/firestore';
import { EMAIL_MESSAGES, getDb } from '../lib/firestore';
import { resolveAccountByGrant } from './syncInboundMessage';

export interface NylasMessageOpenedPayload {
  grant_id?: string;
  message_id?: string;
  message_data?: { timestamp?: number };
  recents?: Array<{ timestamp?: number }>;
  timestamp?: number;
}

function brokerIdFromMessagePath(path: string): string | null {
  const match = path.match(/^users\/([^/]+)\/email_threads\//);
  return match?.[1] ?? null;
}

function pickOpenedAtMillis(payload: NylasMessageOpenedPayload): number {
  const recent = payload.recents?.[payload.recents.length - 1]?.timestamp;
  const fromData = payload.message_data?.timestamp ?? payload.timestamp ?? recent;
  if (typeof fromData === 'number' && fromData > 0) {
    return fromData < 1_000_000_000_000 ? fromData * 1000 : fromData;
  }
  return Date.now();
}

/** Marque un message sortant comme lu (webhook `message.opened`). */
export async function markNylasMessageOpened(
  grantId: string,
  payload: NylasMessageOpenedPayload
): Promise<boolean> {
  const nylasMessageId = payload.message_id;
  if (!nylasMessageId) return false;

  const account = await resolveAccountByGrant(grantId);
  if (!account) {
    console.warn('[nylasWebhook] message.opened — grant inconnu', grantId);
    return false;
  }

  const openedAtMillis = pickOpenedAtMillis(payload);
  const snaps = await getDb()
    .collectionGroup(EMAIL_MESSAGES)
    .where('nylasMessageId', '==', nylasMessageId)
    .limit(20)
    .get();

  let updated = false;
  for (const doc of snaps.docs) {
    if (brokerIdFromMessagePath(doc.ref.path) !== account.uid) continue;
    if (doc.data().direction !== 'outbound') continue;

    await doc.ref.update({
      isOpened: true,
      openedAt: FieldValue.serverTimestamp(),
      openedAtMillis,
    });
    updated = true;
  }

  if (!updated) {
    console.warn('[nylasWebhook] message.opened — message Firestore introuvable', {
      nylasMessageId,
      uid: account.uid,
    });
  }

  return updated;
}
