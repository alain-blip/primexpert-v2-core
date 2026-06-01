/**
 * Capitalization metrics — SSOT RNE/TGA.
 *
 * Keep capitalization math in @primexpert/core/financial so UI and feature
 * modules consume the same percent normalization and RNE/TGA formulas.
 */

function positiveFinite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Normalize a capitalization rate to decimal form.
 *
 * Accepts either a UI percentage (`8.5`) or stored decimal (`0.085`).
 */
export function normalizeCapitalizationRate(
  capRate: number | null | undefined
): number | null {
  const value = positiveFinite(capRate);
  if (value == null) return null;
  return value > 1 ? value / 100 : value;
}

/**
 * Normalize a capitalization rate to percentage points for display/selection.
 */
export function normalizeCapitalizationRatePct(
  capRate: number | null | undefined
): number | null {
  const normalized = normalizeCapitalizationRate(capRate);
  return normalized == null ? null : normalized * 100;
}

/**
 * Compute TGA from RNE and price, returned as a decimal ratio.
 */
export function computeCapitalizationRateFromNoi(
  noi: number | null | undefined,
  price: number | null | undefined
): number | null {
  const safeNoi = positiveFinite(noi);
  const safePrice = positiveFinite(price);
  return safeNoi != null && safePrice != null ? safeNoi / safePrice : null;
}

/**
 * Compute capitalized value from RNE and TGA.
 *
 * `capRate` may be provided as percentage (`8.5`) or decimal (`0.085`).
 */
export function computeCapitalizedValueFromNoi(
  noi: number | null | undefined,
  capRate: number | null | undefined
): number | null {
  const safeNoi = positiveFinite(noi);
  const normalizedRate = normalizeCapitalizationRate(capRate);
  return safeNoi != null && normalizedRate != null ? safeNoi / normalizedRate : null;
}
