/**
 * Agrégation priorités J+7 pour le tableau de bord.
 */

import { doc, getDoc } from 'firebase/firestore';
import {
  computeDashboardPriorityFollowUps,
  groupPriorityFollowUpsByDueDate,
  type DashboardPriorityFollowUpItem,
  type DashboardPriorityResidenceInput,
} from '@primexpert/core/intelligence';
import { db } from '../lib/firebase';
import type { Residence } from './residences';
import type { CallAnalysisRow } from './transcriptionService';
import type { SavedMailboxAnalysis } from './mailboxAnalysis';

export type { DashboardPriorityFollowUpItem };

export async function fetchResidenceDocsMap(
  residenceIds: string[]
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  await Promise.all(
    residenceIds.map(async (id) => {
      const snap = await getDoc(doc(db, 'residences', id));
      if (snap.exists()) map.set(id, snap.data() as Record<string, unknown>);
    })
  );
  return map;
}

export function buildDashboardPriorityInputs(
  residences: readonly Residence[],
  docs: Map<string, Record<string, unknown>>,
  calls: readonly CallAnalysisRow[],
  mails: readonly SavedMailboxAnalysis[]
): DashboardPriorityResidenceInput[] {
  return residences.map((r) => ({
    id: r.id,
    address: r.address,
    city: r.city,
    doc: docs.get(r.id) ?? null,
    mails: mails
      .filter((m) => m.matchedResidenceId === r.id)
      .map((m) => ({
        messageId: m.messageId,
        analyzedAtMillis: m.analyzedAtMillis,
        contactName: m.mergedParse.lead.contactName,
        contactEmail: m.mergedParse.lead.email,
        intent: m.mergedParse.lead.intent,
        summaryOneLine: m.mergedParse.summaryOneLine,
      })),
    calls: calls
      .filter((c) => c.residenceId === r.id)
      .map((c) => ({
        driveDocumentId: c.driveDocumentId,
        updatedAtMillis: c.updatedAtMillis,
        executiveSummary: c.executiveSummary,
        keyPoints: c.keyPoints,
        actionItems: c.actionItems,
      })),
  }));
}

export function loadDashboardPriorityFollowUps(input: {
  residences: readonly Residence[];
  docs: Map<string, Record<string, unknown>>;
  calls: readonly CallAnalysisRow[];
  mails: readonly SavedMailboxAnalysis[];
  now?: number;
}): DashboardPriorityFollowUpItem[] {
  const rows = buildDashboardPriorityInputs(
    input.residences,
    input.docs,
    input.calls,
    input.mails
  );
  return computeDashboardPriorityFollowUps(rows, input.now);
}

export function groupDashboardPrioritiesByDate(
  items: readonly DashboardPriorityFollowUpItem[],
  locale: string
) {
  return groupPriorityFollowUpsByDueDate(items, locale);
}
