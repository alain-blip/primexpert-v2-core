/**
 * Agrégation chronologie omnicanale (lecture seule) — Nylas / Vertex existants.
 * Ne crée pas interactionEvents ; ne modifie pas email_threads.
 */

export type TimelineChannel = 'nylas_mail' | 'vertex_call';

export interface TimelineMailInput {
  messageId: string;
  analyzedAtMillis: number;
  contactEmail?: string | null;
  contactName?: string | null;
  summaryOneLine?: string | null;
  intent?: string | null;
  matchedResidenceId?: string | null;
}

export interface TimelineCallInput {
  driveDocumentId: string;
  updatedAtMillis: number;
  residenceId: string;
  fileName?: string | null;
  pipelineStatus?: string | null;
  executiveSummary?: string | null;
}

export interface UnifiedTimelineEvent {
  id: string;
  channel: TimelineChannel;
  sortMs: number;
  title: string;
  subtitle: string;
  detail?: string | null;
  statusLabel?: string | null;
  residenceId?: string | null;
  contactEmail?: string | null;
}

export function normalizeContactEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const v = email.trim().toLowerCase();
  return v.includes('@') ? v : null;
}

function mailMatchesEmail(mail: TimelineMailInput, emailNorm: string): boolean {
  const lead = normalizeContactEmail(mail.contactEmail);
  return lead === emailNorm;
}

function callMatchesContactResidences(
  call: TimelineCallInput,
  residenceIds: readonly string[]
): boolean {
  if (!residenceIds.length) return false;
  return residenceIds.includes(call.residenceId);
}

export function mailToTimelineEvent(mail: TimelineMailInput): UnifiedTimelineEvent {
  return {
    id: `mail-${mail.messageId}`,
    channel: 'nylas_mail',
    sortMs: mail.analyzedAtMillis,
    title: mail.contactName?.trim() || mail.contactEmail?.trim() || 'Courriel',
    subtitle: mail.summaryOneLine?.trim() || mail.intent?.trim() || 'Analyse messagerie',
    detail: mail.intent ? `Intent : ${mail.intent}` : null,
    residenceId: mail.matchedResidenceId ?? null,
    contactEmail: mail.contactEmail ?? null,
  };
}

export function callToTimelineEvent(call: TimelineCallInput): UnifiedTimelineEvent {
  return {
    id: `call-${call.driveDocumentId}`,
    channel: 'vertex_call',
    sortMs: call.updatedAtMillis,
    title: call.fileName?.trim() || 'Appel enregistré',
    subtitle: call.executiveSummary?.trim() || 'Analyse vocale (Vertex)',
    detail: call.pipelineStatus ? String(call.pipelineStatus) : null,
    residenceId: call.residenceId,
  };
}

/**
 * Chronologie d’un contact : courriels (email) + appels (fiches résidence liées).
 */
export function getContactTimelineEvents(input: {
  contactEmail?: string | null;
  residenceIds?: readonly string[];
  mails: TimelineMailInput[];
  calls: TimelineCallInput[];
}): UnifiedTimelineEvent[] {
  const emailNorm = normalizeContactEmail(input.contactEmail);
  const residenceIds = input.residenceIds ?? [];
  const events: UnifiedTimelineEvent[] = [];

  if (emailNorm) {
    for (const m of input.mails) {
      if (mailMatchesEmail(m, emailNorm)) events.push(mailToTimelineEvent(m));
    }
  }

  for (const c of input.calls) {
    if (callMatchesContactResidences(c, residenceIds)) {
      events.push(callToTimelineEvent(c));
    }
  }

  return events.sort((a, b) => b.sortMs - a.sortMs);
}

/**
 * Chronologie résidence : appels du dossier + courriels (résidence + intervenants `partiesImpliquees`).
 */
export function getResidencePartiesTimelineEvents(input: {
  residenceId: string;
  partyEmails: readonly string[];
  mails: TimelineMailInput[];
  calls: TimelineCallInput[];
}): UnifiedTimelineEvent[] {
  const residenceId = input.residenceId;
  const partySet = new Set(
    input.partyEmails
      .map((e) => normalizeContactEmail(e))
      .filter((e): e is string => Boolean(e))
  );
  const seenMail = new Set<string>();
  const events: UnifiedTimelineEvent[] = [];

  for (const c of input.calls) {
    if (c.residenceId === residenceId) {
      events.push(callToTimelineEvent(c));
    }
  }

  for (const m of input.mails) {
    const onResidence = m.matchedResidenceId === residenceId;
    const email = normalizeContactEmail(m.contactEmail);
    const onParty = email != null && partySet.has(email);
    if (!onResidence && !onParty) continue;
    if (seenMail.has(m.messageId)) continue;
    seenMail.add(m.messageId);
    events.push(mailToTimelineEvent(m));
  }

  return events.sort((a, b) => b.sortMs - a.sortMs);
}

/** Déduplique les analyses courriel par messageId (fusion requêtes indexée + scan complémentaire). */
export function dedupeTimelineMails<T extends { messageId: string }>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of rows) byId.set(r.messageId, r);
  return Array.from(byId.values());
}
