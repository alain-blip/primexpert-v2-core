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

/**
 * MIME pour `uploadBytes` — évite `application/octet-stream` sur les PDF
 * (sinon aperçu inline bloqué dans le navigateur).
 */
export function resolveUploadContentType(file: File): string {
  const validation = validatePropertyDocumentFile(file);
  if (validation.ok) return validation.mimeType;
  const ext = getExtension(file.name || '');
  const fromExt = MIME_BY_EXTENSION[ext as keyof typeof MIME_BY_EXTENSION];
  if (fromExt) return fromExt;
  const declared = (file.type || '').trim().toLowerCase();
  return declared && declared !== 'application/octet-stream' ? declared : 'application/octet-stream';
}

/** Téléchargement autorisé uniquement après scan antivirus « clean ». */
export function canDownloadPropertyDocument(virusScanStatus: string | undefined): boolean {
  return virusScanStatus === 'clean';
}

function normalizeFileNameHint(fileName: string): string {
  return fileName
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function isPdfMime(mimeType: string, fileName: string): boolean {
  const ext = getExtension(fileName);
  const mime = mimeType.toLowerCase();
  return mime === 'application/pdf' || ext === '.pdf';
}

/** Pipeline universel — PDF uniquement (Vertex/Gemini inlineData). */
export function isPropertyDocumentParseCandidate(
  _category: PropertyDocumentCategory,
  mimeType: string,
  fileName: string
): boolean {
  return isPdfMime(mimeType, fileName);
}

/** Erreurs d’analyse IA qui ne doivent pas être relancées automatiquement. */
export function isPermanentParseFailure(parsingError?: string | null): boolean {
  if (!parsingError) return false;
  const e = parsingError.trim();
  return (
    e === 'invalid_storage_path' ||
    e === 'mime_not_supported_for_parse' ||
    e === 'format_excel_use_pdf' ||
    e.startsWith('FORMAT_EXCEL_')
  );
}

/** Document prêt pour analyse IA (pending, legacy not_applicable, ou retry failed). */
export function documentNeedsIaParse(doc: {
  virusScanStatus: string;
  parsingStatus: string;
  parsingEligible: boolean;
  isValidated?: boolean;
  parsingError?: string;
}): boolean {
  if (doc.virusScanStatus !== 'clean' || doc.isValidated === true) return false;
  if (!doc.parsingEligible) return false;
  if (doc.parsingStatus === 'completed' || doc.parsingStatus === 'verified') return false;
  if (doc.parsingStatus === 'pending') return true;
  if (doc.parsingStatus === 'not_applicable') return true;
  if (doc.parsingStatus === 'failed' && !isPermanentParseFailure(doc.parsingError)) return true;
  return false;
}

export function formatParsingErrorMessage(
  parsingError: string | undefined,
  locale: 'fr' | 'en'
): string {
  if (!parsingError?.trim()) {
    return locale === 'fr'
      ? 'L’analyse IA a échoué. Réessayez ou téléversez un PDF.'
      : 'AI analysis failed. Retry or upload a PDF.';
  }
  const e = parsingError.trim();
  const fr: Record<string, string> = {
    invalid_storage_path: 'Fichier introuvable dans le stockage sécurisé. Téléversez à nouveau le document.',
    mime_not_supported_for_parse:
      'Format non analysable par l’IA. Utilisez un document portable (PDF).',
    format_excel_use_pdf:
      'Les tableurs Excel ne sont pas analysés par l’IA. Exportez ou enregistrez le fichier en PDF, puis téléversez-le.',
  };
  const en: Record<string, string> = {
    invalid_storage_path: 'File not found in secure storage. Upload the document again.',
    mime_not_supported_for_parse:
      'Format not supported for AI analysis. Use a portable document (PDF).',
    format_excel_use_pdf:
      'Excel spreadsheets are not analyzed by AI. Export or save as PDF, then upload.',
  };
  if (e in fr) return locale === 'fr' ? fr[e] : en[e];
  if (e.startsWith('VERTEX_API_DISABLED')) {
    return locale === 'fr'
      ? 'Service Vertex AI non activé sur le projet Firebase. Contactez l’administrateur.'
      : 'Vertex AI API is not enabled on the Firebase project. Contact your administrator.';
  }
  if (e.startsWith('VERTEX_PERMISSION_DENIED')) {
    return locale === 'fr'
      ? 'Droits Vertex AI insuffisants pour le parseur. Contactez l’administrateur.'
      : 'Insufficient Vertex AI permissions for the parser. Contact your administrator.';
  }
  if (e.startsWith('VERTEX_MODEL_NOT_FOUND')) {
    return locale === 'fr'
      ? 'Modèle Gemini introuvable. Vérifiez la configuration Vertex (gemini-2.5-flash).'
      : 'Gemini model not found. Check Vertex configuration (gemini-2.5-flash).';
  }
  return e.length > 280 ? `${e.slice(0, 280)}…` : e;
}

/** @deprecated Utiliser isPropertyDocumentParseCandidate — conservé pour compatibilité. */
export function isFinancierParseCandidate(
  category: PropertyDocumentCategory,
  mimeType: string,
  fileName: string
): boolean {
  return isPropertyDocumentParseCandidate(category, mimeType, fileName);
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

export function splitPropertyDocumentFileName(fileName: string): { base: string; ext: string } {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return { base: fileName, ext: '' };
  }
  return { base: fileName.slice(0, lastDot), ext: fileName.slice(lastDot) };
}

/** Réattache l’extension d’origine si le courtier ne la saisit pas. */
export function ensureOriginalFileExtension(input: string, originalFileName: string): string {
  const trimmed = input.trim().replace(/[/\\]/g, '_');
  if (!trimmed) {
    const err = new Error('EMPTY_DOCUMENT_NAME');
    throw err;
  }

  const { ext } = splitPropertyDocumentFileName(originalFileName);
  if (!ext) return trimmed;

  if (trimmed.toLowerCase().endsWith(ext.toLowerCase())) {
    return trimmed;
  }

  const dot = trimmed.lastIndexOf('.');
  let base = trimmed;
  if (dot > 0 && dot < trimmed.length - 1) {
    const suffix = trimmed.slice(dot);
    if (/^\.[a-z0-9]{1,6}$/i.test(suffix)) {
      base = trimmed.slice(0, dot).trimEnd();
    }
  }
  return `${base}${ext}`;
}
