/**
 * Négociation commerciale — Vertex Gemini (serveur).
 * Miroir de src/services/gemini.ts (navigateur) pour callables / Functions.
 */

import { getVertexClient, getVertexGeminiModel } from '../services/vertexClient';
import {
  buildNegotiationSystemPrompt,
  buildNegotiationUserPrompt,
  parseNegotiationLlmJson,
  type NegotiationLlmJsonPayload,
  type NegotiationPromptContext,
} from './_vendored/negotiationPrompts';

export type { NegotiationLlmJsonPayload, NegotiationPromptContext };

export async function generateNegotiationClauseWithVertex(
  ctx: NegotiationPromptContext
): Promise<NegotiationLlmJsonPayload> {
  const vertex = await getVertexClient();
  const model = vertex.getGenerativeModel({
    model: getVertexGeminiModel(),
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  });

  const systemPrompt = buildNegotiationSystemPrompt(ctx);
  const userPrompt = buildNegotiationUserPrompt(ctx);

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
      },
    ],
  });

  const text =
    result.response?.candidates?.[0]?.content?.parts
      ?.map((p) => ('text' in p ? p.text : ''))
      .join('') ?? '';

  const parsed = parseNegotiationLlmJson(text);
  if (!parsed) {
    throw new Error('NEGOTIATION_LLM_PARSE_FAILED: JSON invalide (Vertex).');
  }
  return parsed;
}
