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
  return plain.replace(/\s+/g, ' ').trim();
}
