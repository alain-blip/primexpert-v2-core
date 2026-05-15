/**
 * E-4 — Automatisation proactive : stagnation, priorité tableau de bord,
 * sentiment (appels), compilation rapport vendeur.
 */

import type { Residence } from './residences';
import type { CallAnalysisRow } from './transcriptionService';
import type { SavedMailboxAnalysis } from './mailboxAnalysis';

export const STAGNATION_MS = 48 * 60 * 60 * 1000;
export const FOLLOW_UP_DRAFT_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface FollowUpPriorityItem {
  residence: Residence;
  lastActivityMillis: number;
  hoursSinceActivity: number;
  reason: 'stagnation' | 'no_ia_activity';
}

function parseListingDateMs(r: Residence): number | null {
  const t = Date.parse(r.date);
  return Number.isFinite(t) ? t : null;
}

function sentimentScore(s?: string): number {
  switch ((s ?? '').toLowerCase()) {
    case 'positive':
      return 1;
    case 'negative':
      return 0;
    case 'neutral':
    case 'unknown':
    default:
      return 0.5;
  }
}

/** Moyennes journalières de sentiment (0–1) sur 7 buckets glissants depuis `now`. */
export function sentimentDailyAvgsLast7Days(
  calls: CallAnalysisRow[],
  residenceId: string,
  now = Date.now()
): number[] {
  const DAY = 86400000;
  const windowStart = now - SEVEN_DAYS_MS;
  const buckets = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
  for (const c of calls) {
    if (c.residenceId !== residenceId) continue;
    if (c.pipelineStatus !== 'analyzed') continue;
    const ts = c.updatedAtMillis;
    if (ts < windowStart || ts > now) continue;
    const idx = Math.min(6, Math.floor((ts - windowStart) / DAY));
    buckets[idx].sum += sentimentScore(c.clientSentiment);
    buckets[idx].n += 1;
  }
  return buckets.map((b) => (b.n ? b.sum / b.n : 0));
}

/** Moyenne brute sur jours actifs (7 jours). */
export function avgSentimentLast7Days(
  calls: CallAnalysisRow[],
  residenceId: string,
  now = Date.now()
): number | null {
  const avgs = sentimentDailyAvgsLast7Days(calls, residenceId, now).filter((v) => v > 0);
  if (avgs.length === 0) return null;
  return avgs.reduce((a, b) => a + b, 0) / avgs.length;
}

function lastActivityForResidence(
  residenceId: string,
  calls: CallAnalysisRow[],
  mails: SavedMailboxAnalysis[]
): number {
  let max = 0;
  for (const c of calls) {
    if (c.residenceId === residenceId) {
      max = Math.max(max, c.updatedAtMillis);
    }
  }
  for (const m of mails) {
    if (m.matchedResidenceId === residenceId) {
      max = Math.max(max, m.analyzedAtMillis);
    }
  }
  return max;
}

/**
 * Inscriptions à surveiller : aucune activité IA (appel + courriel matché)
 * depuis plus de 48 h (ou jamais, si inscription vieille de 48 h+).
 */
export function computeFollowUpPriorities(
  residences: readonly Residence[],
  calls: readonly CallAnalysisRow[],
  mails: readonly SavedMailboxAnalysis[],
  now = Date.now(),
  maxItems = 3
): FollowUpPriorityItem[] {
  const items: FollowUpPriorityItem[] = [];
  for (const r of residences) {
    const last = lastActivityForResidence(r.id, [...calls], [...mails]);
    const listedAt = parseListingDateMs(r) ?? now;
    const idleMs = last > 0 ? now - last : now - listedAt;
    const stale =
      last > 0
        ? now - last > STAGNATION_MS
        : now - listedAt > STAGNATION_MS;
    if (!stale) continue;
    items.push({
      residence: r,
      lastActivityMillis: last,
      hoursSinceActivity: idleMs / 3600000,
      reason: last > 0 ? 'stagnation' : 'no_ia_activity',
    });
  }
  return items
    .sort((a, b) => b.hoursSinceActivity - a.hoursSinceActivity)
    .slice(0, maxItems);
}

export function shouldSuggestDraftFollowUp(
  replyDraft: string | undefined,
  replyDraftAtMillis: number | undefined,
  now = Date.now()
): boolean {
  if (!replyDraft?.trim() || !replyDraftAtMillis) return false;
  return now - replyDraftAtMillis > FOLLOW_UP_DRAFT_MS;
}

export function buildSoftFollowUpParagraph(
  contactName: string | undefined,
  lang: 'fr' | 'en'
): string {
  const name = contactName?.trim() || (lang === 'fr' ? 'Bonjour' : 'Hello');
  if (lang === 'fr') {
    return `${name},\n\nJe me permets un court suivi suite à mon dernier message. N’hésitez pas à me dire si vous avez des questions ou si un autre moment vous conviendrait mieux pour échanger.\n\nCordialement,`;
  }
  return `${name},\n\nJust a brief follow-up on my last note. Let me know if you have any questions or if another time works better to connect.\n\nBest regards,`;
}

export function isListingStale(
  r: Residence,
  calls: readonly CallAnalysisRow[],
  mails: readonly SavedMailboxAnalysis[],
  now = Date.now()
): boolean {
  const last = lastActivityForResidence(r.id, [...calls], [...mails]);
  const listedAt = parseListingDateMs(r) ?? now;
  if (last > 0) return now - last > STAGNATION_MS;
  return now - listedAt > STAGNATION_MS;
}
