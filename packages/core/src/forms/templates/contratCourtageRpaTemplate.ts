/**
 * CCVE — Contrat de courtage exclusif (vente), résidence pour aînés (RPA).
 * Texte d'affaires statique + variables ( ) injectées via renderDynamicParenthesis.
 */

import type { ContractRenderContext } from '../annexeFieldSchema';
import {
  escapeHtml,
  renderParenthesisDays,
  renderParenthesisPercent,
  coerceNumber,
} from '../renderDynamicParenthesis';

export const CCVE_OBJET_FR =
  "Le vendeur confie en exclusivité au courtier le mandat de proposer à la vente l'entreprise et les actifs de la résidence pour aînés (RPA) désignée ci-dessous, et de l'assister jusqu'à la signature de l'acte de vente.";

export const CCVE_DECLARATIONS_FR =
  "Le vendeur déclare détenir tous les droits requis pour conclure la présente vente et s'engage à collaborer de bonne foi à la diligence raisonnable de l'acheteur éventuel.";

/** Section HTML — contrat de courtage exclusif vente (document maître). */
export function renderContratCourtageRpaSection(ctx: ContractRenderContext): string {
  const fr = ctx.locale === 'fr';
  const taux = renderParenthesisPercent(coerceNumber(ctx.values['contratCourtage.tauxRetributionPct']));
  const duree = renderParenthesisDays(
    coerceNumber(ctx.values['contratCourtage.dureeJours']),
    '___',
    ctx.locale
  );
  const r = ctx.paData.residence;
  const designation = `${escapeHtml(r.commercialName)} — ${escapeHtml(r.civicAddress)}${
    r.city ? `, ${escapeHtml(r.city)}` : ''
  }`;
  const broker = `${escapeHtml(ctx.paData.broker.displayName)}, permis OACIQ ${escapeHtml(
    ctx.paData.broker.licenseNumber
  )}, ${escapeHtml(ctx.paData.broker.agencyName)}`;

  const title = fr
    ? "CCVE — Contrat de courtage exclusif (vente)"
    : 'CCVE — Exclusive brokerage contract (sale)';

  const body = fr
    ? `<p><strong>1. Objet.</strong> ${escapeHtml(CCVE_OBJET_FR)}</p>
<p><strong>2. Désignation.</strong> ${designation}.</p>
<p><strong>3. Durée.</strong> Le présent contrat est en vigueur pour une durée de ${duree} à compter de sa signature.</p>
<p><strong>4. Rétribution.</strong> En cas de vente, le vendeur versera au courtier une rétribution équivalant à ${taux} du prix de vente convenu, taxes en sus.</p>
<p><strong>5. Déclarations.</strong> ${escapeHtml(CCVE_DECLARATIONS_FR)}</p>
<p><strong>6. Courtier.</strong> ${broker}.</p>`
    : `<p><strong>1. Purpose.</strong> The seller grants the broker the exclusive mandate to market the seniors’ residence designated below.</p>
<p><strong>2. Designation.</strong> ${designation}.</p>
<p><strong>3. Term.</strong> This contract is in force for ${duree} from signature.</p>
<p><strong>4. Remuneration.</strong> Upon sale, the seller shall pay the broker a remuneration of ${taux} of the agreed sale price, plus applicable taxes.</p>
<p><strong>5. Broker.</strong> ${broker}.</p>`;

  return `<section class="contract-doc" id="ccve">
<h2>${escapeHtml(title)}</h2>
${body}
</section>`;
}
