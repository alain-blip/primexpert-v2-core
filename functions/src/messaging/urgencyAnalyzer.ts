/**
 * Analyse urgence Gemini (Vertex) — repli heuristique @primexpert/core/mail
 */

import { getVertexClient } from '../services/vertexClient';
import { getVertexGeminiModel } from '../services/vertexClient';
import {
  analyzeInboundUrgencyHeuristic,
  buildInboundUrgencySystemPrompt,
  buildInboundUrgencyUserPrompt,
  parseInboundUrgencyJson,
  type CommunicationChannel,
  type InboundUrgencyAnalysis,
} from '../nylas/_vendored/mail';

export async function analyzeInboundMessageUrgency(
  body: string,
  channel: CommunicationChannel
): Promise<InboundUrgencyAnalysis> {
  try {
    const vertex = await getVertexClient();
    const model = vertex.getGenerativeModel({
      model: getVertexGeminiModel(),
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${buildInboundUrgencySystemPrompt()}\n\n${buildInboundUrgencyUserPrompt(body, channel)}`,
            },
          ],
        },
      ],
    });

    const text =
      result.response?.candidates?.[0]?.content?.parts
        ?.map((p) => ('text' in p ? p.text : ''))
        .join('') ?? '';

    const parsed = parseInboundUrgencyJson(text);
    if (parsed) return parsed;
  } catch (e) {
    console.warn('[urgencyAnalyzer] Gemini repli heuristique', e);
  }
  return analyzeInboundUrgencyHeuristic(body);
}
