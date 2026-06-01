/**
 * Module Comparable Benchmarks
 *
 * Calcule les ratios moyens des comparables pour la colonne
 * "% moyen comparables" dans les rapports d'analyse financière.
 *
 * Ratios calculés:
 * - Ratio de dépenses totales / RBE
 * - Ratio salaires / RBE
 * - Ratio nourriture / RBE
 * - Ratio administration / RBE
 * - Ratio énergie / RBE
 * - Ratio entretien / RBE
 * - TGA moyen et médian
 *
 * @author Copilote IA - RPAaVendre.com
 * @version 1.0.0
 */

import {
  computeCapRateRatioFromRneAndPrice,
  resolveRneFromRevenueAndExpenses,
} from '../financial/capitalization';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Données d'un comparable pour le calcul des benchmarks
 */
export interface ComparableFinancialData {
  /** Identifiant unique */
  id: string;
  /** Prix de vente final */
  salePrice?: number;
  /** Revenu brut potentiel */
  rbp?: number;
  /** Revenu brut effectif */
  rbe?: number;
  /** Revenu net d'exploitation */
  noi?: number;
  /** Total des dépenses */
  totalExpenses?: number;
  /** Dépenses détaillées (optionnel) */
  expenses?: {
    salaires?: number;
    nourriture?: number;
    energie?: number;
    entretien?: number;
    assurances?: number;
    taxes?: number;
    administration?: number;
    autres?: number;
  };
}

/**
 * Résultat des benchmarks calculés
 */
export interface ComparableBenchmarks {
  /** Ratio moyen dépenses totales / RBE */
  expenseRatioAvg?: number;
  /** Ratio moyen salaires / RBE */
  salaryRatioAvg?: number;
  /** Ratio moyen nourriture / RBE */
  foodRatioAvg?: number;
  /** Ratio moyen administration / RBE */
  adminRatioAvg?: number;
  /** Ratio moyen énergie / RBE */
  energyRatioAvg?: number;
  /** Ratio moyen entretien / RBE */
  maintenanceRatioAvg?: number;
  /** Ratio moyen assurances / RBE */
  insuranceRatioAvg?: number;
  /** Ratio moyen taxes / RBE */
  taxesRatioAvg?: number;
  /** Moyenne des TGA des comparables */
  capRateAvg?: number;
  /** Médiane des TGA des comparables */
  capRateMedian?: number;
  /** Nombre de comparables utilisés */
  sampleCount: number;
  /** Source des données */
  source: 'COMPARABLES' | 'PROFILE_DEFAULTS';
}

/**
 * Valeurs par défaut de profil (fallback si pas de comparables)
 */
export interface ProfileBenchmarkDefaults {
  /** Ratio de dépenses typique du profil */
  expenseRatioTypical: number;
  /** TGA cible du profil */
  capRateTarget: number;
}

// ============================================================================
// CONSTANTES - RATIOS TYPIQUES DU MARCHÉ RPA
// ============================================================================

/**
 * Ratios typiques du marché RPA Québec (fallback par défaut)
 *
 * Ces valeurs sont basées sur les moyennes observées sur le marché
 * des RPA au Québec et servent de référence lorsque les comparables
 * ne sont pas disponibles.
 */
export const DEFAULT_MARKET_BENCHMARKS: Readonly<ComparableBenchmarks> = {
  expenseRatioAvg: 0.73,        // 73% du RBE en dépenses
  salaryRatioAvg: 0.52,         // 52% du RBE en salaires
  foodRatioAvg: 0.095,          // 9.5% du RBE en nourriture
  adminRatioAvg: 0.04,          // 4% du RBE en administration
  energyRatioAvg: 0.025,        // 2.5% du RBE en énergie
  maintenanceRatioAvg: 0.025,   // 2.5% du RBE en entretien
  insuranceRatioAvg: 0.008,     // 0.8% du RBE en assurances
  taxesRatioAvg: 0.03,          // 3% du RBE en taxes
  capRateAvg: 0.085,            // TGA moyen 8.5%
  capRateMedian: 0.085,         // TGA médian 8.5%
  sampleCount: 0,
  source: 'PROFILE_DEFAULTS',
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Calcule la moyenne d'un tableau de nombres (ignore les valeurs nulles/undefined)
 */
function computeAverage(values: (number | undefined | null)[]): number | undefined {
  const validValues = values.filter(
    (v): v is number => v !== undefined && v !== null && !isNaN(v) && v > 0
  );

  if (validValues.length === 0) {
    return undefined;
  }

  const sum = validValues.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / validValues.length) * 10000) / 10000;
}

/**
 * Calcule la médiane d'un tableau de nombres
 */
function computeMedian(values: number[]): number | undefined {
  const validValues = values.filter(v => !isNaN(v) && v > 0);

  if (validValues.length === 0) {
    return undefined;
  }

  const sorted = [...validValues].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10000) / 10000;
  }

  return Math.round(sorted[mid] * 10000) / 10000;
}

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Calcule les benchmarks à partir des comparables
 *
 * @param comparables - Liste des données financières des comparables
 * @returns Benchmarks calculés (ou undefined pour les ratios non disponibles)
 *
 * @example
 * ```typescript
 * const benchmarks = computeComparableBenchmarks([
 *   {
 *     id: '1',
 *     salePrice: 5000000,
 *     rbe: 1200000,
 *     noi: 324000,
 *     totalExpenses: 876000,
 *     expenses: { salaires: 624000, nourriture: 114000 }
 *   },
 *   // ... autres comparables
 * ]);
 * ```
 */
export function computeComparableBenchmarks(
  comparables?: ComparableFinancialData[]
): ComparableBenchmarks | undefined {
  // Si pas de comparables, retourner undefined (le caller utilisera le fallback profil)
  if (!comparables || comparables.length === 0) {
    return undefined;
  }

  // Filtrer les comparables valides (RBE > 0)
  const validComparables = comparables.filter(c => {
    const rbe = c.rbe || (c.rbp ? c.rbp * 0.95 : 0);
    return rbe > 0;
  });

  if (validComparables.length === 0) {
    return undefined;
  }

  // Calculer les ratios pour chaque comparable
  const expenseRatios: number[] = [];
  const salaryRatios: number[] = [];
  const foodRatios: number[] = [];
  const adminRatios: number[] = [];
  const energyRatios: number[] = [];
  const maintenanceRatios: number[] = [];
  const insuranceRatios: number[] = [];
  const taxesRatios: number[] = [];
  const capRates: number[] = [];

  for (const c of validComparables) {
    const rbe = c.rbe || (c.rbp ? c.rbp * 0.95 : 0);
    if (rbe <= 0) continue;

    // Ratio de dépenses totales
    if (c.totalExpenses && c.totalExpenses > 0) {
      expenseRatios.push(c.totalExpenses / rbe);
    }

    // Cap Rate
    if (c.salePrice && c.salePrice > 0) {
      const noi = resolveRneFromRevenueAndExpenses({
        netOperatingIncome: c.noi,
        revenuBrutEffectif: rbe,
        depensesExploitation: c.totalExpenses,
      });
      const capRate = computeCapRateRatioFromRneAndPrice({
        rne: noi,
        price: c.salePrice,
        decimals: 4,
      });
      if (capRate != null) {
        capRates.push(capRate);
      }
    }

    // Ratios détaillés (si disponibles)
    if (c.expenses) {
      if (c.expenses.salaires && c.expenses.salaires > 0) {
        salaryRatios.push(c.expenses.salaires / rbe);
      }
      if (c.expenses.nourriture && c.expenses.nourriture > 0) {
        foodRatios.push(c.expenses.nourriture / rbe);
      }
      if (c.expenses.administration && c.expenses.administration > 0) {
        adminRatios.push(c.expenses.administration / rbe);
      }
      if (c.expenses.energie && c.expenses.energie > 0) {
        energyRatios.push(c.expenses.energie / rbe);
      }
      if (c.expenses.entretien && c.expenses.entretien > 0) {
        maintenanceRatios.push(c.expenses.entretien / rbe);
      }
      if (c.expenses.assurances && c.expenses.assurances > 0) {
        insuranceRatios.push(c.expenses.assurances / rbe);
      }
      if (c.expenses.taxes && c.expenses.taxes > 0) {
        taxesRatios.push(c.expenses.taxes / rbe);
      }
    }
  }

  return {
    expenseRatioAvg: computeAverage(expenseRatios),
    salaryRatioAvg: computeAverage(salaryRatios),
    foodRatioAvg: computeAverage(foodRatios),
    adminRatioAvg: computeAverage(adminRatios),
    energyRatioAvg: computeAverage(energyRatios),
    maintenanceRatioAvg: computeAverage(maintenanceRatios),
    insuranceRatioAvg: computeAverage(insuranceRatios),
    taxesRatioAvg: computeAverage(taxesRatios),
    capRateAvg: computeAverage(capRates),
    capRateMedian: computeMedian(capRates),
    sampleCount: validComparables.length,
    source: 'COMPARABLES',
  };
}

/**
 * Fusionne les benchmarks des comparables avec les valeurs par défaut du profil
 *
 * Pour chaque ratio:
 * - Si disponible dans les comparables: utiliser la valeur des comparables
 * - Sinon: utiliser la valeur du profil ou la valeur par défaut du marché
 *
 * @param comparableBenchmarks - Benchmarks calculés des comparables (peut être undefined)
 * @param profileDefaults - Valeurs par défaut du profil (optionnel)
 * @returns Benchmarks complets avec fallback
 */
export function mergeWithProfileDefaults(
  comparableBenchmarks: ComparableBenchmarks | undefined,
  profileDefaults?: ProfileBenchmarkDefaults
): ComparableBenchmarks {
  // Valeurs par défaut du profil ou du marché
  const expenseRatioFallback = profileDefaults?.expenseRatioTypical
    ?? DEFAULT_MARKET_BENCHMARKS.expenseRatioAvg;
  const capRateFallback = profileDefaults?.capRateTarget
    ?? DEFAULT_MARKET_BENCHMARKS.capRateAvg;

  // Si pas de benchmarks comparables, utiliser entièrement les defaults
  if (!comparableBenchmarks) {
    return {
      ...DEFAULT_MARKET_BENCHMARKS,
      expenseRatioAvg: expenseRatioFallback,
      capRateAvg: capRateFallback,
      capRateMedian: capRateFallback,
      sampleCount: 0,
      source: 'PROFILE_DEFAULTS',
    };
  }

  // Fusionner: comparables > profil > défaut marché
  return {
    expenseRatioAvg: comparableBenchmarks.expenseRatioAvg ?? expenseRatioFallback,
    salaryRatioAvg: comparableBenchmarks.salaryRatioAvg ?? DEFAULT_MARKET_BENCHMARKS.salaryRatioAvg,
    foodRatioAvg: comparableBenchmarks.foodRatioAvg ?? DEFAULT_MARKET_BENCHMARKS.foodRatioAvg,
    adminRatioAvg: comparableBenchmarks.adminRatioAvg ?? DEFAULT_MARKET_BENCHMARKS.adminRatioAvg,
    energyRatioAvg: comparableBenchmarks.energyRatioAvg ?? DEFAULT_MARKET_BENCHMARKS.energyRatioAvg,
    maintenanceRatioAvg: comparableBenchmarks.maintenanceRatioAvg ?? DEFAULT_MARKET_BENCHMARKS.maintenanceRatioAvg,
    insuranceRatioAvg: comparableBenchmarks.insuranceRatioAvg ?? DEFAULT_MARKET_BENCHMARKS.insuranceRatioAvg,
    taxesRatioAvg: comparableBenchmarks.taxesRatioAvg ?? DEFAULT_MARKET_BENCHMARKS.taxesRatioAvg,
    capRateAvg: comparableBenchmarks.capRateAvg ?? capRateFallback,
    capRateMedian: comparableBenchmarks.capRateMedian ?? capRateFallback,
    sampleCount: comparableBenchmarks.sampleCount,
    source: comparableBenchmarks.source,
  };
}

/**
 * Compare un ratio de la résidence avec le benchmark et retourne l'écart
 *
 * @param residenceRatio - Ratio de la résidence analysée
 * @param benchmarkRatio - Ratio benchmark (comparables ou profil)
 * @returns Écart en points de pourcentage et statut
 */
export function compareRatioToBenchmark(
  residenceRatio: number | undefined,
  benchmarkRatio: number | undefined
): {
  ecart: number | undefined;
  ecartPct: number | undefined;
  status: 'favorable' | 'defavorable' | 'neutre' | 'indisponible';
} {
  if (residenceRatio === undefined || benchmarkRatio === undefined || benchmarkRatio === 0) {
    return { ecart: undefined, ecartPct: undefined, status: 'indisponible' };
  }

  const ecart = residenceRatio - benchmarkRatio;
  const ecartPct = Math.round((ecart / benchmarkRatio) * 10000) / 100; // En %

  // Pour les ratios de dépenses: plus bas = favorable
  // Seuil de ±5% pour considérer neutre
  let status: 'favorable' | 'defavorable' | 'neutre';
  if (Math.abs(ecartPct) <= 5) {
    status = 'neutre';
  } else if (ecart < 0) {
    status = 'favorable'; // Dépenses plus basses
  } else {
    status = 'defavorable'; // Dépenses plus élevées
  }

  return {
    ecart: Math.round(ecart * 10000) / 10000,
    ecartPct,
    status,
  };
}

/**
 * Compare le TGA avec le benchmark (logique inversée: plus haut = favorable)
 *
 * @param residenceCapRate - TGA de la résidence
 * @param benchmarkCapRate - TGA benchmark
 * @returns Écart et statut
 */
export function compareCapRateToBenchmark(
  residenceCapRate: number | undefined,
  benchmarkCapRate: number | undefined
): {
  ecart: number | undefined;
  ecartPct: number | undefined;
  status: 'favorable' | 'defavorable' | 'neutre' | 'indisponible';
} {
  if (residenceCapRate === undefined || benchmarkCapRate === undefined || benchmarkCapRate === 0) {
    return { ecart: undefined, ecartPct: undefined, status: 'indisponible' };
  }

  const ecart = residenceCapRate - benchmarkCapRate;
  const ecartPct = Math.round((ecart / benchmarkCapRate) * 10000) / 100;

  // Pour le TGA: plus haut = favorable (meilleur rendement)
  let status: 'favorable' | 'defavorable' | 'neutre';
  if (Math.abs(ecartPct) <= 5) {
    status = 'neutre';
  } else if (ecart > 0) {
    status = 'favorable'; // TGA plus élevé = bon rendement
  } else {
    status = 'defavorable'; // TGA plus bas = prix élevé
  }

  return {
    ecart: Math.round(ecart * 10000) / 10000,
    ecartPct,
    status,
  };
}

export default computeComparableBenchmarks;
