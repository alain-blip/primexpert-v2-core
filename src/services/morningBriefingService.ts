/**
 * Briefing du matin + Radar à opportunités — chargement tableau de bord.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import {
  buildMorningBriefing,
  RADAR_OPPORTUNITIES_IDLE_MESSAGE_FR,
  RADAR_OPPORTUNITIES_IDLE_MESSAGE_EN,
  type MorningBriefingPayload,
  type MorningBriefingTask,
  type MorningBriefingHotLeadCandidate,
  type RadarOpportunityRecord,
} from '@primexpert/core/crm';
import { db } from '../lib/firebase';
import { buildContactDisplayName } from '@primexpert/core/crm';
import {
  listOrganizationContacts,
  type ContactServiceContext,
  type OrganizationContact,
} from './contacts';
import type { SavedMailboxAnalysis } from './mailboxAnalysis';
import type { Residence } from './residences';

export { RADAR_OPPORTUNITIES_IDLE_MESSAGE_FR, RADAR_OPPORTUNITIES_IDLE_MESSAGE_EN };

function parseTaskDoc(id: string, data: Record<string, unknown>): MorningBriefingTask {
  const dueAtMillis =
    typeof data.dueAtMillis === 'number' && Number.isFinite(data.dueAtMillis)
      ? data.dueAtMillis
      : Date.now();
  return {
    id,
    title: String(data.title ?? 'Tâche'),
    description: typeof data.description === 'string' ? data.description : null,
    dueAtMillis,
    source: typeof data.source === 'string' ? data.source : null,
    priority: typeof data.priority === 'string' ? data.priority : null,
  };
}

export async function fetchOrganizationTasksForBroker(
  orgId: string,
  brokerId: string
): Promise<MorningBriefingTask[]> {
  if (!orgId.trim() || !brokerId.trim()) return [];
  const snap = await getDocs(
    query(
      collection(db, 'organizations', orgId, 'tasks'),
      where('ownerId', '==', brokerId),
      where('status', '==', 'a_faire'),
      limit(80)
    )
  );
  return snap.docs.map((d) => parseTaskDoc(d.id, d.data() as Record<string, unknown>));
}

export async function fetchProspectsRadar(
  orgId: string,
  max = 12
): Promise<RadarOpportunityRecord[]> {
  if (!orgId.trim()) return [];
  const snap = await getDocs(
    query(collection(db, 'organizations', orgId, 'prospects_radar'), limit(max))
  );
  const rows = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      orgId: String(data.orgId ?? orgId),
      brokerId: String(data.brokerId ?? ''),
      residenceId: String(data.residenceId ?? ''),
      signalType: data.signalType as RadarOpportunityRecord['signalType'],
      score: Number(data.score) || 0,
      propertyLabel: String(data.propertyLabel ?? ''),
      titleFr: String(data.titleFr ?? ''),
      titleEn: String(data.titleEn ?? ''),
      summaryFr: String(data.summaryFr ?? ''),
      summaryEn: String(data.summaryEn ?? ''),
      detectedAtMillis: Number(data.detectedAtMillis) || 0,
    } satisfies RadarOpportunityRecord;
  });
  return rows.sort((a, b) => b.score - a.score);
}

export async function fetchPersistedMorningBriefing(
  orgId: string,
  brokerId: string
): Promise<MorningBriefingPayload | null> {
  if (!orgId.trim() || !brokerId.trim()) return null;
  const snap = await getDoc(
    doc(db, 'organizations', orgId, 'morning_briefings', brokerId)
  );
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  return {
    dateKey: String(data.dateKey ?? ''),
    generatedAtMillis: Number(data.generatedAtMillis) || 0,
    brokerId: String(data.brokerId ?? brokerId),
    orgId: String(data.orgId ?? orgId),
    criticalTasks: Array.isArray(data.criticalTasks) ? (data.criticalTasks as MorningBriefingPayload['criticalTasks']) : [],
    appointments: Array.isArray(data.appointments) ? (data.appointments as MorningBriefingPayload['appointments']) : [],
    hotLeadsTop3: Array.isArray(data.hotLeadsTop3) ? (data.hotLeadsTop3 as MorningBriefingPayload['hotLeadsTop3']) : [],
  };
}

function buildHotLeadCandidatesFromMailbox(
  contacts: readonly OrganizationContact[],
  mails: readonly SavedMailboxAnalysis[]
): MorningBriefingHotLeadCandidate[] {
  return contacts.map((contact) => {
    const displayName = buildContactDisplayName(contact);
    const email = contact.email?.trim().toLowerCase() ?? '';
    const contactMails = email
      ? mails.filter((m) => {
          const leadEmail = m.mergedParse.lead.email?.trim().toLowerCase() ?? '';
          return leadEmail === email;
        })
      : mails.filter((m) => m.mergedParse.lead.contactName === displayName).slice(0, 8);

    return {
      contactId: contact.id,
      displayName,
      messages: contactMails.map((mail) => ({
        id: mail.messageId,
        summaryOneLine: mail.mergedParse.summaryOneLine,
        body: mail.mergedParse.summaryOneLine,
        channel: 'email' as const,
        direction: 'inbound' as const,
        sentAtMillis: mail.analyzedAtMillis,
        metadata: {
          financialReportClicked: /rapport financier|financial report/i.test(
            mail.mergedParse.summaryOneLine ?? ''
          ),
        },
      })),
    };
  });
}

export interface MorningBriefingDashboardData {
  briefing: MorningBriefingPayload;
  radarHits: RadarOpportunityRecord[];
  radarIdleMessageFr: string;
  radarIdleMessageEn: string;
}

export async function loadMorningBriefingDashboardData(input: {
  orgId: string;
  brokerId: string;
  role: ContactServiceContext['role'];
  residences: readonly Residence[];
  mails: readonly SavedMailboxAnalysis[];
  locale?: 'fr' | 'en';
}): Promise<MorningBriefingDashboardData> {
  const ctx: ContactServiceContext = { orgId: input.orgId, uid: input.brokerId, role: input.role };
  const [tasks, radarHits, contacts, persisted] = await Promise.all([
    fetchOrganizationTasksForBroker(input.orgId, input.brokerId),
    fetchProspectsRadar(input.orgId),
    listOrganizationContacts(ctx),
    fetchPersistedMorningBriefing(input.orgId, input.brokerId),
  ]);

  const hotLeadCandidates = buildHotLeadCandidatesFromMailbox(contacts, input.mails);
  const liveBriefing = buildMorningBriefing({
    orgId: input.orgId,
    brokerId: input.brokerId,
    tasks,
    hotLeadCandidates,
  });

  const todayKey = liveBriefing.dateKey;
  const briefing =
    persisted?.dateKey === todayKey && persisted.hotLeadsTop3.length > 0
      ? {
          ...liveBriefing,
          appointments:
            persisted.appointments.length > 0 ? persisted.appointments : liveBriefing.appointments,
          hotLeadsTop3: persisted.hotLeadsTop3,
        }
      : liveBriefing;

  return {
    briefing,
    radarHits,
    radarIdleMessageFr: RADAR_OPPORTUNITIES_IDLE_MESSAGE_FR,
    radarIdleMessageEn: RADAR_OPPORTUNITIES_IDLE_MESSAGE_EN,
  };
}
