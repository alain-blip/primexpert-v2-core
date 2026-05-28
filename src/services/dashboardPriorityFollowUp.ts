/**
 * Agrégation priorités J+7 pour le tableau de bord.
 */

import { doc, getDoc } from 'firebase/firestore';
import {
  computeDashboardPriorityFollowUps,
  groupPriorityFollowUpsByDueDate,
  type DashboardPriorityFollowUpItem as CoreDashboardPriorityFollowUpItem,
  type DashboardPriorityResidenceInput,
} from '@primexpert/core/intelligence';
import { db } from '../lib/firebase';
import type { Residence } from './residences';
import type { CallAnalysisRow } from './transcriptionService';
import type { SavedMailboxAnalysis } from './mailboxAnalysis';

const HOT_LEAD_URGENCY_THRESHOLD_DAYS = 3;
const CERTIFICATION_ALERT_THRESHOLD_DAYS = 45;

export type DashboardPriorityFollowUpItem = DashboardPriorityFollowUpItemCore & {
  briefingKind?: 'standard' | 'hot_lead' | 'certification';
};

type DashboardPriorityFollowUpItemCore = CoreDashboardPriorityFollowUpItem;

function parseDateLikeToMillis(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function pickCertificationDueMillis(doc: Record<string, unknown> | null | undefined): number | null {
  if (!doc) return null;
  const candidates: unknown[] = [
    doc.certificationCiusssEcheance,
    doc.certificationsCiusssEcheance,
    doc.certificationCiusssTransferDueDate,
    doc.certificationMsssEcheance,
    doc.msssTransferPermitDueDate,
  ];
  for (const candidate of candidates) {
    const ms = parseDateLikeToMillis(candidate);
    if (ms != null) return ms;
  }
  return null;
}

function buildHotLeadPriorities(
  residences: readonly Residence[],
  mails: readonly SavedMailboxAnalysis[],
  now: number
): DashboardPriorityFollowUpItem[] {
  const cutoff = now - HOT_LEAD_URGENCY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const rows: DashboardPriorityFollowUpItem[] = [];
  for (const residence of residences) {
    const residenceMails = mails
      .filter((m) => m.matchedResidenceId === residence.id && m.analyzedAtMillis >= cutoff)
      .sort((a, b) => b.analyzedAtMillis - a.analyzedAtMillis);
    if (residenceMails.length === 0) continue;
    const candidate = residenceMails.find((m) => m.mergedParse.urgency === 'high') ?? residenceMails[0];
    const hasHotSignal =
      candidate.mergedParse.urgency === 'high' ||
      candidate.mergedParse.intent === 'buyer';
    if (!hasHotSignal) continue;

    const buyerName = candidate.mergedParse.lead.contactName?.trim() || 'Contact prioritaire';
    const buyerEmail = candidate.mergedParse.lead.email?.trim() || null;
    const propertyName = residence.city ? `${residence.address}, ${residence.city}` : residence.address;
    const signalSummary =
      candidate.mergedParse.summaryOneLine?.trim() || 'Activité récente détectée sur le dossier.';
    rows.push({
      id: `hotlead-${residence.id}-${candidate.messageId}`,
      residenceId: residence.id,
      step: 'j3',
      dueDateMs: now,
      title: '🔥 Relance urgente — piste chaude',
      actionText: `Suivi de dossier prioritaire: ${signalSummary}`,
      buyerFullName: buyerName,
      buyerCompany: null,
      buyerEmail,
      buyerPhone: null,
      propertyName,
      briefingKind: 'hot_lead',
    });
  }
  return rows;
}

function buildCertificationPriorities(
  residences: readonly Residence[],
  docs: Map<string, Record<string, unknown>>,
  now: number
): DashboardPriorityFollowUpItem[] {
  const maxDue = now + CERTIFICATION_ALERT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const rows: DashboardPriorityFollowUpItem[] = [];
  for (const residence of residences) {
    const doc = docs.get(residence.id) ?? null;
    const dueMs = pickCertificationDueMillis(doc);
    if (dueMs == null || dueMs < now || dueMs > maxDue) continue;
    const propertyName = residence.city ? `${residence.address}, ${residence.city}` : residence.address;
    rows.push({
      id: `certif-${residence.id}-${dueMs}`,
      residenceId: residence.id,
      step: 'j3',
      dueDateMs: dueMs,
      title: '⚠️ Échéance certification MSSS / CIUSSS',
      actionText:
        'Vérification de conformité requise: préparer le suivi de transfert de permis et valider les pièces au dossier.',
      buyerFullName: 'Dossier administratif',
      buyerCompany: null,
      buyerEmail: null,
      buyerPhone: null,
      propertyName,
      briefingKind: 'certification',
    });
  }
  return rows;
}

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
  const now = input.now ?? Date.now();
  const rows = buildDashboardPriorityInputs(
    input.residences,
    input.docs,
    input.calls,
    input.mails
  );
  const base = computeDashboardPriorityFollowUps(rows, now).map((item) => ({
    ...item,
    briefingKind: 'standard' as const,
  }));
  const hotLeads = buildHotLeadPriorities(input.residences, input.mails, now);
  const certifications = buildCertificationPriorities(input.residences, input.docs, now);
  return [...base, ...hotLeads, ...certifications].sort((a, b) => a.dueDateMs - b.dueDateMs);
}

export function groupDashboardPrioritiesByDate(
  items: readonly DashboardPriorityFollowUpItem[],
  locale: string
) {
  return groupPriorityFollowUpsByDueDate(items, locale);
}
