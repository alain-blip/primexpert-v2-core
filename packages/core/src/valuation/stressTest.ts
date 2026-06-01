/**
 * Scénarios de sensibilité à l'occupation (85 % / 90 % / 100 %).
 * Mode RBP (ACM) : RNE scénario = RBP × occ − dépenses, valeur = RNE / TGA unique.
 */

import { computeCapitalizedValueFromNoi } from '../financial/capitalizationMetrics';
import { projectNOIAtOccupancy, projectNoiFromRbpAtOccupancy } from './projectNoiAtOccupancy';
import type { RangeWithMedian, StressTestResult, StressTests } from './valuationStressTypes';

const STRESS_OCCUPANCY_LEVELS = {
  CONSERVATIVE: 0.85,
  BASE: 0.9,
  OPTIMISTIC: 1.0,
} as const;

function buildStressTestResult(
  baseNoi: number,
  currentOccupancy: number,
  targetOccupancy: number,
  capRateRange: RangeWithMedian
): StressTestResult {
  const projectedNoi = projectNOIAtOccupancy(baseNoi, currentOccupancy, targetOccupancy);
  const minCap = Math.max(capRateRange.min, 0.0001);
  const maxCap = Math.max(capRateRange.max, minCap);

  return {
    occupancyRate: targetOccupancy,
    noi: projectedNoi,
    valueRange: {
      min: Math.round(computeCapitalizedValueFromNoi(projectedNoi, maxCap) ?? 0),
      max: Math.round(computeCapitalizedValueFromNoi(projectedNoi, minCap) ?? 0),
    },
  };
}

function buildStressTestFromRbp(
  rbp: number,
  operatingExpenses: number,
  targetOccupancy: number,
  capRate: number
): StressTestResult {
  const projectedNoi = projectNoiFromRbpAtOccupancy(rbp, operatingExpenses, targetOccupancy);
  const cap = Math.max(capRate, 0.0001);
  const value = Math.round(computeCapitalizedValueFromNoi(projectedNoi, cap) ?? 0);

  return {
    occupancyRate: targetOccupancy,
    noi: projectedNoi,
    valueRange: { min: value, max: value },
  };
}

export interface RunStressTestsRbpContext {
  rbp: number;
  operatingExpenses: number;
}

export function runStressTests(
  baseNoi: number,
  currentOccupancy: number,
  capRateOrRange: RangeWithMedian | number,
  rbpContext?: RunStressTestsRbpContext
): StressTests {
  const occ = currentOccupancy > 0 ? currentOccupancy : 0.95;

  if (rbpContext && typeof capRateOrRange === 'number') {
    const cap = capRateOrRange;
    const { rbp, operatingExpenses } = rbpContext;
    return {
      occ85: buildStressTestFromRbp(
        rbp,
        operatingExpenses,
        STRESS_OCCUPANCY_LEVELS.CONSERVATIVE,
        cap
      ),
      occ90: buildStressTestFromRbp(rbp, operatingExpenses, STRESS_OCCUPANCY_LEVELS.BASE, cap),
      occ100: buildStressTestFromRbp(
        rbp,
        operatingExpenses,
        STRESS_OCCUPANCY_LEVELS.OPTIMISTIC,
        cap
      ),
    };
  }

  const capRateRange = capRateOrRange as RangeWithMedian;
  return {
    occ85: buildStressTestResult(baseNoi, occ, STRESS_OCCUPANCY_LEVELS.CONSERVATIVE, capRateRange),
    occ90: buildStressTestResult(baseNoi, occ, STRESS_OCCUPANCY_LEVELS.BASE, capRateRange),
    occ100: buildStressTestResult(baseNoi, occ, STRESS_OCCUPANCY_LEVELS.OPTIMISTIC, capRateRange),
  };
}

export function selectBaselineStressTest(
  currentOccupancy: number,
  stressTests: StressTests
): StressTestResult {
  if (currentOccupancy < 0.85) return stressTests.occ85;
  if (currentOccupancy < 0.9) return stressTests.occ90;
  return stressTests.occ100;
}

export function calculateMedianValue(stressTest: StressTestResult): number {
  return Math.round((stressTest.valueRange.min + stressTest.valueRange.max) / 2);
}

export function requiresConservativeBaseline(currentOccupancy: number): boolean {
  return currentOccupancy < 0.9;
}

/** Fourchette TGA à partir d'un TGA médian (±50 bps). */
export function capRateRangeFromMedian(medianCapRate: number): RangeWithMedian {
  const m = Math.max(medianCapRate, 0.04);
  const delta = 0.005;
  return {
    min: Math.max(m - delta, 0.03),
    max: m + delta,
    median: m,
  };
}
