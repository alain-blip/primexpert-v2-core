/**
 * Validation serveur MVP — format MIME / extension (sans antivirus tiers).
 */

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXT = new Set(['.pdf', '.xlsx', '.xls', '.docx']);

const BLOCKED_EXT = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.js', '.mjs', '.cjs', '.vbs', '.vbe',
  '.ps1', '.psm1', '.msi', '.msp', '.dll', '.jar', '.sh', '.bash', '.app', '.dmg',
  '.pkg', '.hta', '.wsf', '.wsh',
];

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export type StorageValidationCode =
  | 'blocked_executable'
  | 'extension_not_allowed'
  | 'mime_not_allowed'
  | 'mime_extension_mismatch';

export type StorageValidationResult =
  | { ok: true; mimeType: string }
  | { ok: false; code: StorageValidationCode };

function getExtension(fileName: string): string {
  const lower = fileName.toLowerCase().trim();
  const dot = lower.lastIndexOf('.');
  return dot >= 0 ? lower.slice(dot) : '';
}

export function displayNameFromStorageFile(storageFileName: string): string {
  const dash = storageFileName.indexOf('-');
  return dash >= 0 ? storageFileName.slice(dash + 1) : storageFileName;
}

/** Valide à partir du nom de fichier affiché (Firestore) ou segment Storage. */
export function validateDocumentFormat(
  displayFileName: string,
  contentType: string
): StorageValidationResult {
  const ext = getExtension(displayFileName);

  if (BLOCKED_EXT.some((b) => ext === b || ext.endsWith(b))) {
    return { ok: false, code: 'blocked_executable' };
  }
  if (!ext || !ALLOWED_EXT.has(ext)) {
    return { ok: false, code: 'extension_not_allowed' };
  }

  const mime = (contentType || '').trim().toLowerCase();
  const expected = MIME_BY_EXT[ext];

  if (mime) {
    if (!ALLOWED_MIME.has(mime)) return { ok: false, code: 'mime_not_allowed' };
    if (mime !== expected) return { ok: false, code: 'mime_extension_mismatch' };
    return { ok: true, mimeType: mime };
  }

  return { ok: true, mimeType: expected };
}

export function validateStorageDocument(
  storageFileName: string,
  contentType: string
): StorageValidationResult {
  return validateDocumentFormat(displayNameFromStorageFile(storageFileName), contentType);
}

/** MVP : dossier Financier → file d’analyse IA ; sinon non applicable. */
export function parsingStatusAfterClean(category: string): 'pending' | 'not_applicable' {
  return category === 'financier' ? 'pending' : 'not_applicable';
}
