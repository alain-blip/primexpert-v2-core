/**
 * Tests unitaires pour le module marketCapRate
 *
 * Valide la séparation:
 * - capRateImpliedAtAsking = NOI / Prix demandé (métrique acheteur)
 * - capRateMarketSelected = TGA de marché retenu (métrique évaluateur)
 *
 * @author Copilote IA - RPAaVendre.com
 */

import { describe, expect, it } from 'vitest';
import {
  selectMarketCapRate,
  computeStats,
  computeCapRateImpliedAtAsking,
  isAggressivePricing,
  mapComparablesToCapRateSamples,
  type ComparableCapRateSample,
  type SelectMarketCapRateParams,
} from '../marketCapRate';

describe('marketCapRate Module', () => {
  // ==========================================================================
  // TEST: computeStats
  // ==========================================================================
  describe('computeStats', () => {
    it('should compute correct stats for simple array', () => {
      const values = [0.072, 0.078, 0.082, 0.075];
      const stats = computeStats(values);

      expect(stats.avg).toBeCloseTo(0.07675, 4);
      expect(stats.min).toBe(0.072);
      expect(stats.max).toBe(0.082);
      // Médiane de [0.072, 0.075, 0.078, 0.082] = (0.075 + 0.078) / 2
      expect(stats.median).toBeCloseTo(0.0765, 4);
    });

    it('should handle empty array', () => {
      const stats = computeStats([]);
      expect(stats.avg).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
    });

    it('should handle single value', () => {
      const stats = computeStats([0.085]);
      expect(stats.avg).toBe(0.085);
      expect(stats.median).toBe(0.085);
      expect(stats.min).toBe(0.085);
      expect(stats.max).toBe(0.085);
    });
  });

  // ==========================================================================
  // TEST: selectMarketCapRate
  // ==========================================================================
  describe('selectMarketCapRate', () => {
    it('should use comparables when >= 3 samples', () => {
      const comparables: ComparableCapRateSample[] = [
        { id: '1', salePrice: 5000000, noi: 360000, capRate: 0.072 },
        { id: '2', salePrice: 4500000, noi: 351000, capRate: 0.078 },
        { id: '3', salePrice: 5200000, noi: 426400, capRate: 0.082 },
        { id: '4', salePrice: 4800000, noi: 360000, capRate: 0.075 },
      ];

      const result = selectMarketCapRate({
        profileCapRate: 0.085, // Fallback - ne devrait pas être utilisé
        comparables,
        riskAdjBps: 0,
      });

      expect(result.source).toBe('COMPARABLES');
      expect(result.sampleCount).toBe(4);
      expect(result.capRateComparableMedian).toBeCloseTo(0.0765, 4);
      expect(result.capRateMarketSelected).toBeCloseTo(0.0765, 4);
      expect(result.capRateComparableMin).toBe(0.072);
      expect(result.capRateComparableMax).toBe(0.082);
    });

    it('should apply risk adjustment within bounds', () => {
      const comparables: ComparableCapRateSample[] = [
        { id: '1', salePrice: 5000000, noi: 360000, capRate: 0.072 },
        { id: '2', salePrice: 4500000, noi: 351000, capRate: 0.078 },
        { id: '3', salePrice: 5200000, noi: 426400, capRate: 0.082 },
      ];

      const result = selectMarketCapRate({
        profileCapRate: 0.085,
        comparables,
        riskAdjBps: 50, // +0.50%
      });

      // Médiane = 0.078, +0.005 = 0.083, clampé à max 0.082
      expect(result.capRateMarketSelected).toBeCloseTo(0.082, 4);
    });

    it('should fallback to profile when < 3 comparables', () => {
      const comparables: ComparableCapRateSample[] = [
        { id: '1', salePrice: 5000000, noi: 360000, capRate: 0.072 },
        { id: '2', salePrice: 4500000, noi: 351000, capRate: 0.078 },
      ];

      const result = selectMarketCapRate({
        profileCapRate: 0.085,
        comparables,
        riskAdjBps: 0,
      });

      expect(result.source).toBe('PROFILE_FALLBACK');
      expect(result.capRateMarketSelected).toBe(0.085);
      expect(result.sampleCount).toBe(2);
    });

    it('should fallback when no comparables', () => {
      const result = selectMarketCapRate({
        profileCapRate: 0.11,
        comparables: [],
        riskAdjBps: 0,
      });

      expect(result.source).toBe('PROFILE_FALLBACK');
      expect(result.capRateMarketSelected).toBe(0.11);
      expect(result.sampleCount).toBe(0);
    });
  });

  // ==========================================================================
  // TEST: computeCapRateImpliedAtAsking
  // ==========================================================================
  describe('computeCapRateImpliedAtAsking', () => {
    it('should compute correct implied cap rate', () => {
      // NOI = 400k, Prix = 6.6M => TGA implicite = 6.06%
      const capRate = computeCapRateImpliedAtAsking(400000, 6600000);
      expect(capRate).toBeCloseTo(0.0606, 4);
    });

    it('should return undefined for invalid inputs', () => {
      expect(computeCapRateImpliedAtAsking(0, 1000000)).toBeUndefined();
      expect(computeCapRateImpliedAtAsking(400000, 0)).toBeUndefined();
      expect(computeCapRateImpliedAtAsking(-100000, 5000000)).toBeUndefined();
    });
  });

  // ==========================================================================
  // TEST: isAggressivePricing
  // ==========================================================================
  describe('isAggressivePricing', () => {
    it('should detect aggressive pricing when implied < min - tolerance', () => {
      // TGA implicite 6% < min comparables 7.2% - 0.5% = 6.7% => AGRESSIF
      expect(isAggressivePricing(0.06, 0.072, 50)).toBe(true);
    });

    it('should not flag when implied is within tolerance', () => {
      // TGA implicite 6.8% > min 7.2% - 0.5% = 6.7% => OK
      expect(isAggressivePricing(0.068, 0.072, 50)).toBe(false);
    });

    it('should not flag when implied >= min', () => {
      expect(isAggressivePricing(0.075, 0.072, 50)).toBe(false);
    });
  });

  // ==========================================================================
  // TEST: mapComparablesToCapRateSamples
  // ==========================================================================
  describe('mapComparablesToCapRateSamples', () => {
    it('should convert raw data to cap rate samples', () => {
      const rawData = [
        { id: '1', salePrice: 5000000, rbe: 1500000, totalExpenses: 1100000 },
        { id: '2', salePrice: 4500000, noi: 351000 },
      ];

      const samples = mapComparablesToCapRateSamples(rawData);

      expect(samples).toHaveLength(2);
      // Sample 1: NOI = RBE - Expenses = 1500000 - 1100000 = 400000
      // Cap rate = 400000 / 5000000 = 0.08
      expect(samples[0].capRate).toBeCloseTo(0.08, 4);
      // Sample 2: NOI = 351000 / 4500000 = 0.078
      expect(samples[1].capRate).toBeCloseTo(0.078, 4);
    });

    it('should filter out invalid samples', () => {
      const rawData = [
        { id: '1', salePrice: 5000000, noi: 400000 },
        { id: '2', salePrice: 0, noi: 100000 }, // Invalid
        { id: '3', salePrice: 3000000, noi: 0 }, // Will produce cap rate 0
      ];

      const samples = mapComparablesToCapRateSamples(rawData);
      expect(samples).toHaveLength(1); // Only first is valid
    });
  });

  // ==========================================================================
  // TEST INTEGRATION: Scénario complet
  // ==========================================================================
  describe('Integration: Complete scenario', () => {
    it('should correctly identify aggressive pricing (TGA implicite 6% vs marché 7.65%)', () => {
      // Scénario de test demandé:
      // - NOI = 400k
      // - Prix demandé = 6.6M => TGA implicite ~6.06%
      // - Comparables cap rates : [7.2%, 7.8%, 8.2%, 7.5%]
      // - Attendu: TGA marché ~7.65% (médiane)
      // - Attendu: warningLowCapRate = true

      const noi = 400000;
      const askingPrice = 6600000;
      const comparables: ComparableCapRateSample[] = [
        { id: '1', salePrice: 5000000, noi: 360000, capRate: 0.072 },
        { id: '2', salePrice: 4500000, noi: 351000, capRate: 0.078 },
        { id: '3', salePrice: 4878049, noi: 400000, capRate: 0.082 },
        { id: '4', salePrice: 5333333, noi: 400000, capRate: 0.075 },
      ];

      // 1. Sélectionner le TGA de marché
      const marketResult = selectMarketCapRate({
        profileCapRate: 0.085, // Fallback
        comparables,
        riskAdjBps: 0,
      });

      expect(marketResult.source).toBe('COMPARABLES');
      expect(marketResult.capRateComparableMedian).toBeCloseTo(0.0765, 3);
      expect(marketResult.capRateMarketSelected).toBeCloseTo(0.0765, 3);

      // 2. Calculer le TGA implicite au prix demandé
      const capRateImplied = computeCapRateImpliedAtAsking(noi, askingPrice);
      expect(capRateImplied).toBeCloseTo(0.0606, 3);

      // 3. Calculer la valeur marchande au TGA de marché
      const valueByIncomeMarket = noi / marketResult.capRateMarketSelected;
      expect(valueByIncomeMarket).toBeCloseTo(5228758, -3); // ~5.23M

      // 4. Vérifier le warning "prix agressif"
      const isAggressive = isAggressivePricing(
        capRateImplied!,
        marketResult.capRateComparableMin!,
        50 // tolérance 0.5%
      );
      expect(isAggressive).toBe(true);

      // 5. Le prix demandé (6.6M) est bien au-dessus de la valeur marché (~5.23M)
      const ecartPrix = askingPrice - valueByIncomeMarket;
      expect(ecartPrix).toBeGreaterThan(1000000); // Écart > 1M$
    });

    it('should not flag fair pricing (TGA implicite 7.5% vs marché 7.65%)', () => {
      const noi = 400000;
      const askingPrice = 5333333; // NOI / 7.5%
      const comparables: ComparableCapRateSample[] = [
        { id: '1', salePrice: 5000000, noi: 360000, capRate: 0.072 },
        { id: '2', salePrice: 4500000, noi: 351000, capRate: 0.078 },
        { id: '3', salePrice: 4878049, noi: 400000, capRate: 0.082 },
        { id: '4', salePrice: 5333333, noi: 400000, capRate: 0.075 },
      ];

      const marketResult = selectMarketCapRate({
        profileCapRate: 0.085,
        comparables,
        riskAdjBps: 0,
      });

      const capRateImplied = computeCapRateImpliedAtAsking(noi, askingPrice);
      expect(capRateImplied).toBeCloseTo(0.075, 3);

      // TGA implicite 7.5% >= min 7.2% - 0.5% => pas de warning
      const isAggressive = isAggressivePricing(
        capRateImplied!,
        marketResult.capRateComparableMin!,
        50
      );
      expect(isAggressive).toBe(false);
    });
  });
});
