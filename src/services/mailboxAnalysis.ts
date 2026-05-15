/**
 * Persistance des analyses IA Mailbox (Phase E-2 durcie).
 *
 * Charte : aucun accès Firestore dans @primexpert/core/mail — ce module
 * est la couche unique d’écriture/lecture côté app.
 *
 * Chemin : users/{brokerId}/mailbox_analyses/{messageId}
 * (brokerId = uid Firebase Auth — aligné sur le modèle multi-tenant courtier.)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { MailParseResult } from '@primexpert/core/mail';

export const MAILBOX_ANALYSES_SUBCOLLECTION = 'mailbox_analyses';

export interface SavedMailboxAnalysis {
  messageId: string;
  mergedParse: MailParseResult;
  replyDraft: string | null;
  analyzedAtMillis: number;
  /** Résidence inventaire matchée (E-2 → fiche résidence). */
  matchedResidenceId?: string;
  /** Horodatage du dernier brouillon IA (E-4 relance). */
  replyDraftAtMillis?: number;
}

function analysisRef(brokerId: string, messageId: string) {
  return doc(db, 'users', brokerId, MAILBOX_ANALYSES_SUBCOLLECTION, messageId);
}

function isMailParseResult(x: unknown): x is MailParseResult {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (!o.lead || typeof o.lead !== 'object') return false;
  const lead = o.lead as Record<string, unknown>;
  return typeof lead.intent === 'string';
}

/**
 * Lit l’analyse persistée pour un message (retourne null si absente).
 */
export async function getMailboxAnalysis(
  brokerId: string,
  messageId: string
): Promise<SavedMailboxAnalysis | null> {
  if (!brokerId || !messageId) return null;
  try {
    const snap = await getDoc(analysisRef(brokerId, messageId));
    if (!snap.exists()) return null;
    const d = snap.data();
    if (!d?.mergedParse || !isMailParseResult(d.mergedParse)) return null;
    const reply =
      typeof d.replyDraft === 'string' && d.replyDraft.trim()
        ? d.replyDraft
        : null;
    const matched =
      typeof d.matchedResidenceId === 'string' && d.matchedResidenceId.trim()
        ? d.matchedResidenceId.trim()
        : undefined;
    return {
      messageId: String(d.messageId ?? messageId),
      mergedParse: d.mergedParse,
      replyDraft: reply,
      analyzedAtMillis:
        typeof d.analyzedAtMillis === 'number' ? d.analyzedAtMillis : 0,
      matchedResidenceId: matched,
      replyDraftAtMillis:
        typeof d.replyDraftAtMillis === 'number' ? d.replyDraftAtMillis : undefined,
    };
  } catch (e) {
    console.error('[mailboxAnalysis] get failed', e);
    return null;
  }
}

/**
 * Enregistre ou met à jour l’analyse (merge shallow — préserve les champs non envoyés).
 */
export async function saveMailboxAnalysis(
  brokerId: string,
  messageId: string,
  payload: {
    mergedParse: MailParseResult;
    replyDraft?: string | null;
    replyDraftAtMillis?: number | null;
  }
): Promise<void> {
  if (!brokerId || !messageId) return;
  const matchedId =
    typeof payload.mergedParse.residence?.matchedResidenceId === 'string'
      ? payload.mergedParse.residence.matchedResidenceId.trim()
      : '';

  const draftStr =
    typeof payload.replyDraft === 'string' ? payload.replyDraft.trim() : '';
  const draftAt =
    draftStr.length > 0
      ? (payload.replyDraftAtMillis ?? Date.now())
      : null;

  await setDoc(
    analysisRef(brokerId, messageId),
    {
      messageId,
      mergedParse: payload.mergedParse,
      replyDraft: payload.replyDraft ?? null,
      analyzedAtMillis: Date.now(),
      matchedResidenceId: matchedId,
      replyDraftAtMillis: draftAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Abonnement aux analyses courriel rattachées à une résidence (recherche indexée). */
export function subscribeMailboxAnalysesForResidence(
  brokerId: string,
  residenceId: string,
  onUpdate: (rows: SavedMailboxAnalysis[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const col = collection(db, 'users', brokerId, MAILBOX_ANALYSES_SUBCOLLECTION);
  const q = query(
    col,
    where('matchedResidenceId', '==', residenceId),
    orderBy('analyzedAtMillis', 'desc'),
    limit(30)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: SavedMailboxAnalysis[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        if (!data?.mergedParse || !isMailParseResult(data.mergedParse)) continue;
        const reply =
          typeof data.replyDraft === 'string' && data.replyDraft.trim()
            ? data.replyDraft
            : null;
        rows.push({
          messageId: String(data.messageId ?? d.id),
          mergedParse: data.mergedParse,
          replyDraft: reply,
          analyzedAtMillis:
            typeof data.analyzedAtMillis === 'number' ? data.analyzedAtMillis : 0,
          matchedResidenceId: residenceId,
          replyDraftAtMillis:
            typeof data.replyDraftAtMillis === 'number' ? data.replyDraftAtMillis : undefined,
        });
      }
      onUpdate(rows);
    },
    (e) => {
      console.error('[mailboxAnalysis] subscribe residence failed', e);
      onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  );
}

/** Snapshot récent (E-4 — stagnation & tableau de bord). */
export async function fetchRecentMailboxAnalyses(
  brokerId: string,
  limitN = 200
): Promise<SavedMailboxAnalysis[]> {
  if (!brokerId) return [];
  try {
    const col = collection(db, 'users', brokerId, MAILBOX_ANALYSES_SUBCOLLECTION);
    const q = query(col, orderBy('analyzedAtMillis', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    const rows: SavedMailboxAnalysis[] = [];
    for (const d of snap.docs) {
      const data = d.data();
      if (!data?.mergedParse || !isMailParseResult(data.mergedParse)) continue;
      const reply =
        typeof data.replyDraft === 'string' && data.replyDraft.trim()
          ? data.replyDraft
          : null;
      const matched =
        typeof data.matchedResidenceId === 'string' && data.matchedResidenceId.trim()
          ? data.matchedResidenceId.trim()
          : undefined;
      rows.push({
        messageId: String(data.messageId ?? d.id),
        mergedParse: data.mergedParse,
        replyDraft: reply,
        analyzedAtMillis:
          typeof data.analyzedAtMillis === 'number' ? data.analyzedAtMillis : 0,
        matchedResidenceId: matched,
        replyDraftAtMillis:
          typeof data.replyDraftAtMillis === 'number' ? data.replyDraftAtMillis : undefined,
      });
    }
    return rows;
  } catch (e) {
    console.error('[E-4] fetchRecentMailboxAnalyses', e);
    return [];
  }
}
