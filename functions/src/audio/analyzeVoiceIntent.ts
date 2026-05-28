/**
 * Analyse d'intention note vocale — Gemini (Vertex us-central1).
 */

import { getVertexClient } from '../services/vertexClient';
import {
  VOICE_INTENT_GEMINI_MODEL,
  buildVoiceIntentSystemPrompt,
  buildVoiceIntentUserPrompt,
  parseVoiceIntentJson,
  type VoiceIntentResult,
} from './_vendored/voiceParser';

export async function analyzeVoiceIntentWithGemini(
  rawTranscript: string,
  referenceDateIso: string
): Promise<VoiceIntentResult> {
  const vertex = await getVertexClient();
  const model = vertex.getGenerativeModel({
    model: VOICE_INTENT_GEMINI_MODEL,
    generationConfig: {
      temperature: 0.15,
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${buildVoiceIntentSystemPrompt(referenceDateIso)}\n\n${buildVoiceIntentUserPrompt(rawTranscript)}`,
          },
        ],
      },
    ],
  });

  const text =
    result.response?.candidates?.[0]?.content?.parts
      ?.map((p) => ('text' in p ? p.text : ''))
      .join('') ?? '';

  const parsed = parseVoiceIntentJson(text);
  if (!parsed) {
    throw new Error('VOICE_INTENT_PARSE_FAILED: JSON invalide');
  }
  return parsed;
}
