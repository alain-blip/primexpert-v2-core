/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/crm/
 * Régénéré : functions/scripts/sync-core-crm.cjs (prebuild)
 */
/**
 * Briefing du matin — agrégation priorités (hub omnicanal, rendez-vous, hot leads).
 */

import { calculateHotLeadScore, extractHotLeadSignalsFromMessages, type HotLeadMessageLike } from './hotLeadsEngine';

export interface MorningBriefingTask {
  id: string;
  title: string;
  description?: string | null;
  dueAtMillis: number;
  source?: string | null;
  priority?: string | null;
}

export interface MorningBriefingAppointment {
  id: string;
  title: string;
  startAtMillis: number;
  source?: string | null;
}

export interface MorningBriefingHotLead {
  contactId: string;
  displayName: string;
  score: number;
  summary: string;
}

export interface MorningBriefingPayload {
  dateKey: string;
  generatedAtMillis: number;
  brokerId: string;
  orgId: string;
  criticalTasks: MorningBriefingTask[];
  appointments: MorningBriefingAppointment[];
  hotLeadsTop3: MorningBriefingHotLead[];
}

export interface MorningBriefingHotLeadCandidate {
  contactId: string;
  displayName: string;
  messages: readonly HotLeadMessageLike[];
}

function todayDateKey(now: number, timeZone = 'America/Toronto'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(now));
}

function isSameLocalDay(ms: number, now: number, timeZone = 'America/Toronto'): boolean {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date(ms)) === fmt.format(new Date(now));
}

function isCriticalTask(task: MorningBriefingTask): boolean {
  const p = (task.priority ?? '').toLowerCase();
  const src = (task.source ?? '').toLowerCase();
  return (
    p === 'haute' ||
    p === 'high' ||
    src.includes('omnichannel') ||
    src.includes('sms_critical') ||
    src.includes('voice_intent')
  );
}

function isAppointmentTask(task: MorningBriefingTask): boolean {
  const src = (task.source ?? '').toLowerCase();
  const title = task.title.toLowerCase();
  return (
    src.includes('calendar') ||
    src.includes('rendez') ||
    title.includes('rendez-vous') ||
    title.includes('appointment') ||
    title.includes('visite')
  );
}

/**
 * Construit le briefing du matin à partir des tâches org et candidats hot leads.
 */
export function buildMorningBriefing(input: {
  orgId: string;
  brokerId: string;
  tasks: readonly MorningBriefingTask[];
  hotLeadCandidates: readonly MorningBriefingHotLeadCandidate[];
  now?: number;
}): MorningBriefingPayload {
  const now = input.now ?? Date.now();
  const criticalTasks = input.tasks
    .filter((t) => isCriticalTask(t))
    .sort((a, b) => a.dueAtMillis - b.dueAtMillis);

  const appointments = input.tasks
    .filter((t) => isAppointmentTask(t) && isSameLocalDay(t.dueAtMillis, now))
    .map((t) => ({
      id: t.id,
      title: t.title,
      startAtMillis: t.dueAtMillis,
      source: t.source ?? null,
    }))
    .sort((a, b) => a.startAtMillis - b.startAtMillis);

  const hotLeadsTop3 = input.hotLeadCandidates
    .map((c) => {
      const signals = extractHotLeadSignalsFromMessages(c.messages);
      const score = calculateHotLeadScore({ signals }).score;
      return {
        contactId: c.contactId,
        displayName: c.displayName,
        score,
        summary:
          c.messages.find((m) => m.summaryOneLine?.trim())?.summaryOneLine?.trim() ??
          'Activité récente détectée',
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    dateKey: todayDateKey(now),
    generatedAtMillis: now,
    brokerId: input.brokerId,
    orgId: input.orgId,
    criticalTasks,
    appointments,
    hotLeadsTop3,
  };
}
