/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 *
 * Source canonique : packages/core/src/diffusion/
 * Régénéré par   : functions/scripts/sync-core-diffusion.cjs (prebuild)
 */
/**
 * Fourchettes de prix, arrondi taux d'occupation et catégorie visuelle
 * — buckets numériques d'anonymisation.
 *
 * Aucun prix exact ni taux non arrondi ne doit transiter dans le silo
 * `public_listings`. Le nombre d'unités sert également à dériver la catégorie
 * visuelle (image générique non identifiante).
 *
 * Port TypeScript de `00_RPA_SYSTEME_APP/.../constants/publicListing.js` et
 * `visualPolicy.js`. Réutilise `safeNum` du core finance pour parsing tolérant.
 */

import { safeNum } from './safeNumbers';
import { VISUAL_CATEGORY, type VisualCategory } from './types';

// ============================================================================
// FOURCHETTES DE PRIX
// ============================================================================

export interface PriceRangeBucket {
  readonly min: number;
  readonly max: number;
  readonly label: string;
}

export const PRICE_RANGES: ReadonlyArray<PriceRangeBucket> = Object.freeze([
  Object.freeze({ min: 0, max: 500_000, label: 'Moins de 500K' }),
  Object.freeze({ min: 500_000, max: 1_000_000, label: '500K-1M' }),
  Object.freeze({ min: 1_000_000, max: 2_000_000, label: '1M-2M' }),
  Object.freeze({ min: 2_000_000, max: 3_000_000, label: '2M-3M' }),
  Object.freeze({ min: 3_000_000, max: 5_000_000, label: '3M-5M' }),
  Object.freeze({ min: 5_000_000, max: 10_000_000, label: '5M-10M' }),
  Object.freeze({
    min: 10_000_000,
    max: Number.POSITIVE_INFINITY,
    label: '10M+',
  }),
]);

export const PRICE_RANGE_UNKNOWN = 'Non divulgué' as const;

/**
 * Convertit un prix brut en fourchette anonymisée.
 *
 * @param price Prix exact (nombre, chaîne « 4 250 000 », `null`, etc.).
 * @returns Libellé de fourchette (ex. « 2M-3M ») ou `PRICE_RANGE_UNKNOWN`
 *          si la valeur est manquante / ≤ 0 / non numérique.
 */
export function getPriceRange(price: unknown): string {
  const value = safeNum(price);
  if (value == null || value <= 0) return PRICE_RANGE_UNKNOWN;
  const bucket = PRICE_RANGES.find((b) => value >= b.min && value < b.max);
  return bucket?.label ?? PRICE_RANGE_UNKNOWN;
}

// ============================================================================
// ARRONDI TAUX D'OCCUPATION
// ============================================================================

/**
 * Arrondit le taux d'occupation selon le nombre d'unités pour empêcher la
 * rétro-identification d'une fiche par déduction (ex. 33/35 occupées = 94 %
 * trop précis pour un parc < 40 unités).
 *
 * Tolère ratio 0–1 et pourcentage 0–100 en entrée.
 *
 *  - nombreUnites < 40   → pas de 10 % (ex. 94 → 90)
 *  - nombreUnites ≥ 40   → pas de 5 %  (ex. 94 → 95)
 *
 * @returns Pourcentage arrondi dans 0–100, ou `null` si entrée invalide.
 */
export function arrondirTauxOccupation(
  tauxOccupation: unknown,
  nombreUnites: unknown
): number | null {
  const taux = safeNum(tauxOccupation);
  if (taux == null) return null;

  const pct = taux > 0 && taux <= 1 ? taux * 100 : taux;
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;

  const unites = safeNum(nombreUnites) ?? 0;
  const step = unites >= 40 ? 5 : 10;
  return Math.round(pct / step) * step;
}

// ============================================================================
// CATÉGORIE VISUELLE — bucket par seuils d'unités
// ============================================================================

/**
 * Détermine la catégorie visuelle générique d'une résidence pour la sélection
 * d'image publique (Imagen 3 ou banque maison).
 *
 *  -   < 40 unités  → COMPACT
 *  -  40-99 unités  → MEDIUM
 *  -  ≥ 100 unités  → INSTITUTIONAL
 *
 * Une catégorie est toujours retournée (défaut `COMPACT`) — la fonction est
 * totale : aucune résidence ne doit rester sans visuel par défaut.
 */
export function getVisualCategory(nombreUnites: unknown): VisualCategory {
  const n = safeNum(nombreUnites) ?? 0;
  if (n >= 100) return VISUAL_CATEGORY.INSTITUTIONAL;
  if (n >= 40) return VISUAL_CATEGORY.MEDIUM;
  return VISUAL_CATEGORY.COMPACT;
}

// ============================================================================
// FOURCHETTE UNITÉS — anonymisation publique (jamais le nombre exact)
// ============================================================================

export const UNITS_RANGE_EXACT_38_LABEL = 'entre 35 et 40 unités' as const;
export const UNITS_RANGE_UNKNOWN = 'Non divulgué' as const;

/**
 * Libellé public de capacité (fourchette) — ex. « entre 35 et 40 unités ».
 *
 * Exception métier stricte : exactement 38 unités → libellé fixe (exonération
 * de divulgation du dénombrement réel sur RPAaVendre.com).
 */
export function getPublicUnitsRangeLabel(nombreUnites: unknown): string {
  const n = safeNum(nombreUnites);
  if (n == null || n <= 0) return UNITS_RANGE_UNKNOWN;
  if (n === 38) return UNITS_RANGE_EXACT_38_LABEL;

  const step = n >= 40 ? 10 : 5;
  const low = Math.max(1, Math.floor(n / step) * step);
  const high = low + step;
  return `entre ${low} et ${high} unités`;
}
