import { getDb, threadMessagesCol } from '../lib/firestore';
import { fetchNylasMessageById, resolveNylasMessageBody } from './fetchMessageBody';

function visibleBodyLength(body: string): number {
  const trimmed = body.trim();
  if (!trimmed) return 0;
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim().length;
  }
  return trimmed.length;
}

export interface HydrateMessageBodyInput {
  brokerId: string;
  threadId: string;
  messageId: string;
  accountId: string;
  grantId: string;
}

/** Charge le corps depuis Nylas et le persiste sur le document message Firestore. */
export async function hydrateFirestoreMessageBody(
  input: HydrateMessageBodyInput
): Promise<{ body: string; updated: boolean }> {
  const { brokerId, threadId, messageId, grantId } = input;
  const ref = threadMessagesCol(brokerId, threadId).doc(messageId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { body: '', updated: false };
  }

  const data = snap.data() ?? {};
  const existing = typeof data.body === 'string' ? data.body.trim() : '';
  if (visibleBodyLength(existing) >= 80) {
    return { body: existing, updated: false };
  }

  const nylasMessageId =
    typeof data.nylasMessageId === 'string' ? data.nylasMessageId.trim() : '';
  if (!nylasMessageId) {
    return { body: existing, updated: false };
  }

  const remote = await fetchNylasMessageById(grantId, nylasMessageId);
  const body = remote ? resolveNylasMessageBody(remote) : existing;
  if (!body || body === existing) {
    return { body: existing || body, updated: false };
  }

  await ref.update({
    body,
    updatedAt: Date.now(),
  });

  return { body, updated: true };
}

export async function resolveGrantIdForAccount(
  brokerId: string,
  accountId: string
): Promise<string | null> {
  const userSnap = await getDb().collection('users').doc(brokerId).get();
  const accounts = userSnap.data()?.emailAccounts;
  if (!Array.isArray(accounts)) return null;
  for (const raw of accounts) {
    if (!raw || typeof raw !== 'object') continue;
    const acc = raw as Record<string, unknown>;
    if (acc.id === accountId && typeof acc.nylasGrantId === 'string') {
      return acc.nylasGrantId.trim() || null;
    }
  }
  return null;
}
