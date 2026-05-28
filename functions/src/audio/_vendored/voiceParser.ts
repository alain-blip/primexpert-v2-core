/* eslint-disable */
/** AUTO-GÉNÉRÉ — sync-core-ai.cjs */
/**
 * Analyse d'intention — notes vocales courtier (cœur métier pur).
 * Aucun appel réseau : prompt + validation JSON uniquement.
 */

import { extractJsonObject } from './transcriber';

export interface VoiceIntentResult {
  cleanText: string;
  hasActionItem: boolean;
  taskDescription: string;
  /** ISO 8601 date (YYYY-MM-DD) ou chaîne vide si non applicable */
  suggestedDate: string;
}

export const VOICE_INTENT_GEMINI_MODEL = 'gemini-2.0-flash-001' as const;

export function buildVoiceIntentSystemPrompt(referenceDateIso: string): string {
  const ref = referenceDateIso.slice(0, 10);
  return `Tu es l'assistant de conformité d'un courtier en immobilier commercial au Québec (OACIQ).
On te fournit une transcription brute d'une note vocale de suivi.
Date de référence (aujourd'hui, fuseau America/Toronto) : ${ref}.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, avec exactement ces clés :
{
  "cleanText": "transcription nettoyée, phrases complètes, sans tics (euh, ben, là)",
  "hasActionItem": true ou false,
  "taskDescription": "action concrète pour le courtier (vide si hasActionItem est false)",
  "suggestedDate": "YYYY-MM-DD ou chaîne vide"
}

Règles :
- hasActionItem = true seulement si une action future explicite est demandée (rappeler, planifier, envoyer, visiter, etc.).
- suggestedDate : calcule la prochaine occurrence du jour mentionné par rapport à la date de référence (ex. « ce vendredi » → le vendredi de la semaine courante ou suivante selon le contexte).
- Si aucune date n'est mentionnée, suggestedDate = "".
- Français québécois professionnel dans cleanText et taskDescription.
- Ne jamais inventer de faits absents de la transcription.`;
}

export function buildVoiceIntentUserPrompt(rawTranscript: string): string {
  return `Transcription brute :\n\n${rawTranscript.trim()}`;
}

function asBool(x: unknown): boolean {
  return x === true;
}

function asString(x: unknown): string {
  return typeof x === 'string' ? x.trim() : '';
}

function normalizeIsoDate(value: string): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return '';
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseVoiceIntentJson(raw: string): VoiceIntentResult | null {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) return null;
  try {
    const o = JSON.parse(jsonStr) as Record<string, unknown>;
    const cleanText = asString(o.cleanText);
    if (!cleanText) return null;
    const hasActionItem = asBool(o.hasActionItem);
    const taskDescription = hasActionItem ? asString(o.taskDescription) : '';
    const suggestedDate = normalizeIsoDate(asString(o.suggestedDate));
    return {
      cleanText,
      hasActionItem: hasActionItem && Boolean(taskDescription),
      taskDescription,
      suggestedDate,
    };
  } catch {
    return null;
  }
}

export function suggestedDateToMillis(isoDate: string): number {
  const normalized = normalizeIsoDate(isoDate);
  if (!normalized) return 0;
  const d = new Date(`${normalized}T09:00:00-05:00`);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}
