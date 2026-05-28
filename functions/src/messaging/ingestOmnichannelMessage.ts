/**
 * Ingestion omnicanale — SSOT users/{brokerId}/email_threads + messages
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getDb, threadMessagesCol, userThreadsCol } from '../lib/firestore';
import {
  analyzeInboundUrgencyHeuristic,
  buildCrmThreadId,
  buildSmsThreadId,
  type CommunicationChannel,
  type CommunicationMessageMetadata,
} from '../nylas/_vendored/mail';
import { analyzeInboundMessageUrgency } from './urgencyAnalyzer';
import { findBrokerContactByPhone, resolveBrokerByTwilioNumber } from './resolveBrokerAndContact';

export interface IngestOmnichannelMessageInput {
  brokerId: string;
  orgId: string;
  channel: CommunicationChannel;
  direction: 'inbound' | 'outbound';
  body: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  matchedContactId?: string | null;
  externalThreadKey?: string;
  externalMessageId: string;
  metadata?: CommunicationMessageMetadata;
  subject?: string;
  /** Passer false pour désactiver Gemini (tests). */
  analyzeUrgency?: boolean;
}

export interface IngestOmnichannelMessageResult {
  threadId: string;
  messageId: string;
  isCritical: boolean;
}

function sanitizeTaskDocId(externalMessageId: string): string {
  return `sms_critical_${externalMessageId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)}`;
}

async function createCriticalSmsTask(params: {
  orgId: string;
  brokerId: string;
  matchedContactId?: string | null;
  externalMessageId: string;
  contactName: string;
  body: string;
  summaryOneLine: string;
  sentAtMillis: number;
}) {
  const { orgId, brokerId, matchedContactId, externalMessageId, contactName, body, summaryOneLine, sentAtMillis } =
    params;
  if (!orgId.trim()) return;
  const db = getDb();
  const taskId = sanitizeTaskDocId(externalMessageId);
  const taskRef = db.collection('organizations').doc(orgId).collection('tasks').doc(taskId);
  await taskRef.set(
    {
      orgId,
      ownerId: brokerId,
      contactId: matchedContactId ?? null,
      title: 'Interaction critique SMS a traiter',
      description: summaryOneLine || body.slice(0, 400) || 'SMS entrant critique detecte.',
      channel: 'sms',
      priority: 'haute',
      status: 'a_faire',
      kind: 'task',
      source: 'omnichannel_sms_critical',
      sourceMessageId: externalMessageId,
      contactName,
      dueAtMillis: sentAtMillis,
      createdAtMillis: sentAtMillis,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

function resolveThreadDocId(input: IngestOmnichannelMessageInput): string {
  if (input.matchedContactId?.trim()) {
    return buildCrmThreadId(input.matchedContactId);
  }
  if (input.externalThreadKey?.trim()) {
    const key = input.externalThreadKey.trim();
    if (key.startsWith('crm_') || key.startsWith('sms_') || key.startsWith('meta_')) {
      return key;
    }
    return `meta_${key}`;
  }
  if (input.contactPhone) {
    return buildSmsThreadId(input.contactPhone);
  }
  return `omni_${input.channel}_${Date.now()}`;
}

export async function ingestOmnichannelMessage(
  input: IngestOmnichannelMessageInput
): Promise<IngestOmnichannelMessageResult> {
  const {
    brokerId,
    orgId,
    channel,
    direction,
    body,
    contactName = 'Contact',
    externalMessageId,
    metadata = {},
  } = input;

  const sentAtMillis = Date.now();
  const snippet = body.length > 140 ? `${body.slice(0, 137)}…` : body;

  let isCritical = false;
  let summaryOneLine = snippet;
  let mailUrgency: string | undefined;

  if (direction === 'inbound' && (channel === 'sms' || channel === 'facebook' || channel === 'instagram')) {
    const urgency =
      input.analyzeUrgency === false
        ? analyzeInboundUrgencyHeuristic(body)
        : await analyzeInboundMessageUrgency(body, channel);
    isCritical = urgency.isCritical;
    summaryOneLine = urgency.summaryOneLine;
    mailUrgency = urgency.urgency;
  }

  const threadDocId = resolveThreadDocId(input);
  const threadRef = userThreadsCol(brokerId).doc(threadDocId);
  const threadSnap = await threadRef.get();

  const threadPatch: Record<string, unknown> = {
    brokerId,
    lastMessageSnippet: snippet,
    lastMessageAtMillis: sentAtMillis,
    lastMessageAt: FieldValue.serverTimestamp(),
    isUnread: direction === 'inbound',
    primaryChannel: channel,
    externalThreadKey: input.externalThreadKey ?? threadDocId,
    ...(input.matchedContactId ? { matchedContactId: input.matchedContactId } : {}),
    ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
  };

  if (!threadSnap.exists) {
    await threadRef.set({
      brokerId,
      accountId: channel === 'email' ? '' : `omni_${channel}`,
      subject: input.subject || (channel === 'sms' ? 'SMS' : 'Messagerie'),
      contactName,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      lastMessageSnippet: snippet,
      lastMessageAtMillis: sentAtMillis,
      lastMessageAt: FieldValue.serverTimestamp(),
      isUnread: direction === 'inbound',
      createdAtMillis: sentAtMillis,
      mailboxFolder: direction === 'inbound' ? 'INBOX' : 'SENT',
      primaryChannel: channel,
      externalThreadKey: input.externalThreadKey ?? threadDocId,
      matchedContactId: input.matchedContactId ?? null,
      orgId,
    });
  } else {
    await threadRef.set(threadPatch, { merge: true });
  }

  const messageId = externalMessageId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const messageRef = threadMessagesCol(brokerId, threadDocId).doc(messageId);

  await messageRef.set({
    threadId: threadDocId,
    channel,
    body,
    sentAtMillis,
    timestamp: sentAtMillis,
    direction,
    authorName: direction === 'inbound' ? contactName : 'Moi',
    authorId: direction === 'outbound' ? brokerId : null,
    metadata,
    isCritical,
    summaryOneLine,
    mailUrgency,
    matchedContactId: input.matchedContactId ?? null,
    mailAnalysisAtMillis: sentAtMillis,
    mailAnalysisSource: channel === 'email' ? 'nylas' : 'omnichannel',
  });

  if (direction === 'inbound' && channel === 'sms' && isCritical) {
    await createCriticalSmsTask({
      orgId,
      brokerId,
      matchedContactId: input.matchedContactId ?? null,
      externalMessageId,
      contactName,
      body,
      summaryOneLine,
      sentAtMillis,
    });
  }

  return { threadId: threadDocId, messageId, isCritical };
}

/** Résolution courtier + contact pour SMS Twilio entrant. */
export async function ingestTwilioInboundSms(params: {
  toNumber: string;
  fromNumber: string;
  body: string;
  messageSid: string;
}): Promise<IngestOmnichannelMessageResult | null> {
  const broker = await resolveBrokerByTwilioNumber(params.toNumber);
  if (!broker) return null;

  const contact = await findBrokerContactByPhone(broker.uid, broker.orgId, params.fromNumber);
  const matchedContactId = contact?.id ?? null;
  const contactName = contact?.displayName ?? params.fromNumber;

  return ingestOmnichannelMessage({
    brokerId: broker.uid,
    orgId: broker.orgId,
    channel: 'sms',
    direction: 'inbound',
    body: params.body,
    contactName,
    contactPhone: params.fromNumber,
    matchedContactId,
    externalThreadKey: matchedContactId ? buildCrmThreadId(matchedContactId) : buildSmsThreadId(params.fromNumber),
    externalMessageId: params.messageSid,
    metadata: {
      externalSenderId: params.fromNumber,
      fromPhone: params.fromNumber,
      toPhone: params.toNumber,
      twilioMessageSid: params.messageSid,
    },
  });
}
