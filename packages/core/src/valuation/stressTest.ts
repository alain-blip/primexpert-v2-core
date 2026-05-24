/**
 * Scénarios de sensibilité à l'occupation (85 % / 90 % / 100 %).
 * Si occupation < 85 %, la base conservatrice est occ85 — pas le RNE optimiste.
 */

import { projectNOIAtOccupancy } from './projectNoiAtOccupancy';
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
      min: Math.round(projectedNoi / maxCap),
      max: Math.round(projectedNoi / minCap),
    },
  };
}

export function runStressTests(
  baseNoi: number,
  currentOccupancy: number,
  capRateRange: RangeWithMedian
): StressTests {
  const occ = currentOccupancy > 0 ? currentOccupancy : 0.95;
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
