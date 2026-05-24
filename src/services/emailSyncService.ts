/**
 * Messagerie synchronisée — fils `email_threads` + sous-collection `messages`.
 * Chemin : users/{brokerId}/email_threads/{threadId}/messages/{messageId}
 */

import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  normalizeMailboxFolder,
  type MailboxFolder,
} from '../lib/mailboxFolders';
import type {
  EmailAttachment,
  EmailMessage,
  EmailMessageDirection,
  EmailThread,
} from '../types/emailSync';

export const EMAIL_THREADS_SUBCOLLECTION = 'email_threads';
export const EMAIL_MESSAGES_SUBCOLLECTION = 'messages';

function threadsCol(brokerId: string) {
  return collection(db, 'users', brokerId, EMAIL_THREADS_SUBCOLLECTION);
}

function threadRef(brokerId: string, threadId: string) {
  return doc(db, 'users', brokerId, EMAIL_THREADS_SUBCOLLECTION, threadId);
}

function messagesCol(brokerId: string, threadId: string) {
  return collection(
    db,
    'users',
    brokerId,
    EMAIL_THREADS_SUBCOLLECTION,
    threadId,
    EMAIL_MESSAGES_SUBCOLLECTION
  );
}

function toMillis(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  try {
    if (raw && typeof raw === 'object' && 'toMillis' in raw) {
      const fn = (raw as { toMillis?: () => number }).toMillis;
      if (typeof fn === 'function') {
        const ms = fn.call(raw);
        if (Number.isFinite(ms)) return ms;
      }
    }
    if (raw && typeof raw === 'object' && 'seconds' in raw) {
      const sec = (raw as { seconds?: number }).seconds;
      if (typeof sec === 'number' && Number.isFinite(sec)) return sec * 1000;
    }
  } catch {
    /* Timestamp Firestore mal formé — repli ci-dessous */
  }
  return Date.now();
}

function mapAttachments(raw: unknown): EmailAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: EmailAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name : '';
    const url = typeof o.url === 'string' ? o.url : '';
    if (!name || !url) continue;
    out.push({
      name,
      url,
      mimeType: typeof o.mimeType === 'string' ? o.mimeType : undefined,
      sizeBytes: typeof o.sizeBytes === 'number' ? o.sizeBytes : undefined,
    });
  }
  return out.length ? out : undefined;
}

function mapThreadDoc(id: string, data: Record<string, unknown>): EmailThread {
  return {
    id,
    brokerId: String(data.brokerId ?? ''),
    accountId: typeof data.accountId === 'string' ? data.accountId : '',
    subject: String(data.subject ?? 'Sans objet'),
    contactName: String(data.contactName ?? 'Contact'),
    contactEmail: typeof data.contactEmail === 'string' ? data.contactEmail : undefined,
    lastMessageSnippet: String(data.lastMessageSnippet ?? ''),
    lastMessageAtMillis: toMillis(data.lastMessageAt ?? data.lastMessageAtMillis),
    isUnread: data.isUnread === true,
    propertyId: typeof data.propertyId === 'string' ? data.propertyId : undefined,
    propertyLabel: typeof data.propertyLabel === 'string' ? data.propertyLabel : undefined,
    matchedContactId:
      typeof data.matchedContactId === 'string' ? data.matchedContactId : null,
    createdAtMillis: toMillis(data.createdAtMillis ?? data.createdAt),
    nylasThreadId: typeof data.nylasThreadId === 'string' ? data.nylasThreadId : undefined,
    mailboxFolder: normalizeMailboxFolder(data.mailboxFolder),
  };
}

/** Corps message — plusieurs clés possibles (Nylas / import / legacy). */
export function resolveStoredMessageBody(data: Record<string, unknown>): string {
  for (const key of ['body', 'bodyHtml', 'html', 'text', 'snippet'] as const) {
    const raw = data[key];
    if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  }
  return '';
}

function mapMessageDoc(id: string, threadId: string, data: Record<string, unknown>): EmailMessage {
  const body = resolveStoredMessageBody(data);
  return {
    id,
    threadId,
    body,
    sentAtMillis: toMillis(data.sentAtMillis ?? data.sentAt),
    direction: data.direction === 'outbound' ? 'outbound' : 'inbound',
    authorName: typeof data.authorName === 'string' ? data.authorName : undefined,
    authorId: typeof data.authorId === 'string' ? data.authorId : undefined,
    fromAccountId: typeof data.fromAccountId === 'string' ? data.fromAccountId : undefined,
    fromEmailAddress:
      typeof data.fromEmailAddress === 'string' ? data.fromEmailAddress : undefined,
    attachments: mapAttachments(data.attachments),
    isOpened: data.isOpened === true,
    openedAtMillis:
      typeof data.openedAtMillis === 'number'
        ? data.openedAtMillis
        : data.openedAt
          ? toMillis(data.openedAt)
          : undefined,
    nylasMessageId: typeof data.nylasMessageId === 'string' ? data.nylasMessageId : undefined,
    mailAnalysisAtMillis:
      typeof data.mailAnalysisAtMillis === 'number' ? data.mailAnalysisAtMillis : undefined,
    matchedResidenceId:
      typeof data.matchedResidenceId === 'string' ? data.matchedResidenceId : null,
    mailContactEmail:
      typeof data.mailContactEmail === 'string' ? data.mailContactEmail : null,
    mailContactName:
      typeof data.mailContactName === 'string' ? data.mailContactName : null,
    mailIntent: typeof data.mailIntent === 'string' ? data.mailIntent : undefined,
    summaryOneLine:
      typeof data.summaryOneLine === 'string' ? data.summaryOneLine : undefined,
    mailUrgency: typeof data.mailUrgency === 'string' ? data.mailUrgency : undefined,
    matchedContactId:
      typeof data.matchedContactId === 'string' ? data.matchedContactId : null,
  };
}

function isIndexOrQueryNotReady(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? '';
  const msg = String((err as Error)?.message ?? err);
  return (
    code === 'failed-precondition' ||
    msg.includes('index') ||
    msg.includes('building')
  );
}

function applyAccountFilter(rows: EmailThread[], accountId?: string | null): EmailThread[] {
  if (!accountId) return rows;
  return rows.filter((r) => r.accountId === accountId);
}

export function applyMailboxFolderFilter(
  rows: EmailThread[],
  folder: MailboxFolder
): EmailThread[] {
  return rows.filter((r) => (r.mailboxFolder ?? 'INBOX') === folder);
}

export function countThreadsByFolder(
  rows: EmailThread[],
  accountId?: string | null
): Record<MailboxFolder, number> {
  const counts: Record<MailboxFolder, number> = {
    INBOX: 0,
    SENT: 0,
    DRAFT: 0,
    TRASH: 0,
    ARCHIVE: 0,
  };
  for (const row of rows) {
    if (accountId && row.accountId !== accountId) continue;
    counts[row.mailboxFolder ?? 'INBOX']++;
  }
  return counts;
}

/**
 * Écoute temps réel des fils du courtier (tri : plus récent en premier).
 * Par défaut : requête simple + filtre `accountId` côté client (pas d’index composite requis).
 */
export function subscribeEmailThreads(
  brokerId: string,
  onUpdate: (threads: EmailThread[]) => void,
  onError?: (err: Error) => void,
  accountId?: string | null
): Unsubscribe {
  if (!brokerId) {
    onUpdate([]);
    return () => {};
  }

  const useServerFilter =
    import.meta.env.VITE_EMAIL_THREADS_SERVER_FILTER === 'true' &&
    Boolean(accountId && accountId.length > 0);

  let activeUnsub: Unsubscribe | null = null;

  const listen = (q: Query, clientFilter: boolean) => {
    activeUnsub?.();
    activeUnsub = onSnapshot(
      q,
      (snap) => {
        let rows = snap.docs.map((d) => mapThreadDoc(d.id, d.data() as Record<string, unknown>));
        if (clientFilter) rows = applyAccountFilter(rows, accountId);
        onUpdate(rows);
      },
      (err) => {
        if (useServerFilter && clientFilter === false && isIndexOrQueryNotReady(err)) {
          console.warn('[emailSync] index not ready — fallback client filter', err);
          listen(
            query(threadsCol(brokerId), orderBy('lastMessageAtMillis', 'desc'), limit(200)),
            true
          );
          return;
        }
        console.error('[emailSync] subscribe threads failed', err);
        onError?.(err as Error);
        onUpdate([]);
      }
    );
  };

  if (useServerFilter && accountId) {
    listen(
      query(
        threadsCol(brokerId),
        where('accountId', '==', accountId),
        orderBy('lastMessageAtMillis', 'desc'),
        limit(200)
      ),
      false
    );
  } else {
    listen(query(threadsCol(brokerId), orderBy('lastMessageAtMillis', 'desc'), limit(200)), true);
  }

  return () => {
    activeUnsub?.();
    activeUnsub = null;
  };
}

/** Écoute temps réel des messages d’un fil.
 *  Chemin SSOT (aligné backend) : users/{brokerId}/email_threads/{threadId}/messages
 */
export function subscribeThreadMessages(
  brokerId: string,
  threadId: string,
  onUpdate: (messages: EmailMessage[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!brokerId || !threadId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(messagesCol(brokerId, threadId), orderBy('sentAtMillis', 'asc'), limit(500));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) =>
        mapMessageDoc(d.id, threadId, d.data() as Record<string, unknown>)
      );
      onUpdate(rows);
    },
    (err) => {
      console.error('[emailSync] subscribe messages failed', err);
      onError?.(err);
      onUpdate([]);
    }
  );
}

/** Marque un fil comme lu. */
export async function markThreadRead(brokerId: string, threadId: string): Promise<void> {
  if (!brokerId || !threadId) return;
  await updateDoc(threadRef(brokerId, threadId), { isUnread: false });
}

/** Met à jour le dossier Firestore d’un fil (repli local / démo). */
export async function updateThreadMailboxFolder(
  brokerId: string,
  threadId: string,
  mailboxFolder: MailboxFolder
): Promise<void> {
  if (!brokerId || !threadId) return;
  await updateDoc(threadRef(brokerId, threadId), { mailboxFolder });
}

/**
 * Envoie un message sortant : ajoute dans `messages` et met à jour le fil parent.
 * `isUnread` du fil passe à false (conversation lue côté courtier).
 */
export async function sendMessage(
  brokerId: string,
  threadId: string,
  body: string,
  opts?: {
    authorName?: string;
    fromAccountId?: string;
    fromEmailAddress?: string;
    /** Si true, tente l’envoi via Nylas (Cloud Function) avant repli Firestore. */
    useNylas?: boolean;
    nylasGrantId?: string;
  }
): Promise<void> {
  const trimmed = body.trim();
  if (!brokerId || !threadId || !trimmed) return;

  if (opts?.useNylas && opts.fromAccountId && opts.nylasGrantId) {
    const { sendViaNylas, isNylasConfigured } = await import('./nylasClient');
    if (isNylasConfigured()) {
      await sendViaNylas({
        threadId,
        body: trimmed,
        accountId: opts.fromAccountId,
      });
      return;
    }
  }

  const sentAtMillis = Date.now();
  const snippet = trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed;

  await addDoc(messagesCol(brokerId, threadId), {
    threadId,
    body: trimmed,
    sentAtMillis,
    direction: 'outbound' satisfies EmailMessageDirection,
    authorId: brokerId,
    authorName: opts?.authorName ?? 'Moi',
    fromAccountId: opts?.fromAccountId ?? null,
    fromEmailAddress: opts?.fromEmailAddress ?? null,
    attachments: [],
    isOpened: false,
  });

  await updateDoc(threadRef(brokerId, threadId), {
    lastMessageSnippet: snippet,
    lastMessageAtMillis: sentAtMillis,
    lastMessageAt: serverTimestamp(),
    isUnread: false,
    mailboxFolder: 'SENT',
  });
}

/** Données de démo (VITE_USE_FICTITIOUS_DATA) si aucun fil n’existe. */
export async function seedDemoEmailThreadsIfEmpty(
  brokerId: string,
  displayName?: string,
  accountId?: string
): Promise<void> {
  if (!brokerId) return;
  const existing = await getDocs(query(threadsCol(brokerId), limit(1)));
  if (!existing.empty) return;

  const now = Date.now();
  const threadId = `demo-thread-${now}`;
  const brokerLabel = displayName?.split(' ')[0] ?? 'Courtier';
  const acc = accountId ?? 'acc_primary';

  await setDoc(threadRef(brokerId, threadId), {
    brokerId,
    accountId: acc,
    subject: 'Demande de visite — condo Ahuntsic',
    contactName: 'Julie Dupuis',
    contactEmail: 'julie.dupuis@email.com',
    lastMessageSnippet: 'Bonjour, je souhaite visiter le bien cette semaine…',
    lastMessageAtMillis: now - 3600_000,
    isUnread: true,
    propertyId: 'demo-2',
    propertyLabel: '456 Rue De La Commune',
    createdAtMillis: now - 86_400_000,
    mailboxFolder: 'INBOX',
  });

  await addDoc(messagesCol(brokerId, threadId), {
    threadId,
    body: `Bonjour ${brokerLabel},\n\nJe souhaite visiter le condo listé au 456 rue de la Commune. Je suis disponible en soirée cette semaine.\n\nMerci,\nJulie`,
    sentAtMillis: now - 3600_000,
    direction: 'inbound',
    authorName: 'Julie Dupuis',
    attachments: [
      {
        name: 'preapprobation.pdf',
        url: '#',
        mimeType: 'application/pdf',
        sizeBytes: 245_000,
      },
    ],
  });

  const thread2 = `demo-thread-plex-${now}`;
  await setDoc(threadRef(brokerId, thread2), {
    brokerId,
    accountId: acc,
    subject: 'Offre d\'achat — 4522 Rue de la Roche',
    contactName: 'Mathieu Tremblay',
    contactEmail: 'mathieu.t@agence.ca',
    lastMessageSnippet: 'Mes clients sont prêts à soumettre une promesse à 845k…',
    lastMessageAtMillis: now - 7200_000,
    isUnread: false,
    propertyId: 'demo-1',
    propertyLabel: '789 Ave Mont-Royal E',
    createdAtMillis: now - 172_800_000,
    mailboxFolder: 'INBOX',
  });

  await addDoc(messagesCol(brokerId, thread2), {
    threadId: thread2,
    body: 'Bonjour,\n\nSuite à l\'ACM, mes clients sont prêts à soumettre une promesse d\'achat à 845 000 $.\n\nMathieu',
    sentAtMillis: now - 7200_000,
    direction: 'inbound',
    authorName: 'Mathieu Tremblay',
  });
}

function summarizeMessageBody(body: string, max = 120): string {
  const plain = body.replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  return plain.length <= max ? plain : `${plain.slice(0, max - 1)}…`;
}

export type LinkEmailThreadContactContext = {
  contactEmail?: string;
  contactName?: string;
  messages?: ReadonlyArray<
    Pick<EmailMessage, 'id' | 'body' | 'summaryOneLine' | 'mailContactEmail'>
  >;
};

/** Lie un fil et ses messages à un contact CRM (Phase 2). */
export async function linkEmailThreadToContact(
  brokerId: string,
  threadId: string,
  contactId: string,
  messageIds: readonly string[],
  context?: LinkEmailThreadContactContext
): Promise<void> {
  if (!brokerId || !threadId || !contactId) return;

  const linkedAt = Date.now();
  const partyEmail = context?.contactEmail?.trim().toLowerCase();
  const partyName = context?.contactName?.trim();

  await updateDoc(threadRef(brokerId, threadId), {
    matchedContactId: contactId,
    updatedAt: serverTimestamp(),
  });

  await Promise.all(
    messageIds.map((messageId) => {
      const msgCtx = context?.messages?.find((m) => m.id === messageId);
      const summary =
        msgCtx?.summaryOneLine?.trim() ||
        (msgCtx?.body ? summarizeMessageBody(msgCtx.body) : '');
      const patch: Record<string, unknown> = {
        brokerId,
        matchedContactId: contactId,
        linkedContactAtMillis: linkedAt,
      };
      if (partyEmail) patch.mailContactEmail = partyEmail;
      if (partyName) patch.mailContactName = partyName;
      if (summary) patch.summaryOneLine = summary;
      return updateDoc(doc(messagesCol(brokerId, threadId), messageId), patch);
    })
  );
}

export async function unlinkEmailThreadFromContact(
  brokerId: string,
  threadId: string,
  messageIds: readonly string[]
): Promise<void> {
  if (!brokerId || !threadId) return;

  await updateDoc(threadRef(brokerId, threadId), {
    matchedContactId: null,
    updatedAt: serverTimestamp(),
  });

  await Promise.all(
    messageIds.map((messageId) =>
      updateDoc(doc(messagesCol(brokerId, threadId), messageId), {
        matchedContactId: null,
        linkedContactAtMillis: null,
      })
    )
  );
}

export type { EmailThread, EmailMessage, EmailAttachment };
