/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/documents/
 * Régénéré : functions/scripts/sync-core-documents.cjs (prebuild)
 */
export function coerceOperatingRatioPct(value: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  let v = value;
  if (v > 0 && v <= 1) v *= 100;
  else if (v > 100 && v <= 10_000) v /= 100;
  if (v <= 0 || v > 100) return undefined;
  return Math.round(v * 1000) / 1000;
}
