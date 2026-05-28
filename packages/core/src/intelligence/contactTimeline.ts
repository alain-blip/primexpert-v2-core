/**
 * Agrégation chronologie omnicanale (lecture seule) — Nylas / Vertex existants.
 * Ne crée pas interactionEvents ; ne modifie pas email_threads.
 */

export type TimelineChannel =
  | 'nylas_mail'
  | 'vertex_call'
  | 'sms'
  | 'facebook'
  | 'instagram';

export interface TimelineMailInput {
  messageId: string;
  analyzedAtMillis: number;
  contactEmail?: string | null;
  contactName?: string | null;
  summaryOneLine?: string | null;
  intent?: string | null;
  matchedResidenceId?: string | null;
  matchedContactId?: string | null;
  /** Canal SSOT message (défaut courriel). */
  channel?: 'email' | 'sms' | 'facebook' | 'instagram';
  isCritical?: boolean;
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
  isCritical?: boolean;
}

function resolveMailTimelineChannel(
  channel?: TimelineMailInput['channel']
): TimelineChannel {
  if (channel === 'sms') return 'sms';
  if (channel === 'facebook') return 'facebook';
  if (channel === 'instagram') return 'instagram';
  return 'nylas_mail';
}

export function normalizeContactEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const v = email.trim().toLowerCase();
  return v.includes('@') ? v : null;
}

function mailMatchesEmail(mail: TimelineMailInput, emailNorm: string): boolean {
  if (mail.matchedContactId) return false;
  const lead = normalizeContactEmail(mail.contactEmail);
  return lead === emailNorm;
}

function mailMatchesContactId(mail: TimelineMailInput, contactId: string): boolean {
  return mail.matchedContactId === contactId;
}

function callMatchesContactResidences(
  call: TimelineCallInput,
  residenceIds: readonly string[]
): boolean {
  if (!residenceIds.length) return false;
  return residenceIds.includes(call.residenceId);
}

export function mailToTimelineEvent(mail: TimelineMailInput): UnifiedTimelineEvent {
  const ch = resolveMailTimelineChannel(mail.channel);
  const defaultTitle =
    ch === 'sms'
      ? 'SMS'
      : ch === 'facebook'
        ? 'Facebook'
        : ch === 'instagram'
          ? 'Instagram'
          : 'Courriel';
  return {
    id: `mail-${mail.messageId}`,
    channel: ch,
    sortMs: mail.analyzedAtMillis,
    title: mail.contactName?.trim() || mail.contactEmail?.trim() || defaultTitle,
    subtitle: mail.summaryOneLine?.trim() || mail.intent?.trim() || 'Message',
    detail: mail.intent ? `Intent : ${mail.intent}` : null,
    residenceId: mail.matchedResidenceId ?? null,
    contactEmail: mail.contactEmail ?? null,
    isCritical: mail.isCritical === true,
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
  contactId?: string | null;
  contactEmail?: string | null;
  residenceIds?: readonly string[];
  mails: TimelineMailInput[];
  calls: TimelineCallInput[];
}): UnifiedTimelineEvent[] {
  const emailNorm = normalizeContactEmail(input.contactEmail);
  const contactId = input.contactId?.trim() || null;
  const residenceIds = input.residenceIds ?? [];
  const events: UnifiedTimelineEvent[] = [];

  for (const m of input.mails) {
    if (contactId && mailMatchesContactId(m, contactId)) {
      events.push(mailToTimelineEvent(m));
      continue;
    }
    if (emailNorm && mailMatchesEmail(m, emailNorm)) {
      events.push(mailToTimelineEvent(m));
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
