/**
 * SSOT — taux de capitalisation global (TGA) et valeur capitalisée.
 *
 * Les entrées TGA peuvent arriver en pourcentage (8.5) ou en ratio (0.085).
 * Les consommateurs UI doivent appeler ces helpers plutôt que porter une
 * formule locale.
 */

import { safeNum } from './safeNumbers';

export function normalizeCapitalizationRate(value: unknown): number | null {
  const n = safeNum(value);
  if (n == null || n <= 0) return null;
  return n > 1 ? n / 100 : n;
}

export function normalizeCapitalizationRatePercent(value: unknown): number | null {
  const rate = normalizeCapitalizationRate(value);
  return rate == null ? null : rate * 100;
}

export function computeCapitalizationRateFromNoi(
  noi: unknown,
  propertyValue: unknown
): number | null {
  const n = safeNum(noi);
  const value = safeNum(propertyValue);
  if (n == null || value == null || n <= 0 || value <= 0) return null;
  return n / value;
}

export function computeCapitalizedValueFromNoi(
  noi: unknown,
  capitalizationRate: unknown
): number | null {
  const n = safeNum(noi);
  const rate = normalizeCapitalizationRate(capitalizationRate);
  if (n == null || rate == null || n <= 0 || rate <= 0) return null;
  return n / rate;
}
