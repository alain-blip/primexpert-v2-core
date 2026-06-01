/**
 * Annexe C — coordination des intervenants professionnels (notaire, avocat,
 * comptable professionnel agréé (CPA), courtier collaborateur).
 */

import type { ContractRenderContext } from '../annexeFieldSchema';
import { escapeHtml, renderParenthesisText } from '../renderDynamicParenthesis';

/** Section HTML — coordination des intervenants professionnels. */
export function renderAnnexeCoordinationSection(ctx: ContractRenderContext): string {
  const fr = ctx.locale === 'fr';
  const pivot = renderParenthesisText(ctx.values['annexeC.intervenantPivot']);
  const title = fr
    ? 'Annexe C — coordination des intervenants professionnels'
    : 'Schedule C — professional stakeholder coordination';
  const body = fr
    ? `<p>Les parties désignent l'intervenant pivot ${pivot} responsable de coordonner les échanges entre le notaire, l'avocat, le comptable professionnel agréé (CPA) et le courtier collaborateur, afin d'assurer le respect des échéances de la diligence raisonnable et de la clôture.</p>`
    : `<p>The parties designate the lead stakeholder ${pivot} responsible for coordinating exchanges between the notary, lawyer, chartered professional accountant (CPA) and collaborating broker, to ensure due-diligence and closing deadlines are met.</p>`;
  return `<section class="annexe-block" id="annexe-c"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}
