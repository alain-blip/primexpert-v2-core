/**
 * Transcription audio — Vertex Gemini (ADC, us-central1).
 * Repli lorsque OPENAI_API_KEY n'est pas provisionné.
 */

import { getVertexClient } from '../services/vertexClient';
import { VOICE_INTENT_GEMINI_MODEL } from './_vendored/voiceParser';

export async function transcribeAudioWithGeminiVertex(
  audioBuffer: Buffer,
  mimeType: string,
  locale: 'fr' | 'en',
  fileName: string
): Promise<string> {
  const vertex = await getVertexClient();
  const model = vertex.getGenerativeModel({
    model: VOICE_INTENT_GEMINI_MODEL,
    generationConfig: { temperature: 0.1 },
  });

  const langLabel = locale === 'fr' ? 'français québécois' : 'English';
  const base64 = audioBuffer.toString('base64');

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Transcris fidèlement cette note vocale de courtier immobilier au Québec.
Langue : ${langLabel}. Fichier : ${fileName || 'note-vocale'}.
Ne pas inventer de propos. Réponds UNIQUEMENT avec le texte transcrit brut (pas de JSON).`,
          },
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: base64,
            },
          },
        ],
      },
    ],
  });

  const text =
    result.response?.candidates?.[0]?.content?.parts
      ?.map((p) => ('text' in p ? p.text : ''))
      .join('') ?? '';

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('GEMINI_STT_EMPTY: transcription vide');
  }
  return trimmed;
}
