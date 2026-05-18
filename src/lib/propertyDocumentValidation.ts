/**
 * Validation stricte — Espace Documents (anti-malware côté client).
 * Formats autorisés : document portable (PDF), tableur Excel (XLSX/XLS), document Word (DOCX).
 */

import type { PropertyDocumentCategory } from '../types/propertyDocument';

/** Types MIME explicitement autorisés (liste fermée). */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

/** Extensions autorisées (doit correspondre au MIME déclaré ou inféré). */
export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.docx'] as const;

/** Extensions exécutables / scripts — refus immédiat. */
export const BLOCKED_EXECUTABLE_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.js',
  '.mjs',
  '.cjs',
  '.vbs',
  '.vbe',
  '.ps1',
  '.psm1',
  '.msi',
  '.msp',
  '.dll',
  '.jar',
  '.sh',
  '.bash',
  '.app',
  '.dmg',
  '.pkg',
  '.hta',
  '.wsf',
  '.wsh',
] as const;

const MIME_BY_EXTENSION: Record<string, AllowedDocumentMimeType> = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export type PropertyDocumentValidationResult =
  | { ok: true; mimeType: AllowedDocumentMimeType; extension: string }
  | { ok: false; code: 'blocked_executable' | 'extension_not_allowed' | 'mime_not_allowed' | 'mime_extension_mismatch' };

function getExtension(fileName: string): string {
  const lower = fileName.toLowerCase().trim();
  const dot = lower.lastIndexOf('.');
  return dot >= 0 ? lower.slice(dot) : '';
}

function isBlockedExecutable(fileName: string): boolean {
  const ext = getExtension(fileName);
  if (!ext) return false;
  return BLOCKED_EXECUTABLE_EXTENSIONS.some((blocked) => ext === blocked || ext.endsWith(blocked));
}

function isAllowedExtension(ext: string): ext is (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number] {
  return (ALLOWED_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext);
}

function isAllowedMime(mime: string): mime is AllowedDocumentMimeType {
  return (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Valide un fichier avant téléversement.
 * Bloque les exécutables même si le MIME est falsifié.
 */
export function validatePropertyDocumentFile(file: File): PropertyDocumentValidationResult {
  const fileName = file.name || 'document';
  const ext = getExtension(fileName);

  if (isBlockedExecutable(fileName)) {
    return { ok: false, code: 'blocked_executable' };
  }

  if (!ext || !isAllowedExtension(ext)) {
    return { ok: false, code: 'extension_not_allowed' };
  }

  const declaredMime = (file.type || '').trim().toLowerCase();
  const expectedMime = MIME_BY_EXTENSION[ext];

  if (declaredMime) {
    if (!isAllowedMime(declaredMime)) {
      return { ok: false, code: 'mime_not_allowed' };
    }
    if (declaredMime !== expectedMime) {
      return { ok: false, code: 'mime_extension_mismatch' };
    }
    return { ok: true, mimeType: declaredMime, extension: ext };
  }

  // Navigateur sans MIME : on n'accepte que si l'extension est dans la liste fermée.
  return { ok: true, mimeType: expectedMime, extension: ext };
}

/** Téléchargement autorisé uniquement après scan antivirus « clean ». */
export function canDownloadPropertyDocument(virusScanStatus: string | undefined): boolean {
  return virusScanStatus === 'clean';
}

/** PDF ou tableur Excel dans le dossier Financier → éligible au Scan & Parse IA. */
export function isFinancierParseCandidate(
  category: PropertyDocumentCategory,
  mimeType: string,
  fileName: string
): boolean {
  if (category !== 'financier') return false;
  const ext = getExtension(fileName);
  const mime = mimeType.toLowerCase();
  const isPdf = mime === 'application/pdf' || ext === '.pdf';
  const isSpreadsheet =
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    ext === '.xlsx' ||
    ext === '.xls';
  return isPdf || isSpreadsheet;
}

/**
 * Transition parsing après scan antivirus (Cloud Function / extension Firebase).
 * Éligible + clean → pending ; sinon not_applicable.
 */
export function resolveParsingStatusAfterVirusScan(
  virusScanStatus: 'pending' | 'clean' | 'infected',
  parsingEligible: boolean
): 'not_applicable' | 'pending' | 'completed' | 'failed' {
  if (virusScanStatus !== 'clean' || !parsingEligible) return 'not_applicable';
  return 'pending';
}

export function validationErrorMessage(
  code: Exclude<PropertyDocumentValidationResult, { ok: true }>['code'],
  locale: 'fr' | 'en'
): string {
  const fr: Record<typeof code, string> = {
    blocked_executable:
      'Fichier refusé : les exécutables et scripts (.exe, .bat, .js, .scr, etc.) sont interdits.',
    extension_not_allowed:
      'Format non autorisé. Seuls le document portable (PDF), le tableur Excel (XLSX/XLS) et le document Word (DOCX) sont acceptés.',
    mime_not_allowed:
      'Type de contenu non autorisé. Seuls le document portable (PDF), le tableur Excel (XLSX/XLS) et le document Word (DOCX) sont acceptés.',
    mime_extension_mismatch:
      'Le type de contenu ne correspond pas à l’extension du fichier. Téléversement bloqué par sécurité.',
  };
  const en: Record<typeof code, string> = {
    blocked_executable:
      'File rejected: executables and scripts (.exe, .bat, .js, .scr, etc.) are not allowed.',
    extension_not_allowed:
      'Format not allowed. Only portable document format (PDF), Excel spreadsheet (XLSX/XLS), and Word document (DOCX) are accepted.',
    mime_not_allowed:
      'Content type not allowed. Only portable document format (PDF), Excel spreadsheet (XLSX/XLS), and Word document (DOCX) are accepted.',
    mime_extension_mismatch:
      'Content type does not match the file extension. Upload blocked for security.',
  };
  return locale === 'fr' ? fr[code] : en[code];
}
