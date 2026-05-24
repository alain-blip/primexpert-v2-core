/**
 * Lecture des métadonnées d’analyse courriel — SSOT `email_threads/{id}/messages`.
 *
 * Les analyses sont produites à l’ingestion Nylas (Cloud Function + @primexpert/core/mail).
 * La collection legacy `mailbox_analyses` n’est plus alimentée (Phase 1).
 */

import {
  collectionGroup,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  MailContactIntent,
  MailParseResult,
  MailUrgency,
  ResidenceMatchConfidence,
} from '@primexpert/core/mail';
import { EMAIL_MESSAGES_SUBCOLLECTION } from './emailSyncService';

/** @deprecated Conservé pour compatibilité des imports UI — même chemin logique que messages. */
export const MAILBOX_ANALYSES_SUBCOLLECTION = 'mailbox_analyses';

export interface SavedMailboxAnalysis {
  messageId: string;
  mergedParse: MailParseResult;
  replyDraft: string | null;
  analyzedAtMillis: number;
  matchedResidenceId?: string;
  matchedContactId?: string;
  replyDraftAtMillis?: number;
}

function isMailIntent(x: unknown): x is MailContactIntent {
  return (
    x === 'buyer' ||
    x === 'seller' ||
    x === 'peer' ||
    x === 'agency' ||
    x === 'unknown'
  );
}

function isMailUrgency(x: unknown): x is MailUrgency {
  return x === 'low' || x === 'medium' || x === 'high';
}

function isConfidence(x: unknown): x is ResidenceMatchConfidence {
  return x === 'high' || x === 'medium' || x === 'low' || x === 'none';
}

function resolveTimelineSortMillis(data: Record<string, unknown>): number {
  if (typeof data.mailAnalysisAtMillis === 'number' && data.mailAnalysisAtMillis > 0) {
    return data.mailAnalysisAtMillis;
  }
  const linked =
    typeof data.matchedContactId === 'string' && data.matchedContactId.trim().length > 0;
  if (!linked) return 0;
  if (typeof data.linkedContactAtMillis === 'number' && data.linkedContactAtMillis > 0) {
    return data.linkedContactAtMillis;
  }
  if (typeof data.sentAtMillis === 'number' && data.sentAtMillis > 0) {
    return data.sentAtMillis;
  }
  return 0;
}

function mapMessageToSaved(docId: string, data: Record<string, unknown>): SavedMailboxAnalysis | null {
  const analyzedAtMillis = resolveTimelineSortMillis(data);
  if (analyzedAtMillis <= 0) return null;

  const matchedRaw =
    typeof data.matchedResidenceId === 'string' ? data.matchedResidenceId.trim() : '';
  const matchedResidenceId = matchedRaw || undefined;
  const contactRaw =
    typeof data.matchedContactId === 'string' ? data.matchedContactId.trim() : '';
  const matchedContactId = contactRaw || undefined;

  const intent = isMailIntent(data.mailIntent) ? data.mailIntent : 'unknown';
  const urgency = isMailUrgency(data.mailUrgency) ? data.mailUrgency : 'low';
  const confidence: ResidenceMatchConfidence = matchedResidenceId ? 'medium' : 'none';

  const mergedParse: MailParseResult = {
    lead: {
      contactName:
        typeof data.mailContactName === 'string' && data.mailContactName.trim()
          ? data.mailContactName.trim()
          : null,
      phone: null,
      email:
        typeof data.mailContactEmail === 'string' && data.mailContactEmail.trim()
          ? data.mailContactEmail.trim().toLowerCase()
          : null,
      intent,
    },
    residence: {
      matchedResidenceId: matchedRaw || null,
      mentionedAddress: null,
      matchConfidence: isConfidence(data.mailMatchConfidence)
        ? data.mailMatchConfidence
        : confidence,
    },
    urgency,
    summaryOneLine:
      typeof data.summaryOneLine === 'string' ? data.summaryOneLine : '',
  };

  return {
    messageId: docId,
    mergedParse,
    replyDraft: null,
    analyzedAtMillis,
    matchedResidenceId,
    matchedContactId,
  };
}

function messagesAnalysisQuery(brokerId: string) {
  return query(
    collectionGroup(db, EMAIL_MESSAGES_SUBCOLLECTION),
    where('brokerId', '==', brokerId),
    orderBy('mailAnalysisAtMillis', 'desc')
  );
}

/** Abonnement aux courriels analysés rattachés à une résidence. */
export function subscribeMailboxAnalysesForResidence(
  brokerId: string,
  residenceId: string,
  onUpdate: (rows: SavedMailboxAnalysis[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const q = query(
    collectionGroup(db, EMAIL_MESSAGES_SUBCOLLECTION),
    where('brokerId', '==', brokerId),
    where('matchedResidenceId', '==', residenceId),
    orderBy('mailAnalysisAtMillis', 'desc'),
    limit(30)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: SavedMailboxAnalysis[] = [];
      for (const d of snap.docs) {
        const row = mapMessageToSaved(d.id, d.data() as Record<string, unknown>);
        if (row) rows.push(row);
      }
      onUpdate(rows);
    },
    (e) => {
      console.error('[mailboxAnalysis] subscribe residence failed', e);
      onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  );
}

function isMissingFirestoreIndexError(e: unknown): boolean {
  const code =
    e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '';
  const msg = e instanceof Error ? e.message : String(e);
  return code === 'failed-precondition' || msg.includes('requires an index');
}

/** Repli client si l’index composite n’est pas encore déployé (brokerId + mailAnalysisAtMillis). */
async function fetchRecentMailboxAnalysesFallback(
  brokerId: string,
  limitN: number
): Promise<SavedMailboxAnalysis[]> {
  const q = query(
    collectionGroup(db, EMAIL_MESSAGES_SUBCOLLECTION),
    where('brokerId', '==', brokerId),
    limit(Math.min(limitN * 3, 500))
  );
  const snap = await getDocs(q);
  const rows: SavedMailboxAnalysis[] = [];
  for (const d of snap.docs) {
    const row = mapMessageToSaved(d.id, d.data() as Record<string, unknown>);
    if (row) rows.push(row);
  }
  rows.sort((a, b) => b.analyzedAtMillis - a.analyzedAtMillis);
  return rows.slice(0, limitN);
}

/** Snapshot récent (priorités tableau de bord, stagnation). */
export async function fetchRecentMailboxAnalyses(
  brokerId: string,
  limitN = 200
): Promise<SavedMailboxAnalysis[]> {
  if (!brokerId) return [];
  try {
    const q = query(messagesAnalysisQuery(brokerId), limit(limitN));
    const snap = await getDocs(q);
    const rows: SavedMailboxAnalysis[] = [];
    for (const d of snap.docs) {
      const row = mapMessageToSaved(d.id, d.data() as Record<string, unknown>);
      if (row) rows.push(row);
    }
    return rows;
  } catch (e) {
    if (isMissingFirestoreIndexError(e)) {
      console.warn(
        '[mailboxAnalysis] index composite manquant — repli sans orderBy; déployez firestore:indexes.'
      );
      try {
        return await fetchRecentMailboxAnalysesFallback(brokerId, limitN);
      } catch (fallbackErr) {
        console.error('[mailboxAnalysis] fetchRecent fallback failed', fallbackErr);
        return [];
      }
    }
    console.error('[mailboxAnalysis] fetchRecent failed', e);
    return [];
  }
}

/** Courriels explicitement liés à un contact CRM (Phase 2 messagerie). */
export async function fetchMailboxAnalysesLinkedToContact(
  brokerId: string,
  contactId: string,
  limitN = 50
): Promise<SavedMailboxAnalysis[]> {
  if (!brokerId || !contactId) return [];
  try {
    const q = query(
      collectionGroup(db, EMAIL_MESSAGES_SUBCOLLECTION),
      where('brokerId', '==', brokerId),
      where('matchedContactId', '==', contactId),
      limit(limitN)
    );
    const snap = await getDocs(q);
    const rows: SavedMailboxAnalysis[] = [];
    for (const d of snap.docs) {
      const row = mapMessageToSaved(d.id, d.data() as Record<string, unknown>);
      if (row) rows.push(row);
    }
    rows.sort((a, b) => b.analyzedAtMillis - a.analyzedAtMillis);
    return rows;
  } catch (e) {
    if (isMissingFirestoreIndexError(e)) {
      console.warn(
        '[mailboxAnalysis] index matchedContactId manquant — repli scan brokerId.'
      );
      try {
        const q = query(
          collectionGroup(db, EMAIL_MESSAGES_SUBCOLLECTION),
          where('brokerId', '==', brokerId),
          limit(500)
        );
        const snap = await getDocs(q);
        const rows: SavedMailboxAnalysis[] = [];
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>;
          if (data.matchedContactId !== contactId) continue;
          const row = mapMessageToSaved(d.id, data);
          if (row) rows.push(row);
        }
        rows.sort((a, b) => b.analyzedAtMillis - a.analyzedAtMillis);
        return rows.slice(0, limitN);
      } catch (fallbackErr) {
        console.error('[mailboxAnalysis] fetchLinkedToContact fallback failed', fallbackErr);
        return [];
      }
    }
    console.error('[mailboxAnalysis] fetchLinkedToContact failed', e);
    return [];
  }
}
