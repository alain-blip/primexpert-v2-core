/**
 * Chemins Storage / Firestore pour notes vocales.
 *
 * Storage : organizations/{orgId}/voice_notes/{parentKind}/{parentId}/{uploadId}.webm
 * parentKind : residences | contacts
 */

export interface ParsedVoiceNoteStoragePath {
  orgId: string;
  parentKind: 'residences' | 'contacts';
  parentId: string;
  uploadId: string;
  fileName: string;
}

const PATH_RE =
  /^organizations\/([^/]+)\/voice_notes\/(residences|contacts)\/([^/]+)\/([^/]+)$/;

export function parseVoiceNoteStorageObjectPath(
  objectName: string
): ParsedVoiceNoteStoragePath | null {
  const normalized = objectName.replace(/^\/+/, '');
  const m = PATH_RE.exec(normalized);
  if (!m) return null;
  const [, orgId, parentKind, parentId, fileName] = m;
  if (parentKind !== 'residences' && parentKind !== 'contacts') return null;
  const uploadId = fileName.replace(/\.[^.]+$/, '');
  if (!uploadId) return null;
  return { orgId, parentKind, parentId, uploadId, fileName };
}

export function montrealReferenceDateIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
}
