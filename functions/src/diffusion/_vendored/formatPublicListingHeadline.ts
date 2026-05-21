/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 *
 * Source canonique : packages/core/src/diffusion/
 * Régénéré par   : functions/scripts/sync-core-diffusion.cjs (prebuild)
 */
/**
 * Titre public acheteur dérivé de la fourchette d'unités (miroir RPAaVendre.com).
 */

import { UNITS_RANGE_UNKNOWN } from './priceRanges';

const ENTRE_UNITES_FR = /^entre\s+(\d+)\s+et\s+(\d+)\s+unités\s*$/i;

/**
 * Ex. « entre 35 et 40 unités » → « Résidence de 35 à 40 unités ».
 */
export function formatPublicListingHeadline(
  fourchetteUnites: string | null | undefined,
  locale: 'fr' | 'en' = 'fr'
): string {
  const raw = typeof fourchetteUnites === 'string' ? fourchetteUnites.trim() : '';
  if (!raw || raw === UNITS_RANGE_UNKNOWN) {
    return locale === 'fr' ? 'Résidence privée à vendre' : 'Private residence for sale';
  }

  const match = ENTRE_UNITES_FR.exec(raw);
  if (match) {
    const low = match[1];
    const high = match[2];
    return locale === 'fr'
      ? `Résidence de ${low} à ${high} unités`
      : `Residence with ${low} to ${high} units`;
  }

  return locale === 'fr' ? `Résidence — ${raw}` : `Residence — ${raw}`;
}
