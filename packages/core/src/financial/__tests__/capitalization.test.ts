import { describe, expect, it } from 'vitest';
import {
  applyCapRateAdjustmentPct,
  capitalizeNoiAtCapRatePct,
  normalizeCapRateToDecimal,
  normalizeCapRateToPct,
  resolveNoiFromValueAndCapRatePct,
  resolveOperatingExpensesFromRbeAndNoi,
} from '../capitalization';

describe('financial/capitalization', () => {
  it('normalise un TGA exprimé en pourcentage ou en décimal', () => {
    expect(normalizeCapRateToDecimal(8.5)).toBe(0.085);
    expect(normalizeCapRateToDecimal(0.085)).toBe(0.085);
    expect(normalizeCapRateToPct(0.085)).toBe(8.5);
    expect(normalizeCapRateToPct(8.5)).toBe(8.5);
  });

  it('centralise les conversions RNE, TGA et valeur', () => {
    expect(applyCapRateAdjustmentPct(8.5, 0.25)).toBe(8.75);
    expect(capitalizeNoiAtCapRatePct(850_000, 8.5)).toBe(10_000_000);
    expect(resolveNoiFromValueAndCapRatePct(10_000_000, 8.5)).toBe(850_000);
    expect(resolveOperatingExpensesFromRbeAndNoi(1_200_000, 850_000)).toBe(350_000);
  });

  it('refuse les entrées invalides', () => {
    expect(normalizeCapRateToDecimal(0)).toBeNull();
    expect(capitalizeNoiAtCapRatePct(0, 8.5)).toBeNull();
    expect(resolveNoiFromValueAndCapRatePct(0, 8.5)).toBeNull();
    expect(resolveOperatingExpensesFromRbeAndNoi(1_200_000, 1_250_000)).toBeNull();
  });
});
