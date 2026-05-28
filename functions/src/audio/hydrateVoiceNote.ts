/**
 * Hydratation Firestore — notes existantes + tâches (résidence ou organisation).
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { suggestedDateToMillis, type VoiceIntentResult } from './_vendored/voiceParser';
import type { ParsedVoiceNoteStoragePath } from './voiceNotePaths';

export interface VoiceNoteUploadMetadata {
  brokerId: string;
  authorName?: string;
  locale?: string;
}

export interface HydrateVoiceNoteInput {
  db: Firestore;
  path: ParsedVoiceNoteStoragePath;
  metadata: VoiceNoteUploadMetadata;
  intent: VoiceIntentResult;
  rawTranscript: string;
}

export async function hydrateVoiceNote(input: HydrateVoiceNoteInput): Promise<{
  noteId: string;
  taskId?: string;
}> {
  const { db, path, metadata, intent, rawTranscript } = input;
  const brokerId = metadata.brokerId.trim();
  const authorName = (metadata.authorName || 'Courtier').trim();
  const now = FieldValue.serverTimestamp();

  const notePayload = {
    text: intent.cleanText,
    authorId: brokerId,
    authorName,
    createdAt: now,
    source: 'voice',
    voiceUploadId: path.uploadId,
    voiceStoragePath: `organizations/${path.orgId}/voice_notes/${path.parentKind}/${path.parentId}/${path.fileName}`,
    rawTranscript: rawTranscript.slice(0, 12000),
    hasActionItem: intent.hasActionItem,
    updatedAt: now,
  };

  let noteRef;
  if (path.parentKind === 'residences') {
    noteRef = await db
      .collection('residences')
      .doc(path.parentId)
      .collection('notes')
      .add(notePayload);

    await db.collection('residences').doc(path.parentId).set(
      {
        lastCommunicationAt: now,
        lastCommunicationType: 'note',
        updatedAt: now,
      },
      { merge: true }
    );
  } else {
    noteRef = await db
      .collection('organizations')
      .doc(path.orgId)
      .collection('contacts')
      .doc(path.parentId)
      .collection('notes')
      .add(notePayload);
  }

  let taskId: string | undefined;
  if (intent.hasActionItem && intent.taskDescription) {
    const dueAtMillis = suggestedDateToMillis(intent.suggestedDate);
    const taskBase = {
      title: intent.taskDescription,
      description: intent.cleanText,
      dueAtMillis: dueAtMillis > 0 ? dueAtMillis : 0,
      kind: 'task',
      status: 'a_faire',
      authorId: brokerId,
      authorName,
      createdAt: now,
      source: 'voice_intent',
      voiceUploadId: path.uploadId,
      updatedAt: now,
    };

    if (path.parentKind === 'residences') {
      const taskRef = await db
        .collection('residences')
        .doc(path.parentId)
        .collection('tasks')
        .add(taskBase);
      taskId = taskRef.id;
    } else {
      const taskRef = await db
        .collection('organizations')
        .doc(path.orgId)
        .collection('tasks')
        .add({
          ...taskBase,
          orgId: path.orgId,
          ownerId: brokerId,
          contactId: path.parentId,
        });
      taskId = taskRef.id;
    }
  }

  return { noteId: noteRef.id, taskId };
}
