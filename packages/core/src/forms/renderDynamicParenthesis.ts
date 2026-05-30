/**
 * Rendu HTML des zones entre parenthèses — remplace les espaces Word / FORM TEXT.
 * Algorithme de substitution et de formatage des lignes de soulignement (SSOT).
 */

import type { ParenthesisFieldKind } from './annexeFieldSchema';

/** Échappement HTML — exporté pour réutilisation par les gabarits. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Coerce une valeur de formulaire (string|number) en nombre fini ou `undefined`. */
export function coerceNumber(value: string | number | null | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export const DYNAMIC_PARENTHESIS_CSS = `
.paren-slot {
  white-space: nowrap;
  letter-spacing: 0.02em;
}
.dynamic-value {
  display: inline-block;
  min-width: 3.5em;
  text-align: center;
  font-weight: 700;
  border-bottom: 1px solid #334155;
  padding: 0 0.15em;
  color: #142c6a;
}
.dynamic-value.is-empty {
  color: #94a3b8;
  font-weight: 600;
}
.ccv-prefix {
  font-weight: 700;
  letter-spacing: 0.04em;
}
`;

function formatInner(
  value: string | number | null | undefined,
  placeholder: string
): { html: string; empty: boolean } {
  if (value == null || value === '') {
    return { html: escapeHtml(placeholder), empty: true };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return {
      html: escapeHtml(
        new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 }).format(value)
      ),
      empty: false,
    };
  }
  const s = String(value).trim();
  if (!s) return { html: escapeHtml(placeholder), empty: true };
  return { html: escapeHtml(s), empty: false };
}

/** `( 123 456 $ )` — Annexe de prix. */
export function renderParenthesisMoney(
  value: number | null | undefined,
  placeholder = '___'
): string {
  const { html, empty } = formatInner(value, placeholder);
  return `<span class="paren-slot">( <span class="dynamic-value${empty ? ' is-empty' : ''}">${html}</span> $ )</span>`;
}

/** `( 2,5 % )` — Annexe R commission / taux de rétribution. */
export function renderParenthesisPercent(
  value: number | null | undefined,
  placeholder = '___'
): string {
  const { html, empty } = formatInner(value, placeholder);
  return `<span class="paren-slot">( <span class="dynamic-value${empty ? ' is-empty' : ''}">${html}</span> % )</span>`;
}

/** `( 30 jours )` — délais d'exclusivité, de préemption ou de mandat. */
export function renderParenthesisDays(
  value: number | null | undefined,
  placeholder = '___',
  locale: 'fr' | 'en' = 'fr'
): string {
  const { html, empty } = formatInner(value, placeholder);
  const unit = locale === 'en' ? 'days' : 'jours';
  return `<span class="paren-slot">( <span class="dynamic-value${empty ? ' is-empty' : ''}">${html}</span> ${unit} )</span>`;
}

/** `( texte )` — variable textuelle générique entre parenthèses. */
export function renderParenthesisText(
  value: string | number | null | undefined,
  placeholder = '__________'
): string {
  const { html, empty } = formatInner(value, placeholder);
  return `<span class="paren-slot">( <span class="dynamic-value${empty ? ' is-empty' : ''}">${html}</span> )</span>`;
}

/** `CCV-12345` — Annexe G. */
export function renderCcvReference(
  value: string | null | undefined,
  placeholder = '_____'
): string {
  const { html, empty } = formatInner(value, placeholder);
  return `<span class="ccv-prefix">CCV-</span><span class="dynamic-value${empty ? ' is-empty' : ''}">${html}</span>`;
}

/** Dispatcher unifié — sélectionne le formateur selon le type de variable ( ). */
export function renderParenthesisField(
  kind: ParenthesisFieldKind,
  value: string | number | null | undefined,
  locale: 'fr' | 'en' = 'fr'
): string {
  switch (kind) {
    case 'money':
      return renderParenthesisMoney(coerceNumber(value));
    case 'percent':
      return renderParenthesisPercent(coerceNumber(value));
    case 'days':
      return renderParenthesisDays(coerceNumber(value), '___', locale);
    case 'ccv':
      return renderCcvReference(value == null || value === '' ? undefined : String(value));
    case 'text':
    default:
      return renderParenthesisText(value);
  }
}
