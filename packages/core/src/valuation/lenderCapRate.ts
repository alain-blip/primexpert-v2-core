/**
 * Module de calcul du TGA Prêteur Ajusté
 *
 * Logique bancaire réaliste pour le calcul de la valeur finançable.
 *
 * FORMULE:
 * TGA prêteur ajusté = TGA base (par taille) + Ajustement rentabilité + Ajustement risque
 *
 * La banque valorise le RISQUE, pas le POTENTIEL.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface LenderCapRateInput {
  /** Nombre d'unités de la RPA */
  units: number;
  /** NOI par unité de cette RPA */
  noiPerUnit: number;
  /** NOI par unité moyen du segment (comparables) */
  segmentNoiPerUnit?: number;
  /** Taux d'occupation actuel (0-1) */
  occupancyRate?: number;
  /** Années d'historique financier stable */
  yearsStableHistory?: number;
  /** RPA en redressement ou situation difficile */
  isDistressed?: boolean;
  /** Ratio de dépenses de la RPA */
  expenseRatio?: number;
  /** Ratio de dépenses moyen du segment */
  segmentExpenseRatio?: number;
}

export interface LenderCapRateResult {
  /** TGA prêteur ajusté final */
  adjustedCapRate: number;
  /** TGA de base selon la taille */
  baseCapRate: number;
  /** Ajustement pour performance relative */
  performanceAdjustment: number;
  /** Ajustement pour risque opérationnel */
  riskAdjustment: number;
  /** Catégorie de taille */
  sizeCategory: string;
  /** Performance relative vs segment (%) */
  performanceVsSegment: number | null;
  /** Explication textuelle */
  explanation: string;
}

// ============================================================================
// CONSTANTES - GRILLE TGA BANCAIRE
// ============================================================================

/**
 * TGA de base par taille de RPA
 * Source: Pratiques bancaires courantes au Québec 2024-2025
 */
export const BASE_LENDER_CAP_RATES = {
  MOINS_40: { rate: 0.0875, label: '< 40 unités', category: 'petite' },
  DE_40_A_79: { rate: 0.08, label: '40-79 unités', category: 'moyenne' },
  DE_80_A_120: { rate: 0.075, label: '80-120 unités', category: 'grande' },
  PLUS_120: { rate: 0.07, label: '120+ unités', category: 'tres_grande' },
} as const;

/**
 * Ajustements selon la performance relative vs comparables
 *
 * Performance = (NOI/unité de la RPA) vs (NOI/unité moyen du segment)
 */
export const PERFORMANCE_ADJUSTMENTS = {
  EXCELLENT: { threshold: 0.10, adjustment: -0.0025, label: '≥ +10% au-dessus' },
  BON: { threshold: 0.05, adjustment: 0, label: '± 5% de la moyenne' },
  SOUS_MOYENNE_LEGER: { threshold: -0.05, adjustment: 0, label: '± 5% de la moyenne' },
  SOUS_MOYENNE_MODERE: { threshold: -0.10, adjustment: 0.0025, label: '-5% à -10%' },
  SOUS_MOYENNE_SIGNIFICATIF: { threshold: -0.20, adjustment: 0.005, label: '-10% à -20%' },
  SOUS_MOYENNE_SEVERE: { threshold: -Infinity, adjustment: 0.0075, label: '< -20%' },
} as const;

/**
 * Ajustements pour risque opérationnel additionnel
 */
export const RISK_ADJUSTMENTS = {
  DISTRESSED: 0.01,           // +1% si RPA en redressement
  LOW_OCCUPANCY: 0.005,       // +0.5% si occupation < 85%
  HIGH_EXPENSE_RATIO: 0.0025, // +0.25% si ratio dépenses > segment +10%
  NO_HISTORY: 0.0025,         // +0.25% si < 2 ans d'historique stable
} as const;

// ============================================================================
// FONCTIONS
// ============================================================================

/**
 * Détermine le TGA de base selon le nombre d'unités
 */
export function getBaseCapRateBySize(units: number): {
  rate: number;
  label: string;
  category: string;
} {
  if (units >= 120) {
    return BASE_LENDER_CAP_RATES.PLUS_120;
  } else if (units >= 80) {
    return BASE_LENDER_CAP_RATES.DE_80_A_120;
  } else if (units >= 40) {
    return BASE_LENDER_CAP_RATES.DE_40_A_79;
  } else {
    return BASE_LENDER_CAP_RATES.MOINS_40;
  }
}

/**
 * Calcule l'ajustement de performance basé sur le NOI/unité relatif
 */
export function calculatePerformanceAdjustment(
  noiPerUnit: number,
  segmentNoiPerUnit: number
): { adjustment: number; performanceRatio: number; label: string } {
  if (!segmentNoiPerUnit || segmentNoiPerUnit <= 0) {
    return { adjustment: 0, performanceRatio: 0, label: 'Données segment non disponibles' };
  }

  const performanceRatio = (noiPerUnit - segmentNoiPerUnit) / segmentNoiPerUnit;

  if (performanceRatio >= PERFORMANCE_ADJUSTMENTS.EXCELLENT.threshold) {
    return {
      adjustment: PERFORMANCE_ADJUSTMENTS.EXCELLENT.adjustment,
      performanceRatio,
      label: PERFORMANCE_ADJUSTMENTS.EXCELLENT.label,
    };
  } else if (performanceRatio >= PERFORMANCE_ADJUSTMENTS.BON.threshold) {
    return {
      adjustment: PERFORMANCE_ADJUSTMENTS.BON.adjustment,
      performanceRatio,
      label: PERFORMANCE_ADJUSTMENTS.BON.label,
    };
  } else if (performanceRatio >= PERFORMANCE_ADJUSTMENTS.SOUS_MOYENNE_MODERE.threshold) {
    return {
      adjustment: PERFORMANCE_ADJUSTMENTS.SOUS_MOYENNE_MODERE.adjustment,
      performanceRatio,
      label: PERFORMANCE_ADJUSTMENTS.SOUS_MOYENNE_MODERE.label,
    };
  } else if (performanceRatio >= PERFORMANCE_ADJUSTMENTS.SOUS_MOYENNE_SIGNIFICATIF.threshold) {
    return {
      adjustment: PERFORMANCE_ADJUSTMENTS.SOUS_MOYENNE_SIGNIFICATIF.adjustment,
      performanceRatio,
      label: PERFORMANCE_ADJUSTMENTS.SOUS_MOYENNE_SIGNIFICATIF.label,
    };
  } else {
    return {
      adjustment: PERFORMANCE_ADJUSTMENTS.SOUS_MOYENNE_SEVERE.adjustment,
      performanceRatio,
      label: PERFORMANCE_ADJUSTMENTS.SOUS_MOYENNE_SEVERE.label,
    };
  }
}

/**
 * Calcule l'ajustement de risque opérationnel
 */
export function calculateRiskAdjustment(input: LenderCapRateInput): {
  adjustment: number;
  factors: string[];
} {
  let adjustment = 0;
  const factors: string[] = [];

  // RPA en redressement
  if (input.isDistressed) {
    adjustment += RISK_ADJUSTMENTS.DISTRESSED;
    factors.push('RPA en redressement (+1%)');
  }

  // Faible occupation
  if (input.occupancyRate !== undefined && input.occupancyRate < 0.85) {
    adjustment += RISK_ADJUSTMENTS.LOW_OCCUPANCY;
    factors.push('Occupation < 85% (+0.5%)');
  }

  // Ratio de dépenses élevé
  if (
    input.expenseRatio !== undefined &&
    input.segmentExpenseRatio !== undefined &&
    input.expenseRatio > input.segmentExpenseRatio * 1.10
  ) {
    adjustment += RISK_ADJUSTMENTS.HIGH_EXPENSE_RATIO;
    factors.push('Ratio dépenses > +10% segment (+0.25%)');
  }

  // Historique court
  if (input.yearsStableHistory !== undefined && input.yearsStableHistory < 2) {
    adjustment += RISK_ADJUSTMENTS.NO_HISTORY;
    factors.push('Historique < 2 ans (+0.25%)');
  }

  return { adjustment, factors };
}

/**
 * Calcule le TGA prêteur ajusté complet
 *
 * FORMULE:
 * TGA prêteur ajusté = TGA base + Ajustement performance + Ajustement risque
 *
 * @param input - Paramètres de la RPA
 * @returns Résultat complet avec TGA ajusté et explications
 */
export function calculateAdjustedLenderCapRate(
  input: LenderCapRateInput
): LenderCapRateResult {
  // 1. TGA de base selon la taille
  const baseInfo = getBaseCapRateBySize(input.units);

  // 2. Ajustement performance (si données comparables disponibles)
  let performanceAdjustment = 0;
  let performanceVsSegment: number | null = null;
  let performanceLabel = '';

  if (input.segmentNoiPerUnit && input.segmentNoiPerUnit > 0) {
    const perfResult = calculatePerformanceAdjustment(
      input.noiPerUnit,
      input.segmentNoiPerUnit
    );
    performanceAdjustment = perfResult.adjustment;
    performanceVsSegment = perfResult.performanceRatio * 100; // En pourcentage
    performanceLabel = perfResult.label;
  }

  // 3. Ajustement risque opérationnel
  const riskResult = calculateRiskAdjustment(input);

  // 4. TGA final
  const adjustedCapRate = baseInfo.rate + performanceAdjustment + riskResult.adjustment;

  // 5. Générer l'explication
  const explanationParts: string[] = [
    `TGA base (${baseInfo.label}): ${(baseInfo.rate * 100).toFixed(2)}%`,
  ];

  if (performanceAdjustment !== 0) {
    const sign = performanceAdjustment > 0 ? '+' : '';
    explanationParts.push(
      `Performance ${performanceLabel}: ${sign}${(performanceAdjustment * 100).toFixed(2)}%`
    );
  } else if (performanceVsSegment !== null) {
    explanationParts.push(`Performance ${performanceLabel}: aucun ajustement`);
  }

  if (riskResult.factors.length > 0) {
    explanationParts.push(`Risques: ${riskResult.factors.join(', ')}`);
  }

  explanationParts.push(`TGA prêteur ajusté: ${(adjustedCapRate * 100).toFixed(2)}%`);

  return {
    adjustedCapRate,
    baseCapRate: baseInfo.rate,
    performanceAdjustment,
    riskAdjustment: riskResult.adjustment,
    sizeCategory: baseInfo.category,
    performanceVsSegment,
    explanation: explanationParts.join(' | '),
  };
}

/**
 * Calcule la valeur banquable avec le TGA prêteur ajusté
 *
 * @param noi - Revenu net d'exploitation
 * @param input - Paramètres pour le calcul du TGA ajusté
 * @returns Valeur banquable et détails
 */
export function calculateBankValueWithAdjustedCapRate(
  noi: number,
  input: LenderCapRateInput
): {
  bankValue: number;
  capRateResult: LenderCapRateResult;
} {
  const capRateResult = calculateAdjustedLenderCapRate(input);
  const bankValue = noi / capRateResult.adjustedCapRate;

  return {
    bankValue,
    capRateResult,
  };
}

/**
 * Compare la valeur vendeur vs valeur bancaire
 *
 * @param sellerValue - Valeur selon le vendeur (TGA investisseur)
 * @param noi - Revenu net d'exploitation
 * @param input - Paramètres pour le calcul du TGA ajusté
 * @returns Comparaison détaillée
 */
export function compareSellerVsBankValue(
  sellerValue: number,
  noi: number,
  input: LenderCapRateInput
): {
  sellerValue: number;
  bankValue: number;
  gap: number;
  gapPercent: number;
  sellerCapRate: number;
  bankCapRate: number;
  isFinanceable: boolean;
  explanation: string;
} {
  const { bankValue, capRateResult } = calculateBankValueWithAdjustedCapRate(noi, input);
  const sellerCapRate = noi / sellerValue;
  const gap = sellerValue - bankValue;
  const gapPercent = (gap / bankValue) * 100;

  // Finançable si écart < 5% ou valeur vendeur <= valeur banque
  const isFinanceable = gapPercent <= 5;

  let explanation = '';
  if (isFinanceable) {
    explanation = 'Prix dans la fourchette finançable';
  } else if (gapPercent <= 15) {
    explanation = `Écart de ${gapPercent.toFixed(1)}% - Négociation ou balance vendeur requise`;
  } else {
    explanation = `Écart significatif de ${gapPercent.toFixed(1)}% - Financement difficile`;
  }

  return {
    sellerValue,
    bankValue,
    gap,
    gapPercent,
    sellerCapRate,
    bankCapRate: capRateResult.adjustedCapRate,
    isFinanceable,
    explanation,
  };
}
