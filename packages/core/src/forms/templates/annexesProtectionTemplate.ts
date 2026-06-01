/**
 * Annexes de protection — confidentialité (G), exclusion d'acheteur (E)
 * et droit de préemption (PR).
 */

import type { ContractAnnexeId, ContractRenderContext } from '../annexeFieldSchema';
import {
  escapeHtml,
  renderCcvReference,
  renderParenthesisDays,
  renderParenthesisText,
  coerceNumber,
} from '../renderDynamicParenthesis';

type ProtectionAnnexeId = 'annexeG' | 'annexeE' | 'annexePR';

function annexeGBody(ctx: ContractRenderContext): { title: string; html: string } {
  const fr = ctx.locale === 'fr';
  const ref = renderCcvReference(
    ctx.values['annexeG.ccvReference'] == null || ctx.values['annexeG.ccvReference'] === ''
      ? undefined
      : String(ctx.values['annexeG.ccvReference'])
  );
  return {
    title: fr ? 'Annexe G — confidentialité des coordonnées' : 'Schedule G — contact confidentiality',
    html: fr
      ? `<p>Référence du contrat : ${ref}. Le vendeur autorise une diffusion restreinte de ses coordonnées et impose la confidentialité des renseignements transmis dans le cadre de la diligence raisonnable, conformément aux dispositions applicables.</p>`
      : `<p>Contract reference: ${ref}. The seller authorizes restricted disclosure of contact details and requires confidentiality of the information shared during due diligence.</p>`,
  };
}

function annexeEBody(ctx: ContractRenderContext): { title: string; html: string } {
  const fr = ctx.locale === 'fr';
  const acheteur = renderParenthesisText(ctx.values['annexeE.acheteurExclu']);
  const delai = renderParenthesisDays(
    coerceNumber(ctx.values['annexeE.delaiExclusiviteJours']),
    '___',
    ctx.locale
  );
  return {
    title: fr ? 'Annexe E — exclusion d’acheteur' : 'Schedule E — buyer exclusion',
    html: fr
      ? `<p>Les parties conviennent d'exclure du champ de la rétribution exclusive l'acheteur identifié : ${acheteur}. Cette exclusion est valable pour un délai d'exclusivité de ${delai} suivant la signature de la présente annexe.</p>`
      : `<p>The parties agree to exclude the identified buyer ${acheteur} from the scope of the exclusive remuneration, for an exclusivity period of ${delai} following signature.</p>`,
  };
}

function annexePRBody(ctx: ContractRenderContext): { title: string; html: string } {
  const fr = ctx.locale === 'fr';
  const delai = renderParenthesisDays(
    coerceNumber(ctx.values['annexePR.delaiPreemptionJours']),
    '___',
    ctx.locale
  );
  return {
    title: fr ? 'Annexe PR — droit de préemption' : 'Schedule PR — right of pre-emption',
    html: fr
      ? `<p>Le bénéficiaire dispose d'un droit de préemption lui permettant d'acquérir la résidence aux mêmes conditions que toute offre de bonne foi reçue par le vendeur. Ce droit doit être exercé par écrit dans un délai de ${delai} suivant la notification de l'offre, à défaut de quoi il est réputé non exercé.</p>`
      : `<p>The beneficiary holds a right of pre-emption to acquire the residence on the same terms as any bona fide offer received by the seller. It must be exercised in writing within ${delai} of notice of the offer.</p>`,
  };
}

const PROTECTION_BUILDERS: Record<
  ProtectionAnnexeId,
  (ctx: ContractRenderContext) => { title: string; html: string }
> = {
  annexeG: annexeGBody,
  annexeE: annexeEBody,
  annexePR: annexePRBody,
};

/** Section HTML — annexe de protection (G / E / PR) selon l'identifiant. */
export function renderAnnexeProtectionSection(
  id: ContractAnnexeId,
  ctx: ContractRenderContext
): string {
  const builder = PROTECTION_BUILDERS[id as ProtectionAnnexeId];
  if (!builder) return '';
  const { title, html } = builder(ctx);
  return `<section class="annexe-block" id="${escapeHtml(id)}"><h2>${escapeHtml(title)}</h2>${html}</section>`;
}
