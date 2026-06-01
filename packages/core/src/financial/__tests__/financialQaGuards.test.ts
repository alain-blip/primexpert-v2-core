import { describe, expect, it } from 'vitest';

import {
  formatDecimalTgaPct,
  isManualTgaOverride,
  percentToDecimal,
  resolveAppliedTgaPct,
  resolveDynamicMarketTgaPct,
} from '../acmTgaControls';
import { assessNoiEvidence } from '../noiEvidenceAssessment';

describe('financial QA guards', () => {
  it('résout le TGA de marché selon la priorité SSOT', () => {
    expect(
      resolveDynamicMarketTgaPct({
        territorialCompetitionMedianTgaPct: 7.25,
        territorialMedianTgaPct: 8.5,
        fallbackTgaPct: 9,
      })
    ).toBe(7.25);

    expect(
      resolveDynamicMarketTgaPct({
        territorialCompetitionMedianTgaPct: null,
        territorialMedianTgaPct: 8.5,
        fallbackTgaPct: 9,
      })
    ).toBe(8.5);
  });

  it('centralise les conversions et ajustements TGA', () => {
    expect(resolveAppliedTgaPct({
      isManualOverride: false,
      manualTgaPct: 12,
      marketTgaPct: 8,
      qualitativeAdjustmentPct: 0.25,
    })).toBe(8.25);
    expect(resolveAppliedTgaPct({
      isManualOverride: true,
      manualTgaPct: 7.75,
      marketTgaPct: 8,
      qualitativeAdjustmentPct: 0.25,
    })).toBe(7.75);
    expect(percentToDecimal(8.25)).toBe(0.0825);
    expect(formatDecimalTgaPct(0.0825)).toBe('8.25');
    expect(isManualTgaOverride({ enteredTgaPct: 8.3, automaticTgaPct: 8.25 })).toBe(true);
  });

  it('évalue la concordance RNE sans calcul côté UI', () => {
    expect(assessNoiEvidence({ verifiedNoi: 100_000, declaredNoi: 98_000 }).status).toBe('ok');
    expect(assessNoiEvidence({ verifiedNoi: 100_000, declaredNoi: 88_000 }).status).toBe('warn');
    const fail = assessNoiEvidence({ verifiedNoi: 100_000, declaredNoi: 70_000 });
    expect(fail.status).toBe('fail');
    expect(fail.variancePctLabel).toBe('30.0');
  });
});

