import { FieldValue } from 'firebase-admin/firestore';
import { threadMessagesCol, userThreadsCol } from '../lib/firestore';
import { nylasApiBase, requireNylasApiKey } from './config';
import { syncNylasMessageToFirestore } from './syncInboundMessage';
import type { NylasMessageObject } from './types';

export interface SendToRecipientInput {
  brokerId: string;
  accountId: string;
  grantId: string;
  toEmail: string;
  toName?: string;
  subject: string;
  body: string;
  fromEmailAddress?: string;
  propertyId?: string;
  propertyLabel?: string;
}

/**
 * Envoi sortant Nylas vers un destinataire (nouveau fil ou réponse au dernier entrant).
 */
export async function sendNylasToRecipient(input: SendToRecipientInput): Promise<{
  threadId: string;
}> {
  const {
    brokerId,
    accountId,
    grantId,
    toEmail,
    toName,
    subject,
    body,
    propertyId,
    propertyLabel,
  } = input;

  const normalizedEmail = toEmail.trim().toLowerCase();
  if (!normalizedEmail.includes('@')) {
    throw new Error('Adresse courriel destinataire invalide.');
  }

  let threadDocId: string | null = null;

  const byProperty =
    propertyId &&
    (await userThreadsCol(brokerId)
      .where('propertyId', '==', propertyId)
      .where('accountId', '==', accountId)
      .limit(20)
      .get());

  if (byProperty && !byProperty.empty) {
    for (const doc of byProperty.docs) {
      const ce = String(doc.data().contactEmail ?? '').toLowerCase();
      if (ce === normalizedEmail) {
        threadDocId = doc.id;
        break;
      }
    }
    if (!threadDocId) threadDocId = byProperty.docs[0].id;
  }

  if (!threadDocId) {
    const byEmail = await userThreadsCol(brokerId)
      .where('contactEmail', '==', normalizedEmail)
      .where('accountId', '==', accountId)
      .limit(1)
      .get();
    if (!byEmail.empty) threadDocId = byEmail.docs[0].id;
  }

  if (!threadDocId) {
    const ref = userThreadsCol(brokerId).doc();
    await ref.set({
      brokerId,
      accountId,
      subject,
      contactName: toName?.trim() || normalizedEmail,
      contactEmail: normalizedEmail,
      lastMessageSnippet: body.slice(0, 140),
      lastMessageAtMillis: Date.now(),
      lastMessageAt: FieldValue.serverTimestamp(),
      isUnread: false,
      createdAtMillis: Date.now(),
      mailboxFolder: 'SENT',
      propertyId: propertyId ?? null,
      propertyLabel: propertyLabel ?? null,
    });
    threadDocId = ref.id;
  }

  const threadSnap = await userThreadsCol(brokerId).doc(threadDocId).get();
  const thread = threadSnap.data() ?? {};

  const apiKey = requireNylasApiKey();
  const payload: Record<string, unknown> = {
    subject: subject || thread.subject || 'Mise à jour — PrimeXpert',
    body,
    to: [{ email: normalizedEmail, name: toName?.trim() || undefined }],
    tracking_options: {
      opens: true,
      label: 'primexpert-seller-update',
    },
  };

  const msgsSnap = await threadMessagesCol(brokerId, threadDocId).get();
  let replyId: string | undefined;
  let latestInbound = 0;
  for (const doc of msgsSnap.docs) {
    const d = doc.data();
    if (d.direction !== 'inbound' || typeof d.nylasMessageId !== 'string') continue;
    const t = typeof d.sentAtMillis === 'number' ? d.sentAtMillis : 0;
    if (t >= latestInbound) {
      latestInbound = t;
      replyId = d.nylasMessageId;
    }
  }
  if (replyId) payload.reply_to_message_id = replyId;

  const res = await fetch(`${nylasApiBase()}/v3/grants/${grantId}/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nylas send failed: ${res.status} ${text}`);
  }

  const sent = (await res.json()) as { data?: NylasMessageObject };
  const message: NylasMessageObject = sent.data ?? {
    id: `local-${Date.now()}`,
    grant_id: grantId,
    subject: payload.subject as string,
    body,
    date: Math.floor(Date.now() / 1000),
    from: [{ email: input.fromEmailAddress }],
    to: [{ email: normalizedEmail, name: toName }],
  };

  if (message.thread_id) {
    await userThreadsCol(brokerId).doc(threadDocId).set(
      { nylasThreadId: message.thread_id },
      { merge: true }
    );
  }

  await syncNylasMessageToFirestore({
    brokerId,
    accountId,
    grantId,
    message,
    direction: 'outbound',
    preferredThreadDocId: threadDocId,
  });

  await userThreadsCol(brokerId).doc(threadDocId).set(
    {
      propertyId: propertyId ?? null,
      propertyLabel: propertyLabel ?? null,
      contactEmail: normalizedEmail,
      lastMessageSnippet: body.slice(0, 140),
      lastMessageAtMillis: Date.now(),
      mailboxFolder: 'SENT',
    },
    { merge: true }
  );

  return { threadId: threadDocId };
}
