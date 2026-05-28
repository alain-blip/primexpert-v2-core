/**
 * Téléversement notes vocales → Storage (déclenche onVoiceNoteUploaded).
 */

import { ref, uploadBytes } from 'firebase/storage';
import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';

export type VoiceNoteParentKind = 'residences' | 'contacts';

export interface UploadVoiceNoteParams {
  orgId: string;
  brokerId: string;
  authorName: string;
  parentKind: VoiceNoteParentKind;
  parentId: string;
  blob: Blob;
  locale?: 'fr' | 'en';
}

export interface UploadVoiceNoteResult {
  uploadId: string;
  storagePath: string;
}

function extensionFromMime(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

export async function uploadVoiceNote(params: UploadVoiceNoteParams): Promise<UploadVoiceNoteResult> {
  const uploadId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `vn-${Date.now()}`;
  const ext = extensionFromMime(params.blob.type || 'audio/webm');
  const storagePath = `organizations/${params.orgId}/voice_notes/${params.parentKind}/${params.parentId}/${uploadId}.${ext}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, params.blob, {
    contentType: params.blob.type || 'audio/webm',
    customMetadata: {
      brokerId: params.brokerId,
      authorName: params.authorName,
      locale: params.locale ?? 'fr',
    },
  });

  return { uploadId, storagePath };
}

/** Écoute la note créée par la Cloud Function pour un téléversement résidence. */
export function watchResidenceVoiceNoteCompletion(
  residenceId: string,
  uploadId: string,
  onReady: (noteId: string) => void,
  onTimeout?: () => void,
  timeoutMs = 120_000
): Unsubscribe {
  const q = query(
    collection(db, 'residences', residenceId, 'notes'),
    where('voiceUploadId', '==', uploadId)
  );
  let done = false;
  const timer = window.setTimeout(() => {
    if (!done) onTimeout?.();
  }, timeoutMs);

  const unsub = onSnapshot(
    q,
    (snap) => {
      if (snap.empty) return;
      done = true;
      window.clearTimeout(timer);
      onReady(snap.docs[0].id);
    },
    () => {
      window.clearTimeout(timer);
    }
  );

  return () => {
    window.clearTimeout(timer);
    unsub();
  };
}
