/**
 * Compilateur HTML unifié — documents maîtres (contrats / promesse d'achat) et
 * annexes cochées fusionnés dans un seul flux épuré, prêt pour l'export PDF-A.
 *
 * Garantie : l'ordre du catalogue place les documents maîtres en tête, suivis des
 * annexes sélectionnées. Aucune fusion OpenXML; substitution native des variables ( ).
 */

import {
  CONTRACT_DOCUMENT_CATALOG,
  type ContractAnnexeId,
  type ContractAssemblerFieldState,
  type ContractRenderContext,
} from './annexeFieldSchema';
import type { PaActifsRenderData } from './paActifsTypes';
import { PA_ACTIFS_HTML_STYLES, renderPaActifsToHtml } from './renderPaActifsToHtml';
import { DYNAMIC_PARENTHESIS_CSS, escapeHtml } from './renderDynamicParenthesis';
import { renderContratCourtageRpaSection } from './templates/contratCourtageRpaTemplate';
import { renderContratCourtageAchatSection } from './templates/contratCourtageAchatTemplate';
import { renderAnnexeModificationSection } from './templates/annexesModificationTemplate';
import { renderAnnexeProtectionSection } from './templates/annexesProtectionTemplate';
import { renderAnnexeCoordinationSection } from './templates/annexesCoordinationTemplate';

function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1]! : html;
}

/** Table d'aiguillage : un document indexé → un gabarit du Core. */
const SECTION_RENDERERS: Record<ContractAnnexeId, (ctx: ContractRenderContext) => string> = {
  contratCourtage: renderContratCourtageRpaSection,
  contratCourtageAchat: renderContratCourtageAchatSection,
  promesseActifs: (ctx) => extractBody(renderPaActifsToHtml(ctx.paData)),
  annexeG: (ctx) => renderAnnexeProtectionSection('annexeG', ctx),
  annexeE: (ctx) => renderAnnexeProtectionSection('annexeE', ctx),
  annexePR: (ctx) => renderAnnexeProtectionSection('annexePR', ctx),
  annexeC: renderAnnexeCoordinationSection,
  annexeR: (ctx) => renderAnnexeModificationSection('annexeR', ctx),
  annexePrix: (ctx) => renderAnnexeModificationSection('annexePrix', ctx),
  annexeMiseHorsMarche: (ctx) => renderAnnexeModificationSection('annexeMiseHorsMarche', ctx),
  annexeRimouski: (ctx) => renderAnnexeModificationSection('annexeRimouski', ctx),
};

export interface RenderContractAssemblerHtmlInput {
  locale?: 'fr' | 'en';
  paData: PaActifsRenderData;
  assembler: ContractAssemblerFieldState;
  residenceLabel?: string;
}

/**
 * Document HTML complet : documents maîtres sélectionnés + annexes cochées,
 * compilés dans l'ordre canonique du catalogue.
 */
export function renderContractAssemblerToHtml(input: RenderContractAssemblerHtmlInput): string {
  const locale = input.locale ?? input.paData.locale ?? 'fr';
  const ctx: ContractRenderContext = {
    locale,
    values: input.assembler.values,
    paData: input.paData,
    residenceLabel: input.residenceLabel,
  };

  const parts: string[] = [
    `<p class="meta">${escapeHtml(
      input.residenceLabel ?? input.paData.residence.commercialName
    )} · ${escapeHtml(input.paData.generatedAtIso)}</p>`,
  ];

  for (const doc of CONTRACT_DOCUMENT_CATALOG) {
    if (!input.assembler.selection[doc.id]) continue;
    const render = SECTION_RENDERERS[doc.id];
    if (render) parts.push(render(ctx));
  }

  const title =
    locale === 'fr' ? 'Dossier de courtage et annexes' : 'Brokerage file and schedules';

  return `<!DOCTYPE html>
<html lang="${locale === 'fr' ? 'fr-CA' : 'en-CA'}">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
${PA_ACTIFS_HTML_STYLES}
${DYNAMIC_PARENTHESIS_CSS}
.contract-doc, .annexe-block { margin-top: 1.5rem; page-break-inside: avoid; }
.contract-doc + .contract-doc, .annexe-block { border-top: 1px solid #e2e8f0; padding-top: 1rem; }
</style>
</head>
<body class="pa-actifs">
<h1>${escapeHtml(title)}</h1>
${parts.join('\n')}
</body>
</html>`;
}
