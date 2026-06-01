import { describe, expect, it } from 'vitest';
import {
  calculateComparableCapRate,
  filterTerritorialComparables,
  mapMarketAnalyticsRawToComparable,
  medianComparableCapRate,
  mergeCentrisTerritorialComparables,
  sortComparablesByRecencyDesc,
  type CentrisComparableListingWithSource,
} from '../centrisComparableCapRate';

describe('centrisComparableCapRate', () => {
  it('calcule le TGA réel à partir du RNE et du prix de vente', () => {
    const rate = calculateComparableCapRate({
      mlsNumber: '123',
      soldPrice: 10_000_000,
      revenuBrutEffectif: 1_200_000,
      densesExploitation: 400_000,
      netOperatingIncome: 800_000,
      closedAtMillis: Date.UTC(2024, 5, 1),
      regionAdministrative: 'Montréal',
      classeImmeuble: 'Classe 2',
    });
    expect(rate).toBe(8);
  });

  it('dérive le RNE si absent', () => {
    const rate = calculateComparableCapRate({
      mlsNumber: '456',
      soldPrice: 5_000_000,
      revenuBrutEffectif: 900_000,
      densesExploitation: 650_000,
      netOperatingIncome: 0,
      closedAtMillis: 0,
      regionAdministrative: 'Montréal',
      classeImmeuble: 'Classe 1',
    });
    expect(rate).toBe(5);
  });

  it('retourne 0 si prix de vente invalide', () => {
    expect(
      calculateComparableCapRate({
        mlsNumber: 'x',
        soldPrice: 0,
        revenuBrutEffectif: 100,
        densesExploitation: 10,
        netOperatingIncome: 90,
        closedAtMillis: 0,
        regionAdministrative: 'Montréal',
        classeImmeuble: 'Classe 1',
      })
    ).toBe(0);
  });

  it('mappe market_analytics_raw et calcule la médiane territoriale', () => {
    const row = mapMarketAnalyticsRawToComparable('doc1', {
      regionAdministrative: 'Montréal',
      anneeDonnees: 2024,
      comparableSnapshot: {
        salePrice: 8_000_000,
        capRatePct: 7.5,
        assetClassLabel: 'Classe 2',
      },
      marketTransactionMeta: {
        mlsNumber: 'MLS-1',
        dateTransaction: '2024-06-15',
      },
    });
    expect(row?.calculatedCapRate).toBe(7.5);
    expect(row?.source).toBe('market_analytics_raw');

    const cacheRow: CentrisComparableListingWithSource = {
      mlsNumber: 'MLS-2',
      soldPrice: 6_000_000,
      revenuBrutEffectif: 700_000,
      densesExploitation: 250_000,
      netOperatingIncome: 450_000,
      calculatedCapRate: 7.5,
      closedAtMillis: Date.UTC(2025, 0, 1),
      regionAdministrative: 'Montréal',
      classeImmeuble: 'Classe 2',
      source: 'listings_cache',
      docId: 'cache1',
    };

    const merged = mergeCentrisTerritorialComparables(
      [cacheRow],
      row ? [row] : [],
      { regionAdministrative: 'Montréal', classeImmeuble: 'Classe 2' }
    );
    expect(merged.sampleCount).toBe(2);
    expect(merged.medianTgaPct).toBe(7.5);
  });

  it('filtre par région et classe avec repli régional', () => {
    const rows: CentrisComparableListingWithSource[] = [
      {
        mlsNumber: 'A',
        soldPrice: 1,
        revenuBrutEffectif: 0.08,
        densesExploitation: 0,
        netOperatingIncome: 0.08,
        calculatedCapRate: 8,
        closedAtMillis: 1,
        regionAdministrative: 'Montréal',
        classeImmeuble: 'Classe 1',
        source: 'listings_cache',
        docId: 'a',
      },
      {
        mlsNumber: 'B',
        soldPrice: 1,
        revenuBrutEffectif: 0.07,
        densesExploitation: 0,
        netOperatingIncome: 0.07,
        calculatedCapRate: 7,
        closedAtMillis: 2,
        regionAdministrative: 'Montréal',
        classeImmeuble: 'Classe 2',
        source: 'listings_cache',
        docId: 'b',
      },
      {
        mlsNumber: 'C',
        soldPrice: 1,
        revenuBrutEffectif: 0.09,
        densesExploitation: 0,
        netOperatingIncome: 0.09,
        calculatedCapRate: 9,
        closedAtMillis: 3,
        regionAdministrative: 'Montréal',
        classeImmeuble: 'Classe 2',
        source: 'listings_cache',
        docId: 'c',
      },
    ];

    const filtered = filterTerritorialComparables(rows, {
      regionAdministrative: 'Montréal',
      classeImmeuble: 'Classe 2',
    });
    expect(filtered.map((r) => r.mlsNumber)).toEqual(['B', 'C']);
    expect(medianComparableCapRate(filtered)).toBe(8);
    expect(sortComparablesByRecencyDesc(filtered)[0]?.mlsNumber).toBe('C');
  });
});
