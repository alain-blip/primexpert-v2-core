import DOMPurify from 'dompurify';

const PURIFY_OPTS: Parameters<typeof DOMPurify.sanitize>[1] = {
  USE_PROFILES: { html: true },
};

/** Détecte un corps courriel HTML (Nylas / Gmail). */
export function isHtmlEmailBody(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body.trim());
}

/** HTML courriel assaini pour dangerouslySetInnerHTML. */
export function sanitizeEmailHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '';
  return DOMPurify.sanitize(trimmed, PURIFY_OPTS);
}

/** Extrait le texte visible pour aperçus (liste de fils). */
export function emailHtmlToPlainText(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '';
  if (!isHtmlEmailBody(trimmed)) return trimmed;
  const plain = DOMPurify.sanitize(trimmed, { ALLOWED_TAGS: [] });
  const collapsed = plain.replace(/\s+/g, ' ').trim();
  if (collapsed) return collapsed;
  return trimmed
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * TEMP PO — désactiver via `VITE_EMAIL_PURIFY_IFRAME=true` une fois l’affichage validé.
 * Par défaut : HTML brut dans l’iframe (évite DOMPurify qui peut vider certains courriels Nylas).
 */
const USE_EMAIL_PURIFY_IN_IFRAME = import.meta.env.VITE_EMAIL_PURIFY_IFRAME === 'true';

function emailHtmlForIframeSrc(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '';
  if (!USE_EMAIL_PURIFY_IN_IFRAME) return trimmed;
  const sanitized = sanitizeEmailHtml(trimmed);
  return sanitized.trim() || trimmed;
}

/** Document HTML isolé pour iframe `srcDoc` (panneau de lecture). */
export function buildEmailIframeSrcDoc(html: string): string {
  const inner = emailHtmlForIframeSrc(html);
  if (!inner) return '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank" rel="noopener noreferrer"><style>html,body{margin:0;padding:0;min-height:100%;}body{padding:12px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.55;color:#0f172a;background:#ffffff;}img{max-width:100%;height:auto;}a{color:#2563eb;}</style></head><body>${inner}</body></html>`;
}
