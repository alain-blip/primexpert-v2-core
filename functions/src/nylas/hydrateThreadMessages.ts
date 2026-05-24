import * as logger from 'firebase-functions/logger';
import { threadMessagesCol, userThreadsCol } from '../lib/firestore';
import { nylasApiBase, requireNylasApiKey } from './config';
import { resolveGrantIdForAccount } from './hydrateMessageBody';
import { syncNylasMessageToFirestore } from './syncInboundMessage';
import type { NylasMessageObject } from './types';

export interface HydrateThreadInput {
  brokerId: string;
  threadId: string;
  accountId: string;
  grantId: string;
  accountEmail?: string;
}

async function listNylasMessagesForThread(
  grantId: string,
  nylasThreadId: string
): Promise<NylasMessageObject[]> {
  const apiKey = requireNylasApiKey();
  const out: NylasMessageObject[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      thread_id: nylasThreadId,
      limit: '50',
    });
    if (pageToken) params.set('page_token', pageToken);

    const url = `${nylasApiBase()}/v3/grants/${encodeURIComponent(grantId)}/messages?${params}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Nylas list messages failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as {
      data?: NylasMessageObject[];
      next_cursor?: string;
    };
    const batch = Array.isArray(json.data) ? json.data : [];
    out.push(...batch);
    pageToken = typeof json.next_cursor === 'string' ? json.next_cursor : undefined;
    if (!pageToken || batch.length === 0) break;
  }

  return out.sort((a, b) => {
    const da = typeof a.date === 'number' ? a.date : 0;
    const db = typeof b.date === 'number' ? b.date : 0;
    return da - db;
  });
}

function resolveDirection(
  message: NylasMessageObject,
  accountEmail?: string
): 'inbound' | 'outbound' {
  const fromEmail = message.from?.[0]?.email?.toLowerCase();
  const myEmail = accountEmail?.trim().toLowerCase();
  if (fromEmail && myEmail && fromEmail === myEmail) return 'outbound';
  return 'inbound';
}

/**
 * Récupère les messages Nylas d’un fil et les persiste sous `email_threads/{threadId}/messages`.
 * No-op si la sous-collection contient déjà au moins un message.
 */
export async function hydrateThreadMessagesFromNylas(
  input: HydrateThreadInput
): Promise<{ synced: number; skipped: boolean }> {
  const { brokerId, threadId, accountId, grantId } = input;

  const threadSnap = await userThreadsCol(brokerId).doc(threadId).get();
  if (!threadSnap.exists) {
    throw new Error('Fil introuvable.');
  }

  const thread = threadSnap.data() ?? {};
  const nylasThreadId =
    typeof thread.nylasThreadId === 'string' ? thread.nylasThreadId.trim() : '';
  if (!nylasThreadId) {
    throw new Error('Ce fil n’a pas d’identifiant Nylas — synchronisation impossible.');
  }

  const existing = await threadMessagesCol(brokerId, threadId).limit(1).get();
  if (!existing.empty) {
    return { synced: 0, skipped: true };
  }

  const remoteMessages = await listNylasMessagesForThread(grantId, nylasThreadId);
  if (remoteMessages.length === 0) {
    logger.warn('[hydrateThreadMessages] aucun message Nylas', {
      brokerId,
      threadId,
      nylasThreadId,
    });
    return { synced: 0, skipped: false };
  }

  let synced = 0;
  for (const message of remoteMessages) {
    if (!message.id) continue;
    await syncNylasMessageToFirestore({
      brokerId,
      accountId,
      grantId,
      message: { ...message, grant_id: grantId, thread_id: nylasThreadId },
      direction: resolveDirection(message, input.accountEmail),
      preferredThreadDocId: threadId,
    });
    synced++;
  }

  logger.info('[hydrateThreadMessages] synced', {
    brokerId,
    threadId,
    nylasThreadId,
    synced,
  });

  return { synced, skipped: false };
}

export async function hydrateThreadForBroker(input: {
  brokerId: string;
  threadId: string;
  accountId: string;
}): Promise<{ synced: number; skipped: boolean }> {
  const grantId = await resolveGrantIdForAccount(input.brokerId, input.accountId);
  if (!grantId) {
    throw new Error('Ce compte n’est pas relié à Nylas.');
  }

  const { getDb } = await import('../lib/firestore');
  const userSnap = await getDb().collection('users').doc(input.brokerId).get();
  const accounts = userSnap.data()?.emailAccounts;
  let accountEmail: string | undefined;
  if (Array.isArray(accounts)) {
    for (const raw of accounts) {
      if (!raw || typeof raw !== 'object') continue;
      const acc = raw as Record<string, unknown>;
      if (acc.id === input.accountId && typeof acc.emailAddress === 'string') {
        accountEmail = acc.emailAddress;
        break;
      }
    }
  }

  return hydrateThreadMessagesFromNylas({
    ...input,
    grantId,
    accountEmail,
  });
}
