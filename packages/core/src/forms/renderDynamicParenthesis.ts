/**
 * Rendu HTML des zones entre parenthèses — remplace les espaces Word / FORM TEXT.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

/** `( 2,5 % )` — Annexe R commission. */
export function renderParenthesisPercent(
  value: number | null | undefined,
  placeholder = '___'
): string {
  const { html, empty } = formatInner(value, placeholder);
  return `<span class="paren-slot">( <span class="dynamic-value${empty ? ' is-empty' : ''}">${html}</span> % )</span>`;
}

/** `CCV-12345` — Annexe G. */
export function renderCcvReference(
  value: string | null | undefined,
  placeholder = '_____'
): string {
  const { html, empty } = formatInner(value, placeholder);
  return `<span class="ccv-prefix">CCV-</span><span class="dynamic-value${empty ? ' is-empty' : ''}">${html}</span>`;
}
