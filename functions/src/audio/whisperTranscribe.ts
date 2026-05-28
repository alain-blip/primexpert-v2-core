/**
 * Transcription Whisper (OpenAI) — serveur uniquement, clé Secret Manager.
 */

export async function transcribeAudioWithWhisper(
  audioBuffer: Buffer,
  fileName: string,
  mimeType: string,
  locale: 'fr' | 'en',
  apiKey: string
): Promise<string> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error('OPENAI_API_KEY manquante');
  }

  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' });
  form.append('file', blob, fileName || 'note-vocale.webm');
  form.append('model', 'whisper-1');
  form.append('language', locale === 'fr' ? 'fr' : 'en');
  form.append('response_format', 'json');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Whisper HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }

  const json = (await res.json()) as { text?: string };
  const text = (json.text ?? '').trim();
  if (!text) {
    throw new Error('WHISPER_EMPTY: transcription vide');
  }
  return text;
}
