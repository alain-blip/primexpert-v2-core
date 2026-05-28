/* eslint-disable */
/** AUTO-GÉNÉRÉ — sync-core-ai.cjs */
/**
 * E-3 — Transcription & mémoire d’appel (cœur métier pur).
 *
 * Charte alignée sur @primexpert/core/mail : aucun fetch, Storage ni clé API
 * dans ce module — uniquement types, contrats et normalisation déterministe.
 * L’app (Vite) branchera Whisper / Gemini audio puis appellera les parseurs.
 */

/** Job immutable passé au pipeline après `uploadDriveRecording`. */
export interface RecordingTranscriptionJob {
  brokerId: string;
  driveDocumentId: string;
  storagePath: string;
  fileName: string;
  residenceId: string;
  mime: string;
  durationMs: number;
  dialedNumber?: string;
  /** UI / prompts — défaut `fr` côté orchestrateur. */
  locale?: 'fr' | 'en';
}

/** Sortie brute d’un moteur STT (Whisper, etc.). */
export interface TranscriptionPipelineResult {
  plainText: string;
  segments?: TranscriptionSegment[];
  /** Code langue BCP-47 si détecté (ex. fr, en). */
  language?: string;
}

export interface TranscriptionSegment {
  startSec: number;
  endSec: number;
  text: string;
}

export type ClientSentiment = 'positive' | 'neutral' | 'negative' | 'unknown';

/**
 * Résumé structuré post-transcription (généré par LLM côté app).
 * Champs en anglais pour faciliter le prompt JSON ; l’UI reste FR (Loi 101).
 */
export interface CallDiscussionSummary {
  keyPoints: string[];
  actionItems: string[];
  clientSentiment: ClientSentiment;
}

const SENTIMENTS: readonly ClientSentiment[] = [
  'positive',
  'neutral',
  'negative',
  'unknown',
] as const;

function asStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((i) => typeof i === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeSentiment(x: unknown): ClientSentiment {
  if (typeof x !== 'string') return 'unknown';
  const s = x.trim().toLowerCase();
  return SENTIMENTS.includes(s as ClientSentiment) ? (s as ClientSentiment) : 'unknown';
}

/** Extrait un bloc JSON d’une réponse LLM (éventuellement entourée de ```). */
export function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(trimmed);
  const body = fence ? fence[1].trim() : trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  return body.slice(start, end + 1);
}

/**
 * Parse le JSON de synthèse d’appel renvoyé par l’IA (tolérant, sans throw).
 */
export function parseCallDiscussionSummaryJson(raw: string): CallDiscussionSummary | null {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) return null;
  try {
    const o = JSON.parse(jsonStr) as Record<string, unknown>;
    const keyPoints = asStringArray(o.keyPoints ?? o.points ?? o.highlights);
    const actionItems = asStringArray(
      o.actionItems ?? o.todos ?? o.tasks ?? o.followUps
    );
    const clientSentiment = normalizeSentiment(
      o.clientSentiment ?? o.sentiment ?? o.tone
    );
    return { keyPoints, actionItems, clientSentiment };
  } catch {
    return null;
  }
}

export function emptyCallDiscussionSummary(): CallDiscussionSummary {
  return {
    keyPoints: [],
    actionItems: [],
    clientSentiment: 'unknown',
  };
}

/** Vérifie les champs minimaux avant enqueue (pure, synchrone). */
export function isValidRecordingTranscriptionJob(j: RecordingTranscriptionJob | null | undefined): boolean {
  if (!j) return false;
  return Boolean(
    j.brokerId &&
      j.driveDocumentId &&
      j.storagePath &&
      j.fileName &&
      j.residenceId &&
      j.mime &&
      typeof j.durationMs === 'number' &&
      j.durationMs >= 0
  );
}
