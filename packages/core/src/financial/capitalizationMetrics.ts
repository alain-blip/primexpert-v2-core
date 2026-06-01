import { safeNum } from './safeNumbers';

/**
 * Normalise un taux de capitalisation global (TGA) en ratio décimal.
 * Accepte 8.5, "8,5 %" ou 0.085 et retourne 0.085.
 */
export function normalizeCapitalizationRate(value: unknown): number | null {
  const n = safeNum(value);
  if (n == null || n <= 0) return null;
  const ratio = n > 1 ? n / 100 : n;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

/** Calcule le taux de capitalisation global (TGA) décimal depuis le RNE et le prix. */
export function computeCapitalizationRateFromNoi(
  revenuNetExploitation: unknown,
  price: unknown
): number | null {
  const rne = safeNum(revenuNetExploitation);
  const normalizedPrice = safeNum(price);
  if (rne == null || normalizedPrice == null || rne <= 0 || normalizedPrice <= 0) return null;
  return rne / normalizedPrice;
}

/** Calcule la valeur capitalisée depuis le RNE et un TGA fourni en ratio ou pourcentage. */
export function computeCapitalizedValueFromNoi(
  revenuNetExploitation: unknown,
  capitalizationRate: unknown
): number | null {
  const rne = safeNum(revenuNetExploitation);
  const rate = normalizeCapitalizationRate(capitalizationRate);
  if (rne == null || rne <= 0 || rate == null) return null;
  return rne / rate;
}
