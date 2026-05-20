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

function mapMessageToSaved(docId: string, data: Record<string, unknown>): SavedMailboxAnalysis | null {
  const analyzedAtMillis =
    typeof data.mailAnalysisAtMillis === 'number' ? data.mailAnalysisAtMillis : 0;
  if (analyzedAtMillis <= 0) return null;

  const matchedRaw =
    typeof data.matchedResidenceId === 'string' ? data.matchedResidenceId.trim() : '';
  const matchedResidenceId = matchedRaw || undefined;

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
    console.error('[mailboxAnalysis] fetchRecent failed', e);
    return [];
  }
}
