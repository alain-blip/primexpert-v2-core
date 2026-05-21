/**
 * Rendu PDF institutionnel — React + html2pdf.js (qualité magazine).
 */

import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import html2pdf from 'html2pdf.js';
import type { ReactElement } from 'react';

const LETTER_WIDTH = '8.5in';

export interface PdfGenerationOptions {
  filename: string;
}

const UNSUPPORTED_COLOR_RE = /oklch|oklab|color-mix|lab\(/i;

/** html2canvas ne parse pas les couleurs Tailwind v4 (oklch) — repli RGB hex. */
function sanitizeClonedDocumentForCanvas(clonedDoc: Document): void {
  const win = clonedDoc.defaultView;
  if (!win) return;
  const nodes = clonedDoc.body.querySelectorAll('*');
  nodes.forEach((node) => {
    const el = node as HTMLElement;
    const cs = win.getComputedStyle(el);
    const colorProps = [
      'color',
      'backgroundColor',
      'borderColor',
      'borderTopColor',
      'borderRightColor',
      'borderBottomColor',
      'borderLeftColor',
    ] as const;
    for (const prop of colorProps) {
      const val = cs[prop];
      if (!val || val === 'transparent' || val === 'rgba(0, 0, 0, 0)') continue;
      if (!UNSUPPORTED_COLOR_RE.test(val)) continue;
      if (prop === 'color') el.style.color = '#1a1a1a';
      else if (prop === 'backgroundColor') el.style.backgroundColor = '#ffffff';
      else el.style.borderColor = '#d4d4d4';
    }
  });
}

const DEFAULT_HTML2PDF_OPTIONS = {
  margin: 0,
  image: { type: 'jpeg' as const, quality: 0.98 },
  html2canvas: {
    scale: 2,
    logging: false,
    useCORS: true,
    letterRendering: true,
    onclone: (clonedDoc: Document) => sanitizeClonedDocumentForCanvas(clonedDoc),
  },
  jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const },
  pagebreak: {
    mode: ['css', 'legacy'] as const,
    after: '.pdf-page-break',
    avoid: ['tr', '.pdf-avoid-break', '.pdf-table-row'],
  },
};

function createOffscreenHost(): HTMLDivElement {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: LETTER_WIDTH,
    zIndex: '-1',
    pointerEvents: 'none',
    overflow: 'hidden',
  });
  document.body.appendChild(host);
  return host;
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function generatePdfFromElement(
  element: HTMLElement,
  options: PdfGenerationOptions
): Promise<void> {
  try {
    await html2pdf()
      .set({
        ...DEFAULT_HTML2PDF_OPTIONS,
        filename: options.filename,
      })
      .from(element)
      .save();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF_GENERATION_FAILED: ${msg}`);
  }
}

export async function renderReactTemplateToPdf(
  renderTemplate: (mountEl: HTMLDivElement) => ReactElement,
  options: PdfGenerationOptions
): Promise<void> {
  const host = createOffscreenHost();
  const mountEl = document.createElement('div');
  host.appendChild(mountEl);
  let root: Root | null = createRoot(mountEl);

  try {
    flushSync(() => {
      root!.render(renderTemplate(mountEl));
    });
    await waitForPaint();
    const templateRoot = mountEl.firstElementChild as HTMLElement | null;
    if (!templateRoot) {
      throw new Error('PDF_TEMPLATE_EMPTY');
    }
    await generatePdfFromElement(templateRoot, options);
  } finally {
    root?.unmount();
    root = null;
    document.body.removeChild(host);
  }
}
