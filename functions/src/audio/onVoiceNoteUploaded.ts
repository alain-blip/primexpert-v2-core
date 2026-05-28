/**
 * Pipeline note vocale — Storage → Whisper → Gemini intention → notes + tasks.
 * Région : northamerica-northeast1 (Montréal). Gemini : us-central1 (Vertex).
 */

import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { getStorage } from 'firebase-admin/storage';
import { getDb } from '../lib/firestore';
import { transcribeAudioWithGeminiVertex } from './geminiTranscribe';
import { transcribeAudioWithWhisper } from './whisperTranscribe';
import { analyzeVoiceIntentWithGemini } from './analyzeVoiceIntent';
import { hydrateVoiceNote } from './hydrateVoiceNote';
import { montrealReferenceDateIso, parseVoiceNoteStorageObjectPath } from './voiceNotePaths';

/** Whisper si OPENAI_API_KEY est lié à la fonction ; sinon Vertex Gemini. */
async function transcribeVoiceNote(
  audioBuffer: Buffer,
  fileName: string,
  mimeType: string,
  locale: 'fr' | 'en'
): Promise<{ text: string; engine: 'whisper' | 'gemini' }> {
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    try {
      const text = await transcribeAudioWithWhisper(
        audioBuffer,
        fileName,
        mimeType,
        locale,
        openAiKey
      );
      return { text, engine: 'whisper' };
    } catch (e) {
      console.warn('[onVoiceNoteUploaded] Whisper échoué, repli Gemini', e);
    }
  }
  const text = await transcribeAudioWithGeminiVertex(audioBuffer, mimeType, locale, fileName);
  return { text, engine: 'gemini' };
}

export const onVoiceNoteUploaded = onObjectFinalized(
  {
    region: 'northamerica-northeast1',
    memory: '512MiB',
    timeoutSeconds: 120,
    serviceAccount:
      '250702494735-compute@developer.gserviceaccount.com',
  },
  async (event) => {
    const object = event.data;
    const objectName = object.name;
    if (!objectName) {
      console.warn('[onVoiceNoteUploaded] objet sans name, ignoré');
      return;
    }

    const parsed = parseVoiceNoteStorageObjectPath(objectName);
    if (!parsed) {
      console.info('[onVoiceNoteUploaded] chemin hors voice_notes, ignoré', { objectName });
      return;
    }

    const brokerId = String(object.metadata?.brokerid ?? object.metadata?.brokerId ?? '').trim();
    if (!brokerId) {
      console.error('[onVoiceNoteUploaded] brokerId manquant dans metadata', { objectName });
      return;
    }

    const authorName = String(
      object.metadata?.authorname ?? object.metadata?.authorName ?? 'Courtier'
    ).trim();
    const localeRaw = String(object.metadata?.locale ?? 'fr').toLowerCase();
    const locale = localeRaw.startsWith('en') ? 'en' : 'fr';

    const bucket = getStorage().bucket(object.bucket);
    const [audioBuffer] = await bucket.file(objectName).download();
    const mimeType = object.contentType || 'audio/webm';

    console.info('[onVoiceNoteUploaded] start', {
      objectName,
      orgId: parsed.orgId,
      parentKind: parsed.parentKind,
      parentId: parsed.parentId,
      bytes: audioBuffer.length,
    });

    const { text: rawTranscript, engine: sttEngine } = await transcribeVoiceNote(
      audioBuffer,
      parsed.fileName,
      mimeType,
      locale
    );
    console.info('[onVoiceNoteUploaded] STT', { engine: sttEngine });

    const intent = await analyzeVoiceIntentWithGemini(
      rawTranscript,
      montrealReferenceDateIso()
    );

    const db = getDb();
    const result = await hydrateVoiceNote({
      db,
      path: parsed,
      metadata: { brokerId, authorName, locale },
      intent,
      rawTranscript,
    });

    console.info('[onVoiceNoteUploaded] done', {
      noteId: result.noteId,
      taskId: result.taskId,
      hasActionItem: intent.hasActionItem,
      suggestedDate: intent.suggestedDate,
    });
  }
);
