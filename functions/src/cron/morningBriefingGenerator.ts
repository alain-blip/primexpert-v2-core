/**
 * Briefing du matin + Radar à opportunités — exécution planifiée (prospection IA off-market).
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getDb } from '../lib/firestore';
import {
  radarDocIdForRecord,
  scoreRadarOpportunities,
  type RadarResidenceSignalInput,
} from './_vendored/radarOpportunitesEngine';
import {
  buildMorningBriefing,
  type MorningBriefingHotLeadCandidate,
  type MorningBriefingTask,
} from './_vendored/morningBriefing';
import type { HotLeadMessageLike } from './_vendored/hotLeadsEngine';

const TENANT_FIELD = 'courtiersResponsables';
const MESSAGE_SCAN_LIMIT = 120;

function parseDateLikeToMillis(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function pickCertificationDueMillis(doc: Record<string, unknown> | null): number | null {
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

function mapOccupancy(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  if (raw > 0 && raw <= 1) return raw * 100;
  return raw;
}

function buildRadarInputs(
  brokerId: string,
  residenceSnaps: QueryDocumentSnapshot[]
): RadarResidenceSignalInput[] {
  const out: RadarResidenceSignalInput[] = [];
  for (const snap of residenceSnaps) {
    const data = snap.data() as Record<string, unknown>;
    const ops = (data.operations as Record<string, unknown> | undefined) ?? {};
    const address = String(data.address ?? data.adresse ?? 'Adresse non renseignée').trim();
    const city = typeof data.city === 'string' ? data.city : typeof data.ville === 'string' ? data.ville : null;
    const tauxOccupation = mapOccupancy(data.tauxOccupation ?? data.taux_occupation ?? ops.tauxOccupation);
    const previousTauxOccupation = mapOccupancy(
      data.previousTauxOccupation ?? ops.previousTauxOccupation ?? data.tauxOccupationPrevious
    );
    const certificationDueMillis = pickCertificationDueMillis(data);
    out.push({
      residenceId: snap.id,
      address,
      city,
      brokerId,
      tauxOccupation,
      previousTauxOccupation,
      certificationDueMillis,
    });
  }
  return out;
}

async function loadBrokerMessages(
  brokerId: string
): Promise<HotLeadMessageLike[]> {
  const db = getDb();
  const threadsSnap = await db
    .collection('users')
    .doc(brokerId)
    .collection('email_threads')
    .limit(40)
    .get();
  const messages: HotLeadMessageLike[] = [];
  for (const threadDoc of threadsSnap.docs) {
    const msgSnap = await threadDoc.ref
      .collection('messages')
      .orderBy('sentAtMillis', 'desc')
      .limit(15)
      .get();
    for (const m of msgSnap.docs) {
      const d = m.data() as Record<string, unknown>;
      messages.push({
        id: m.id,
        body: typeof d.body === 'string' ? d.body : null,
        summaryOneLine: typeof d.summaryOneLine === 'string' ? d.summaryOneLine : null,
        sentAtMillis:
          typeof d.sentAtMillis === 'number' ? d.sentAtMillis : parseDateLikeToMillis(d.sentAt) ?? undefined,
        channel: (typeof d.channel === 'string' ? d.channel : 'email') as HotLeadMessageLike['channel'],
        direction: d.direction === 'outbound' ? 'outbound' : 'inbound',
        metadata: (d.metadata as Record<string, unknown> | null) ?? null,
      });
      if (messages.length >= MESSAGE_SCAN_LIMIT) return messages;
    }
  }
  return messages;
}

async function processBrokerMorningBriefing(params: {
  orgId: string;
  brokerId: string;
  now: number;
}): Promise<void> {
  const { orgId, brokerId, now } = params;
  const db = getDb();

  const residencesSnap = await db
    .collection('residences')
    .where(TENANT_FIELD, '==', brokerId)
    .limit(200)
    .get();

  const radarInputs = buildRadarInputs(brokerId, residencesSnap.docs);
  const radarHits = scoreRadarOpportunities(orgId, radarInputs, now);
  const radarCol = db.collection('organizations').doc(orgId).collection('prospects_radar');
  const batch = db.batch();
  const activeIds = new Set<string>();
  for (const hit of radarHits) {
    const docId = radarDocIdForRecord(hit);
    activeIds.add(docId);
    batch.set(
      radarCol.doc(docId),
      {
        ...hit,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  await batch.commit();

  const tasksSnap = await db
    .collection('organizations')
    .doc(orgId)
    .collection('tasks')
    .where('ownerId', '==', brokerId)
    .where('status', '==', 'a_faire')
    .limit(80)
    .get();

  const tasks: MorningBriefingTask[] = tasksSnap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      title: String(data.title ?? 'Tâche'),
      description: typeof data.description === 'string' ? data.description : null,
      dueAtMillis:
        typeof data.dueAtMillis === 'number'
          ? data.dueAtMillis
          : parseDateLikeToMillis(data.dueAt) ?? now,
      source: typeof data.source === 'string' ? data.source : null,
      priority: typeof data.priority === 'string' ? data.priority : null,
    };
  });

  const contactsSnap = await db
    .collection('organizations')
    .doc(orgId)
    .collection('contacts')
    .where('ownerId', '==', brokerId)
    .limit(60)
    .get();

  const allMessages = await loadBrokerMessages(brokerId);
  const hotLeadCandidates: MorningBriefingHotLeadCandidate[] = contactsSnap.docs.map((c) => {
    const data = c.data() as Record<string, unknown>;
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const displayName =
      [data.firstName, data.lastName].filter((x) => typeof x === 'string' && x.trim()).join(' ').trim() ||
      String(data.company ?? data.displayName ?? 'Contact');
    const contactMessages = email
      ? allMessages.filter((m) => {
          const meta = m.metadata ?? {};
          const from = String(meta.fromEmail ?? meta.from ?? '').toLowerCase();
          const to = String(meta.toEmail ?? meta.to ?? '').toLowerCase();
          return from.includes(email) || to.includes(email);
        })
      : [];
    return {
      contactId: c.id,
      displayName,
      messages: contactMessages.length > 0 ? contactMessages : allMessages.slice(0, 5),
    };
  });

  const briefing = buildMorningBriefing({
    orgId,
    brokerId,
    tasks,
    hotLeadCandidates,
    now,
  });

  await db
    .collection('organizations')
    .doc(orgId)
    .collection('morning_briefings')
    .doc(brokerId)
    .set(
      {
        ...briefing,
        radarHitsCount: radarHits.length,
        radarActiveDocIds: [...activeIds],
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

async function runMorningBriefingBatch(): Promise<void> {
  const db = getDb();
  const usersSnap = await db.collection('users').limit(500).get();
  const now = Date.now();
  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data() as Record<string, unknown>;
    const orgId = typeof data.orgId === 'string' ? data.orgId.trim() : '';
    if (!orgId) continue;
    const role = typeof data.role === 'string' ? data.role : 'member';
    if (role === 'admin_system') continue;
    try {
      await processBrokerMorningBriefing({ orgId, brokerId: userDoc.id, now });
    } catch (err) {
      console.error('[morningBriefingGenerator] broker failed', userDoc.id, err);
    }
  }
}

/** 06:00 America/Toronto — radar off-market + briefing courtier. */
export const morningBriefingGenerator = onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'America/Toronto',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    await runMorningBriefingBatch();
  }
);
