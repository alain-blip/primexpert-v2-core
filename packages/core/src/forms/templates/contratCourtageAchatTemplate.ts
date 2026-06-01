/**
 * CC-ACHAT — Contrat de courtage exclusif (recherche d'achat commercial).
 * Texte d'affaires statique + variables ( ) injectées via renderDynamicParenthesis.
 */

import type { ContractRenderContext } from '../annexeFieldSchema';
import {
  escapeHtml,
  renderParenthesisDays,
  renderParenthesisPercent,
  coerceNumber,
} from '../renderDynamicParenthesis';

export const CC_ACHAT_OBJET_FR =
  "L'acheteur confie en exclusivité au courtier le mandat de rechercher et de lui présenter des immeubles commerciaux ou des résidences pour aînés (RPA) correspondant à ses critères, et de l'assister dans la négociation jusqu'à l'acceptation d'une promesse d'achat.";

/** Section HTML — contrat de courtage exclusif achat (document maître). */
export function renderContratCourtageAchatSection(ctx: ContractRenderContext): string {
  const fr = ctx.locale === 'fr';
  const taux = renderParenthesisPercent(
    coerceNumber(ctx.values['contratCourtageAchat.tauxRetributionPct'])
  );
  const duree = renderParenthesisDays(
    coerceNumber(ctx.values['contratCourtageAchat.dureeJours']),
    '___',
    ctx.locale
  );
  const broker = `${escapeHtml(ctx.paData.broker.displayName)}, permis OACIQ ${escapeHtml(
    ctx.paData.broker.licenseNumber
  )}, ${escapeHtml(ctx.paData.broker.agencyName)}`;
  const acheteur = escapeHtml(ctx.paData.buyer.fullName);

  const title = fr
    ? 'CC-ACHAT — Contrat de courtage exclusif (recherche d’achat)'
    : 'CC-ACHAT — Exclusive brokerage contract (purchase search)';

  const body = fr
    ? `<p><strong>1. Objet.</strong> ${escapeHtml(CC_ACHAT_OBJET_FR)}</p>
<p><strong>2. Acheteur mandant.</strong> ${acheteur}.</p>
<p><strong>3. Durée.</strong> Le présent mandat est en vigueur pour une durée de ${duree} à compter de sa signature.</p>
<p><strong>4. Rétribution.</strong> À la conclusion d'une transaction visée par le présent mandat, le courtier a droit à une rétribution équivalant à ${taux} du prix d'achat, taxes en sus, payable selon les modalités convenues.</p>
<p><strong>5. Courtier.</strong> ${broker}.</p>`
    : `<p><strong>1. Purpose.</strong> The buyer grants the broker the exclusive mandate to search for and present commercial properties or seniors’ residences matching the buyer’s criteria.</p>
<p><strong>2. Principal buyer.</strong> ${acheteur}.</p>
<p><strong>3. Term.</strong> This mandate is in force for ${duree} from signature.</p>
<p><strong>4. Remuneration.</strong> Upon closing of a transaction covered by this mandate, the broker is entitled to a remuneration of ${taux} of the purchase price, plus applicable taxes.</p>
<p><strong>5. Broker.</strong> ${broker}.</p>`;

  return `<section class="contract-doc" id="cc-achat">
<h2>${escapeHtml(title)}</h2>
${body}
</section>`;
}
