import * as admin from 'firebase-admin';
import { getDb, threadMessagesCol, userThreadsCol } from '../lib/firestore';
import type { NylasMessageObject } from './types';

export interface SyncInboundInput {
  brokerId: string;
  accountId: string;
  grantId: string;
  message: NylasMessageObject;
  direction: 'inbound' | 'outbound';
}

function pickContact(message: NylasMessageObject, direction: 'inbound' | 'outbound') {
  const list = direction === 'inbound' ? message.from : message.to;
  const first = list?.[0];
  return {
    name: first?.name?.trim() || first?.email || 'Contact',
    email: first?.email?.trim(),
  };
}

/** Trouve ou crée un fil PrimeXpert à partir d’un message Nylas. */
export async function syncNylasMessageToFirestore(input: SyncInboundInput): Promise<void> {
  const { brokerId, accountId, message, direction } = input;
  const nylasMessageId = message.id;
  if (!nylasMessageId) return;

  const nylasThreadId = message.thread_id;
  const sentAtMillis =
    typeof message.date === 'number' ? message.date * 1000 : Date.now();
  const body = message.body || message.snippet || '';
  const snippet =
    body.length > 140 ? `${body.slice(0, 137)}…` : body || message.snippet || '';
  const contact = pickContact(message, direction);

  let threadDocId: string | null = null;

  if (nylasThreadId) {
    const existing = await userThreadsCol(brokerId)
      .where('nylasThreadId', '==', nylasThreadId)
      .where('accountId', '==', accountId)
      .limit(1)
      .get();
    if (!existing.empty) threadDocId = existing.docs[0].id;
  }

  if (!threadDocId) {
    const ref = userThreadsCol(brokerId).doc();
    await ref.set({
      brokerId,
      accountId,
      nylasThreadId: nylasThreadId || null,
      subject: message.subject || 'Sans objet',
      contactName: contact.name,
      contactEmail: contact.email || null,
      lastMessageSnippet: snippet,
      lastMessageAtMillis: sentAtMillis,
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      isUnread: direction === 'inbound',
      createdAtMillis: sentAtMillis,
    });
    threadDocId = ref.id;
  } else {
    await userThreadsCol(brokerId)
      .doc(threadDocId)
      .update({
        lastMessageSnippet: snippet,
        lastMessageAtMillis: sentAtMillis,
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        isUnread: direction === 'inbound',
      });
  }

  const messagesCol = threadMessagesCol(brokerId, threadDocId);
  const dup = await messagesCol.where('nylasMessageId', '==', nylasMessageId).limit(1).get();
  if (!dup.empty) return;

  const accountSnap = await getDb().collection('users').doc(brokerId).get();
  const accounts = accountSnap.data()?.emailAccounts;
  let fromEmail: string | undefined;
  if (Array.isArray(accounts)) {
    for (const raw of accounts) {
      if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).id === accountId) {
        fromEmail = String((raw as Record<string, unknown>).emailAddress ?? '');
        break;
      }
    }
  }

  await messagesCol.add({
    threadId: threadDocId,
    nylasMessageId,
    body,
    sentAtMillis,
    direction,
    authorName: direction === 'inbound' ? contact.name : 'Moi',
    authorId: direction === 'outbound' ? brokerId : null,
    fromAccountId: accountId,
    fromEmailAddress: direction === 'outbound' ? fromEmail : contact.email,
    attachments: [],
  });
}

/** Résout brokerId + accountId + email à partir du grant Nylas. */
export async function resolveAccountByGrant(
  grantId: string
): Promise<{ uid: string; accountId: string; email?: string } | null> {
  const users = await getDb().collection('users').get();
  for (const userDoc of users.docs) {
    const data = userDoc.data();
    const accounts = data.emailAccounts;
    if (!Array.isArray(accounts)) continue;
    for (const raw of accounts) {
      if (!raw || typeof raw !== 'object') continue;
      const acc = raw as Record<string, unknown>;
      if (acc.nylasGrantId === grantId && typeof acc.id === 'string') {
        return {
          uid: userDoc.id,
          accountId: acc.id,
          email: typeof acc.emailAddress === 'string' ? acc.emailAddress : undefined,
        };
      }
    }
  }
  return null;
}
