/**
 * Rendu HTML — contrat de courtage + annexes (zones entre parenthèses stylisées).
 */

import type { ContractAssemblerFieldState } from './annexeFieldSchema';
import type { PaActifsRenderData } from './paActifsTypes';
import { PA_ACTIFS_HTML_STYLES } from './renderPaActifsToHtml';
import { renderPaActifsToHtml } from './renderPaActifsToHtml';
import {
  DYNAMIC_PARENTHESIS_CSS,
  renderCcvReference,
  renderParenthesisMoney,
  renderParenthesisPercent,
} from './renderDynamicParenthesis';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1]! : html;
}

function annexePrixSection(state: ContractAssemblerFieldState, locale: 'fr' | 'en'): string {
  const slot = renderParenthesisMoney(state.annexePrix.nouveauPrixNumerique);
  const intro =
    locale === 'fr'
      ? `Les parties conviennent de modifier le prix de vente convenu au contrat de courtage exclusif pour le porter à ${slot}, taxes en sus selon les modalités du contrat principal.`
      : `The parties agree to amend the sale price under the exclusive brokerage contract to ${slot}, plus applicable taxes.`;
  return `<section class="annexe-block"><h2>${locale === 'fr' ? 'Annexe — modification de prix' : 'Schedule — price amendment'}</h2><p>${intro}</p></section>`;
}

function annexeGSection(state: ContractAssemblerFieldState, locale: 'fr' | 'en'): string {
  const ref = renderCcvReference(state.annexeG.ccvReference);
  const intro =
    locale === 'fr'
      ? `Annexe G — confidentialité des coordonnées. Référence contrat : ${ref}. Le vendeur autorise la diffusion restreinte des coordonnées conformément aux dispositions de l'organisme.`
      : `Schedule G — contact confidentiality. Contract reference: ${ref}.`;
  return `<section class="annexe-block"><h2>${locale === 'fr' ? 'Annexe G' : 'Schedule G'}</h2><p>${intro}</p></section>`;
}

function annexeRSection(state: ContractAssemblerFieldState, locale: 'fr' | 'en'): string {
  const slot = renderParenthesisPercent(state.annexeR.retributionPct);
  const intro =
    locale === 'fr'
      ? `Annexe R — réduction de rétribution. Taux de commission réduit à ${slot} du prix de vente convenu, sous réserve de l'approbation écrite des parties.`
      : `Schedule R — commission reduction. Reduced brokerage fee: ${slot} of the agreed sale price.`;
  return `<section class="annexe-block"><h2>${locale === 'fr' ? 'Annexe R' : 'Schedule R'}</h2><p>${intro}</p></section>`;
}

function contratCourtageStub(locale: 'fr' | 'en'): string {
  return `<section class="annexe-block"><h2>${locale === 'fr' ? 'Contrat de courtage RPA' : 'RPA brokerage contract'}</h2><p>${locale === 'fr' ? 'Corps du mandat exclusif — généré nativement (sans fusion OpenXML). Les annexes cochées ci-dessous complètent le dossier.' : 'Exclusive mandate body — native generation.'}</p></section>`;
}

export interface RenderContractAssemblerHtmlInput {
  locale?: 'fr' | 'en';
  paData: PaActifsRenderData;
  assembler: ContractAssemblerFieldState;
  residenceLabel?: string;
}

/** Document HTML complet : contrat + annexes sélectionnées + promesse actifs optionnelle. */
export function renderContractAssemblerToHtml(input: RenderContractAssemblerHtmlInput): string {
  const locale = input.locale ?? input.paData.locale ?? 'fr';
  const { selection, ...fields } = input.assembler;
  const state: ContractAssemblerFieldState = { selection, ...fields };

  const parts: string[] = [];
  parts.push(
    `<p class="meta">${escapeHtml(input.residenceLabel ?? input.paData.residence.commercialName)} · ${escapeHtml(input.paData.generatedAtIso)}</p>`
  );

  if (selection.contratCourtage) {
    parts.push(contratCourtageStub(locale));
  }
  if (selection.annexePrix) {
    parts.push(annexePrixSection(state, locale));
  }
  if (selection.annexeG) {
    parts.push(annexeGSection(state, locale));
  }
  if (selection.annexeR) {
    parts.push(annexeRSection(state, locale));
  }
  if (selection.promesseActifs) {
    parts.push(extractBody(renderPaActifsToHtml(input.paData)));
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
.annexe-block { margin-top: 1.5rem; page-break-inside: avoid; }
</style>
</head>
<body class="pa-actifs">
<h1>${escapeHtml(title)}</h1>
${parts.join('\n')}
</body>
</html>`;
}
