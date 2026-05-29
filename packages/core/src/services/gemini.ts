/**
 * Client JSON Gemini — port d'injection pour modules @primexpert/core (V2.6).
 * Implémentation navigateur : src/services/gemini.ts (VITE_GEMINI_API_KEY).
 * Implémentation serveur : Functions + Vertex (analyzeVoiceIntent pattern).
 */

import {
  buildNegotiationSystemPrompt,
  buildNegotiationUserPrompt,
  parseNegotiationLlmJson,
  type NegotiationLlmJsonPayload,
  type NegotiationPromptContext,
  NEGOTIATION_GEMINI_MODEL,
} from '../ai/negotiationPrompts';

export type { NegotiationLlmJsonPayload, NegotiationPromptContext };
export { NEGOTIATION_GEMINI_MODEL };

export interface GeminiJsonRequest {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
}

export type GeminiJsonClient = (request: GeminiJsonRequest) => Promise<string>;

let geminiJsonClient: GeminiJsonClient | undefined;

export function configureGeminiJsonClient(client: GeminiJsonClient): void {
  geminiJsonClient = client;
}

export function isGeminiJsonClientConfigured(): boolean {
  return Boolean(geminiJsonClient);
}

export async function invokeGeminiJson(request: GeminiJsonRequest): Promise<string> {
  if (!geminiJsonClient) {
    throw new Error(
      'GEMINI_JSON_CLIENT_NOT_CONFIGURED: appelez configureGeminiJsonClient (ex. src/services/gemini.ts au démarrage).'
    );
  }
  return geminiJsonClient({
    model: NEGOTIATION_GEMINI_MODEL,
    temperature: 0.2,
    ...request,
  });
}

/**
 * Appel LLM — génère clause juridique + courriel vulgarisé (JSON structuré).
 */
export async function generateNegotiationClauseWithGemini(
  ctx: NegotiationPromptContext
): Promise<NegotiationLlmJsonPayload> {
  const systemPrompt = buildNegotiationSystemPrompt(ctx);
  const userPrompt = buildNegotiationUserPrompt(ctx);
  const raw = await invokeGeminiJson({ systemPrompt, userPrompt });
  const parsed = parseNegotiationLlmJson(raw);
  if (!parsed) {
    throw new Error('NEGOTIATION_LLM_PARSE_FAILED: JSON invalide ou champs manquants.');
  }
  return parsed;
}
