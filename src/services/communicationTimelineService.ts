/**
 * Chargement lecture seule — chronologie omnicanale (messages email_threads + Vertex call_analyses).
 */

import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import {
  dedupeTimelineMails,
  getContactTimelineEvents,
  getResidencePartiesTimelineEvents,
  type TimelineCallInput,
  type TimelineMailInput,
  type UnifiedTimelineEvent,
} from '@primexpert/core/intelligence';
import { db } from '../lib/firebase';
import {
  CALL_ANALYSES_SUBCOLLECTION,
  fetchRecentCallAnalyses,
  type CallAnalysisRow,
} from './transcriptionService';
import {
  fetchMailboxAnalysesLinkedToContact,
  fetchRecentMailboxAnalyses,
  type SavedMailboxAnalysis,
} from './mailboxAnalysis';

const PARTY_MAIL_SCAN_LIMIT = 120;
const FIRESTORE_IN_MAX = 10;

function toMailInput(m: SavedMailboxAnalysis): TimelineMailInput {
  return {
    messageId: m.messageId,
    analyzedAtMillis: m.analyzedAtMillis,
    contactEmail: m.mergedParse.lead.email,
    contactName: m.mergedParse.lead.contactName,
    summaryOneLine: m.mergedParse.summaryOneLine,
    intent: m.mergedParse.lead.intent,
    matchedResidenceId: m.matchedResidenceId,
    matchedContactId: m.matchedContactId ?? null,
  };
}

function toCallInput(c: CallAnalysisRow): TimelineCallInput {
  return {
    driveDocumentId: c.driveDocumentId,
    updatedAtMillis: c.updatedAtMillis,
    residenceId: c.residenceId,
    fileName: c.fileName,
    pipelineStatus: c.pipelineStatus,
    executiveSummary: c.executiveSummary,
  };
}

/** Appels liés à une ou plusieurs résidences (requête `in`, max 10 IDs par batch). */
export async function fetchCallAnalysesForResidenceIds(
  brokerId: string,
  residenceIds: string[]
): Promise<CallAnalysisRow[]> {
  const ids = [...new Set(residenceIds.filter(Boolean))];
  if (!brokerId || ids.length === 0) return [];

  const col = collection(db, 'users', brokerId, CALL_ANALYSES_SUBCOLLECTION);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += FIRESTORE_IN_MAX) {
    chunks.push(ids.slice(i, i + FIRESTORE_IN_MAX));
  }

  const byDoc = new Map<string, CallAnalysisRow>();
  for (const chunk of chunks) {
    const q =
      chunk.length === 1
        ? query(
            col,
            where('residenceId', '==', chunk[0]),
            orderBy('updatedAtMillis', 'desc'),
            limit(25)
          )
        : query(
            col,
            where('residenceId', 'in', chunk),
            orderBy('updatedAtMillis', 'desc'),
            limit(25)
          );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>;
      byDoc.set(d.id, {
        driveDocumentId: d.id,
        residenceId: String(data.residenceId ?? ''),
        fileName: String(data.fileName ?? ''),
        pipelineStatus: data.pipelineStatus as CallAnalysisRow['pipelineStatus'],
        updatedAtMillis:
          typeof data.updatedAtMillis === 'number' ? data.updatedAtMillis : 0,
        executiveSummary:
          typeof data.executiveSummary === 'string' ? data.executiveSummary : undefined,
        errorMessage: typeof data.errorMessage === 'string' ? data.errorMessage : undefined,
      });
    }
  }
  return Array.from(byDoc.values()).sort((a, b) => b.updatedAtMillis - a.updatedAtMillis);
}

/**
 * Courriels complémentaires : un seul scan récent, filtré côté client par emails des intervenants.
 * (Scan récent des messages analysés — filtre client par courriel intervenant.)
 */
export async function fetchPartySupplementMails(
  brokerId: string,
  partyEmails: string[],
  excludeMessageIds: Set<string>
): Promise<SavedMailboxAnalysis[]> {
  if (!brokerId || partyEmails.length === 0) return [];
  const emailSet = new Set(partyEmails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')));
  if (emailSet.size === 0) return [];

  const recent = await fetchRecentMailboxAnalyses(brokerId, PARTY_MAIL_SCAN_LIMIT);
  return recent.filter((m) => {
    if (excludeMessageIds.has(m.messageId)) return false;
    const em = m.mergedParse.lead.email?.trim().toLowerCase();
    return em != null && emailSet.has(em);
  });
}

export async function buildContactTimeline(
  brokerId: string,
  contact: { id?: string; email?: string; residenceIds?: string[] }
): Promise<UnifiedTimelineEvent[]> {
  const [mailsRecent, mailsLinked, callsByResidence, callsRecent] = await Promise.all([
    fetchRecentMailboxAnalyses(brokerId, 200),
    contact.id
      ? fetchMailboxAnalysesLinkedToContact(brokerId, contact.id, 80)
      : Promise.resolve([]),
    contact.residenceIds?.length
      ? fetchCallAnalysesForResidenceIds(brokerId, contact.residenceIds)
      : Promise.resolve([]),
    fetchRecentCallAnalyses(brokerId, 80),
  ]);
  const mails = dedupeTimelineMails([...mailsRecent, ...mailsLinked]);

  const residenceIdSet = new Set(contact.residenceIds ?? []);
  const callsMerged = [...callsByResidence];
  for (const c of callsRecent) {
    if (residenceIdSet.has(c.residenceId) && !callsMerged.some((x) => x.driveDocumentId === c.driveDocumentId)) {
      callsMerged.push(c);
    }
  }

  return getContactTimelineEvents({
    contactId: contact.id,
    contactEmail: contact.email,
    residenceIds: contact.residenceIds,
    mails: mails.map(toMailInput),
    calls: callsMerged.map(toCallInput),
  });
}

export function buildResidencePartiesTimeline(
  residenceId: string,
  partyEmails: string[],
  residenceMails: SavedMailboxAnalysis[],
  supplementMails: SavedMailboxAnalysis[],
  calls: CallAnalysisRow[]
): UnifiedTimelineEvent[] {
  const mails = dedupeTimelineMails([...residenceMails, ...supplementMails]);
  return getResidencePartiesTimelineEvents({
    residenceId,
    partyEmails,
    mails: mails.map(toMailInput),
    calls: calls.map(toCallInput),
  });
}
