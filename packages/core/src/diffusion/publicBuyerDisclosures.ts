/**
 * Blocs HTML injectés sur les fiches publiques WordPress (description acheteur).
 * Constante partagée core + functions (via vendoring).
 */

/** Mention légale affichée sur la fiche publique RPAaVendre.com (aperçu CRM + WP). */
export const PUBLIC_LEGAL_NO_WARRANTY_FR =
  'Cette résidence est vendue sans garantie légale de qualité aux risques et périls de l’acheteur' as const;

export const PUBLIC_LEGAL_NO_WARRANTY_EN =
  'This residence is sold without legal warranty of quality at the buyer’s own risk' as const;

/** Contrats à charge de l'acheteur — appendu en fin de description WP. */
export const PUBLIC_BUYER_CONTRACTS_HTML =
  '<p><strong>L’acheteur devra prendre en charge :</strong></p>' +
  '<ul><li>Les contrats de téléphonie et internet</li>' +
  '<li>Le contrat du système de sécurité</li>' +
  '<li>Les contrats d’entretien d’équipements</li></ul>';
