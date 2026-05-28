/**
 * Analyse d'urgence — messages entrants SMS / Meta (heuristique + JSON Gemini).
 */

import { extractJsonObject } from '../audio/transcriber';
import type { InboundUrgencyAnalysis, MailUrgency } from './types';

const CRITICAL_PATTERNS_FR = [
  /\bannul(er|ation)\b/i,
  /\btoit\s+coul/i,
  /\bfuite\b/i,
  /\burgent\b/i,
  /\bcancel/i,
  /\bemergency\b/i,
  /\bplainte\b/i,
];

export function analyzeInboundUrgencyHeuristic(body: string): InboundUrgencyAnalysis {
  const text = body.trim();
  const isCritical = CRITICAL_PATTERNS_FR.some((re) => re.test(text));
  const urgency: MailUrgency = isCritical ? 'high' : text.length > 120 ? 'medium' : 'low';
  const summaryOneLine =
    text.length > 100 ? `${text.slice(0, 97)}…` : text || 'Message entrant';
  return { isCritical, urgency, summaryOneLine };
}

export function parseInboundUrgencyJson(raw: string): InboundUrgencyAnalysis | null {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) return null;
  try {
    const o = JSON.parse(jsonStr) as Record<string, unknown>;
    const isCritical = o.isCritical === true;
    const urgencyRaw = typeof o.urgency === 'string' ? o.urgency.toLowerCase() : 'medium';
    const urgency: MailUrgency =
      urgencyRaw === 'high' || urgencyRaw === 'low' ? urgencyRaw : 'medium';
    const summaryOneLine =
      typeof o.summaryOneLine === 'string' && o.summaryOneLine.trim()
        ? o.summaryOneLine.trim()
        : 'Message entrant';
    return { isCritical, urgency, summaryOneLine };
  } catch {
    return null;
  }
}

export function buildInboundUrgencySystemPrompt(): string {
  return `Tu es l'assistant de conformité d'un courtier immobilier au Québec (OACIQ).
Analyse un message entrant SMS ou messagerie sociale.
Réponds UNIQUEMENT en JSON :
{
  "isCritical": true ou false,
  "urgency": "low" | "medium" | "high",
  "summaryOneLine": "résumé une ligne en français québécois"
}
isCritical = true si urgence réelle (fuite, toit, annulation, menace, délai immédiat).`;
}

export function buildInboundUrgencyUserPrompt(body: string, channel: string): string {
  return `Canal : ${channel}\nMessage :\n${body.trim()}`;
}
