/**
 * Annexes de modification (MO) et de rétribution — avenants au contrat principal :
 * prix de vente, réduction de rétribution (Annexe R), mise hors marché et
 * avenant régional « modèle Rimouski ».
 */

import type { ContractAnnexeId, ContractRenderContext } from '../annexeFieldSchema';
import {
  escapeHtml,
  renderParenthesisMoney,
  renderParenthesisPercent,
  renderParenthesisText,
  coerceNumber,
} from '../renderDynamicParenthesis';

type ModificationAnnexeId =
  | 'annexePrix'
  | 'annexeR'
  | 'annexeMiseHorsMarche'
  | 'annexeRimouski';

function annexePrixBody(ctx: ContractRenderContext): { title: string; html: string } {
  const fr = ctx.locale === 'fr';
  const slot = renderParenthesisMoney(coerceNumber(ctx.values['annexePrix.nouveauPrix']));
  return {
    title: fr ? 'Annexe (modification) — prix de vente' : 'Schedule (amendment) — sale price',
    html: fr
      ? `<p>Les parties conviennent de modifier le prix de vente convenu au contrat de courtage exclusif pour le porter à ${slot}, taxes en sus selon les modalités du contrat principal. Toutes les autres clauses demeurent inchangées.</p>`
      : `<p>The parties agree to amend the agreed sale price under the exclusive brokerage contract to ${slot}, plus applicable taxes. All other clauses remain unchanged.</p>`,
  };
}

function annexeRBody(ctx: ContractRenderContext): { title: string; html: string } {
  const fr = ctx.locale === 'fr';
  const slot = renderParenthesisPercent(coerceNumber(ctx.values['annexeR.retributionPct']));
  return {
    title: fr ? 'Annexe R — réduction de rétribution' : 'Schedule R — remuneration reduction',
    html: fr
      ? `<p>Le taux de rétribution prévu au contrat principal est réduit à ${slot} du prix de vente convenu, sous réserve de l'approbation écrite des parties. Cette réduction s'applique à compter de la signature de la présente annexe.</p>`
      : `<p>The remuneration rate set out in the main contract is reduced to ${slot} of the agreed sale price, subject to the parties’ written approval.</p>`,
  };
}

function annexeMiseHorsMarcheBody(ctx: ContractRenderContext): { title: string; html: string } {
  const fr = ctx.locale === 'fr';
  const slot = renderParenthesisText(ctx.values['annexeMiseHorsMarche.dateRetrait']);
  return {
    title: fr
      ? 'Annexe (modification) — mise hors marché'
      : 'Schedule (amendment) — market withdrawal',
    html: fr
      ? `<p>Les parties conviennent de retirer temporairement la résidence du marché à compter du ${slot}. La période d'inscription est suspendue sans rompre le contrat de courtage exclusif; elle reprend automatiquement à la levée de la présente mise hors marché.</p>`
      : `<p>The parties agree to temporarily withdraw the residence from the market as of ${slot}. The listing period is suspended without terminating the exclusive brokerage contract.</p>`,
  };
}

function annexeRimouskiBody(ctx: ContractRenderContext): { title: string; html: string } {
  const fr = ctx.locale === 'fr';
  const slot = renderParenthesisText(ctx.values['annexeRimouski.particularite']);
  return {
    title: fr
      ? 'Annexe (modification) — avenant modèle Rimouski'
      : 'Schedule (amendment) — Rimouski model addendum',
    html: fr
      ? `<p>Avenant régional « modèle Rimouski » — les parties intègrent la particularité suivante propre au marché régional : ${slot}. Cet avenant complète, sans les contredire, les clauses du contrat principal et des autres annexes.</p>`
      : `<p>Regional “Rimouski model” addendum — the parties incorporate the following regional specificity: ${slot}. This addendum supplements the main contract without contradicting it.</p>`,
  };
}

const MODIFICATION_BUILDERS: Record<
  ModificationAnnexeId,
  (ctx: ContractRenderContext) => { title: string; html: string }
> = {
  annexePrix: annexePrixBody,
  annexeR: annexeRBody,
  annexeMiseHorsMarche: annexeMiseHorsMarcheBody,
  annexeRimouski: annexeRimouskiBody,
};

/** Section HTML — avenant de modification ou de rétribution selon l'identifiant. */
export function renderAnnexeModificationSection(
  id: ContractAnnexeId,
  ctx: ContractRenderContext
): string {
  const builder = MODIFICATION_BUILDERS[id as ModificationAnnexeId];
  if (!builder) return '';
  const { title, html } = builder(ctx);
  return `<section class="annexe-block" id="${escapeHtml(id)}"><h2>${escapeHtml(title)}</h2>${html}</section>`;
}
