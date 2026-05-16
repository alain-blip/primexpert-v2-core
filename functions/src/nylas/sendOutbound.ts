import { threadMessagesCol, userThreadsCol } from '../lib/firestore';
import { nylasApiBase, requireNylasApiKey } from './config';
import { syncNylasMessageToFirestore } from './syncInboundMessage';
import type { NylasMessageObject } from './types';

export interface SendOutboundInput {
  brokerId: string;
  accountId: string;
  grantId: string;
  threadId: string;
  body: string;
  fromEmailAddress?: string;
}

export async function sendNylasOutboundMessage(input: SendOutboundInput): Promise<void> {
  const { brokerId, accountId, grantId, threadId, body } = input;
  const threadSnap = await userThreadsCol(brokerId).doc(threadId).get();
  if (!threadSnap.exists) throw new Error('Fil introuvable.');
  const thread = threadSnap.data()!;
  const contactEmail = thread.contactEmail as string | undefined;
  if (!contactEmail) throw new Error('Destinataire inconnu sur ce fil.');

  const apiKey = requireNylasApiKey();
  const payload: Record<string, unknown> = {
    subject: thread.subject || 'Re: PrimeXpert',
    body,
    to: [{ email: contactEmail }],
  };

  const msgsSnap = await threadMessagesCol(brokerId, threadId).get();
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
    thread_id: thread.nylasThreadId as string | undefined,
    subject: payload.subject as string,
    body,
    date: Math.floor(Date.now() / 1000),
    from: [{ email: input.fromEmailAddress }],
    to: [{ email: contactEmail }],
  };

  await syncNylasMessageToFirestore({
    brokerId,
    accountId,
    grantId,
    message,
    direction: 'outbound',
  });
}
