import { FieldValue } from 'firebase-admin/firestore';
import { getDb, threadMessagesCol, userThreadsCol } from '../lib/firestore';
import { resolveMailboxFolderFromNylas } from './mailboxFolder';
import {
  buildInboundMailAnalysis,
  loadBrokerResidenceInventory,
  mailAnalysisToFirestoreFields,
} from './mailMessageAnalysis';
import { fetchNylasMessageById, resolveNylasMessageBody } from './fetchMessageBody';
import { findMessageByNylasId, nylasMessageDocId } from './messageDocId';
import type { NylasMessageObject } from './types';

export interface SyncInboundInput {
  brokerId: string;
  accountId: string;
  grantId: string;
  message: NylasMessageObject;
  direction: 'inbound' | 'outbound';
  /** Force l’écriture sur un fil Firestore existant (évite les doublons à l’envoi). */
  preferredThreadDocId?: string;
}

function pickContact(message: NylasMessageObject, direction: 'inbound' | 'outbound') {
  const list = direction === 'inbound' ? message.from : message.to;
  const first = list?.[0];
  return {
    name: first?.name?.trim() || first?.email || 'Contact',
    email: first?.email?.trim(),
  };
}

async function resolveResidenceLabel(residenceId: string): Promise<string | null> {
  const snap = await getDb().collection('residences').doc(residenceId).get();
  if (!snap.exists) return null;
  const d = snap.data() ?? {};
  const address = String(d.address ?? '').trim();
  const city = String(d.city ?? '').trim();
  if (address && city) return `${address}, ${city}`;
  return address || city || null;
}

/** Trouve ou crée un fil PrimeXpert à partir d’un message Nylas. */
export async function syncNylasMessageToFirestore(input: SyncInboundInput): Promise<void> {
  const { brokerId, accountId, message, direction } = input;
  const nylasMessageId = message.id;
  if (!nylasMessageId) return;

  const nylasThreadId = message.thread_id;
  const sentAtMillis =
    typeof message.date === 'number' ? message.date * 1000 : Date.now();
  let body = resolveNylasMessageBody(message);
  if (body.length < 20 && message.id) {
    const full = await fetchNylasMessageById(input.grantId, message.id);
    if (full) body = resolveNylasMessageBody(full);
  }
  const snippet =
    body.length > 140 ? `${body.slice(0, 137)}…` : body || message.snippet || '';
  const contact = pickContact(message, direction);
  const mailboxFolder = resolveMailboxFolderFromNylas(message.folders, direction);

  const residences = await loadBrokerResidenceInventory(brokerId);
  const parse = buildInboundMailAnalysis({
    brokerId,
    body,
    subject: message.subject,
    sender: contact.name,
    contactEmail: contact.email,
    residences,
  });
  const analysisAt = Date.now();
  const analysisFields = mailAnalysisToFirestoreFields(brokerId, parse, {
    contactEmail: contact.email,
    analyzedAtMillis: analysisAt,
  });
  const matchedResidenceId =
    typeof analysisFields.matchedResidenceId === 'string'
      ? analysisFields.matchedResidenceId
      : null;

  let threadDocId: string | null = input.preferredThreadDocId?.trim() || null;

  if (threadDocId && nylasThreadId) {
    await userThreadsCol(brokerId).doc(threadDocId).set(
      { nylasThreadId },
      { merge: true }
    );
  }

  if (!threadDocId && nylasThreadId) {
    const existing = await userThreadsCol(brokerId)
      .where('nylasThreadId', '==', nylasThreadId)
      .where('accountId', '==', accountId)
      .limit(1)
      .get();
    if (!existing.empty) threadDocId = existing.docs[0].id;
  }

  const threadPatch: Record<string, unknown> = {
    lastMessageSnippet: snippet,
    lastMessageAtMillis: sentAtMillis,
    lastMessageAt: FieldValue.serverTimestamp(),
    isUnread: direction === 'inbound',
    mailboxFolder,
  };

  if (direction === 'inbound' && matchedResidenceId) {
    threadPatch.propertyId = matchedResidenceId;
    const label = await resolveResidenceLabel(matchedResidenceId);
    if (label) threadPatch.propertyLabel = label;
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
      lastMessageAt: FieldValue.serverTimestamp(),
      isUnread: direction === 'inbound',
      createdAtMillis: sentAtMillis,
      mailboxFolder,
      ...(direction === 'inbound' && matchedResidenceId
        ? {
            propertyId: matchedResidenceId,
            propertyLabel: threadPatch.propertyLabel ?? null,
          }
        : {}),
    });
    threadDocId = ref.id;
  } else {
    await userThreadsCol(brokerId).doc(threadDocId).update(threadPatch);
  }

  const messagesCol = threadMessagesCol(brokerId, threadDocId);
  const existingMsg = await findMessageByNylasId(messagesCol, nylasMessageId);
  if (existingMsg?.exists) {
    const patch: Record<string, unknown> = { ...analysisFields };
    const prevBody = String(existingMsg.data()?.body ?? '').trim();
    if (!prevBody && body) patch.body = body;
    await existingMsg.ref.update(patch);
    return;
  }

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

  const messageDoc: Record<string, unknown> = {
    threadId: threadDocId,
    channel: 'email',
    nylasMessageId,
    body,
    sentAtMillis,
    direction,
    authorName: direction === 'inbound' ? contact.name : 'Moi',
    authorId: direction === 'outbound' ? brokerId : null,
    fromAccountId: accountId,
    attachments: [],
    ...analysisFields,
  };
  const fromEmailAddress =
    direction === 'outbound'
      ? fromEmail?.trim() || undefined
      : contact.email?.trim() || undefined;
  if (fromEmailAddress) messageDoc.fromEmailAddress = fromEmailAddress;
  if (direction === 'outbound') {
    messageDoc.isOpened = false;
  }

  await messagesCol.doc(nylasMessageDocId(nylasMessageId)).set(messageDoc);
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
