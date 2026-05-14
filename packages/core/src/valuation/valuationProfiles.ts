/**
 * Profils de valorisation pour différents types de RPA
 *
 * Ces profils définissent les paramètres de marché réalistes utilisés
 * pour calculer les valorisations selon le type et la taille de la résidence.
 */

export type ValuationProfileId =
  | 'RPA_URBAINE_80PLUS'
  | 'RPA_REGION_40_80'
  | 'RPA_PETITE_MOINS_40'
  | 'RPA_REDRESSEMENT';

export interface ValuationProfile {
  id: ValuationProfileId;
  label: string;
  description: string;
  /** Taux de capitalisation cible pour l'investisseur */
  capRateTarget: number;
  /** Taux de capitalisation utilisé par les prêteurs (plus conservateur) */
  capRateLender: number;
  /** Multiplicateur du revenu brut cible */
  mrbTarget: number;
  /** Multiplicateur du revenu net cible */
  mrnTarget: number;
  /** Ratio de dépenses typique pour ce profil */
  expenseRatioTypical: number;
  /** DSCR minimum requis par les prêteurs */
  dscrMin: number;
  /** LTV maximum accordé par les prêteurs */
  ltvMax: number;
  /** Pondération des méthodes de valorisation */
  weights: {
    income: number;  // Méthode du revenu (capitalisation)
    mrb: number;     // Méthode de comparaison (MRB)
  };
  /** Critères de suggestion automatique */
  autoSuggestCriteria: {
    minUnits?: number;
    maxUnits?: number;
    locations?: string[];  // Régions ou villes
  };
}

/**
 * PARAMÈTRES BANCAIRES DE RÉFÉRENCE - NOYAU DUR RPA 2024-2025
 *
 * NOTE IMPORTANTE sur le TGA prêteur:
 * Le TGA bancaire est presque toujours PLUS ÉLEVÉ que le TGA investisseur.
 * La banque valorise le RISQUE, pas le POTENTIEL.
 *
 * GRILLE TGA PRÊTEUR DE BASE (par taille):
 * - < 40 unités:    8.75%
 * - 40-79 unités:   8.00%
 * - 80-120 unités:  7.50%
 * - 120+ unités:    7.00%
 *
 * AJUSTEMENTS SELON PERFORMANCE VS SEGMENT:
 * - ≥ +10% au-dessus:  -0.25%
 * - ± 5% moyenne:       0.00%
 * - -5% à -10%:        +0.25%
 * - -10% à -20%:       +0.50%
 * - < -20%:            +0.75% à +1.00%
 *
 * Voir lenderCapRate.ts pour le calcul dynamique complet.
 */
export const BANK_REFERENCE_PARAMS = {
  dscrMin: 1.50,           // DSCR minimum exigé par les banques
  ltvMax: 0.65,            // LTV maximum (65%)
  amortYearsMax: 20,       // Amortissement maximum (20 ans)
  // TGA prêteur de base par taille (avant ajustements)
  capRateLenderBase: {
    moins40: 0.0875,       // < 40 unités: 8.75%
    de40a79: 0.08,         // 40-79 unités: 8.00%
    de80a120: 0.075,       // 80-120 unités: 7.50%
    plus120: 0.07,         // 120+ unités: 7.00%
  },
};

/**
 * Profils de valorisation prédéfinis
 *
 * LOGIQUE TGA:
 * - TGA investisseur (capRateTarget): Rendement recherché par l'acheteur
 * - TGA prêteur (capRateLender): TGA de BASE utilisé par la banque (avant ajustements)
 *
 * IMPORTANT: Le TGA prêteur réel est calculé dynamiquement via lenderCapRate.ts
 * en fonction de la performance de la RPA vs son segment.
 *
 * La banque utilise un TGA plus élevé = valorise moins = prête moins
 */
export const VALUATION_PROFILES: Record<ValuationProfileId, ValuationProfile> = {
  /**
   * Grande RPA (80+ unités) - Actif stabilisé
   * TGA prêteur de base: 7.50% (80-120 unités)
   */
  RPA_URBAINE_80PLUS: {
    id: 'RPA_URBAINE_80PLUS',
    label: 'Grande RPA (80+ unités)',
    description: 'Grande résidence - TGA 7%',
    capRateTarget: 0.07,       // 7% - TGA investisseur (actif stable)
    capRateLender: BANK_REFERENCE_PARAMS.capRateLenderBase.de80a120, // 7.5% - Base bancaire
    mrbTarget: 3.0,            // MRB
    mrnTarget: 14.0,           // MRN
    expenseRatioTypical: 0.68, // 68% - Économies d'échelle
    dscrMin: BANK_REFERENCE_PARAMS.dscrMin,   // 1.50
    ltvMax: BANK_REFERENCE_PARAMS.ltvMax,     // 65%
    weights: {
      income: 0.60,
      mrb: 0.40,
    },
    autoSuggestCriteria: {
      minUnits: 80,
    },
  },

  /**
   * RPA moyenne (40-80 unités) - RPA standard
   * TGA prêteur de base: 8.00%
   */
  RPA_REGION_40_80: {
    id: 'RPA_REGION_40_80',
    label: 'RPA Moyenne (40-80 unités)',
    description: 'Résidence standard - TGA 8%',
    capRateTarget: 0.08,       // 8% - TGA investisseur
    capRateLender: BANK_REFERENCE_PARAMS.capRateLenderBase.de40a79, // 8% - Base bancaire
    mrbTarget: 2.75,           // MRB
    mrnTarget: 12.5,           // MRN
    expenseRatioTypical: 0.76, // 76%
    dscrMin: BANK_REFERENCE_PARAMS.dscrMin,   // 1.50
    ltvMax: BANK_REFERENCE_PARAMS.ltvMax,     // 65%
    weights: {
      income: 0.60,
      mrb: 0.40,
    },
    autoSuggestCriteria: {
      minUnits: 40,
      maxUnits: 79,
    },
  },

  /**
   * Petite RPA (moins de 40 unités)
   * TGA prêteur de base: 8.75%
   */
  RPA_PETITE_MOINS_40: {
    id: 'RPA_PETITE_MOINS_40',
    label: 'Petite RPA (< 40 unités)',
    description: 'Petite résidence - TGA 8.75%',
    capRateTarget: 0.0875,     // 8.75% - TGA investisseur (même que base bancaire)
    capRateLender: BANK_REFERENCE_PARAMS.capRateLenderBase.moins40, // 8.75% - Base bancaire
    mrbTarget: 2.5,            // MRB
    mrnTarget: 11.0,           // MRN
    expenseRatioTypical: 0.80, // 80%
    dscrMin: BANK_REFERENCE_PARAMS.dscrMin,   // 1.50
    ltvMax: BANK_REFERENCE_PARAMS.ltvMax,     // 65%
    weights: {
      income: 0.60,
      mrb: 0.40,
    },
    autoSuggestCriteria: {
      maxUnits: 39,
    },
  },

  /**
   * RPA en redressement - Risque élevé
   * TGA prêteur ajusté: +1% au-dessus de la base (via lenderCapRate.ts)
   * LTV réduit à 60%
   */
  RPA_REDRESSEMENT: {
    id: 'RPA_REDRESSEMENT',
    label: 'RPA en Redressement',
    description: 'Résidence en difficulté - TGA 10%',
    capRateTarget: 0.10,       // 10% - TGA investisseur (prime de risque)
    capRateLender: 0.0975,     // 9.75% - Base + 1% risque redressement
    mrbTarget: 2.0,            // MRB bas
    mrnTarget: 10.0,           // MRN bas
    expenseRatioTypical: 0.85, // 85% - Inefficiences opérationnelles
    dscrMin: BANK_REFERENCE_PARAMS.dscrMin,   // 1.50
    ltvMax: 0.60,              // 60% - LTV restrictif (risque élevé)
    weights: {
      income: 0.70,            // Plus de poids sur le revenu actuel
      mrb: 0.30,
    },
    autoSuggestCriteria: {
      // Pas de critères automatiques - sélection manuelle
    },
  },
};

/**
 * Obtient un profil par son ID
 */
export function getValuationProfile(profileId: ValuationProfileId): ValuationProfile {
  const profile = VALUATION_PROFILES[profileId];
  if (!profile) {
    throw new Error(`Profil de valorisation inconnu: ${profileId}`);
  }
  return profile;
}

/**
 * Suggère automatiquement un profil basé sur les caractéristiques de la résidence
 *
 * NOTE: La sélection est basée UNIQUEMENT sur le nombre d'unités.
 * Pas de distinction par région (même TGA partout au Québec).
 *
 * @param nombreUnites - Nombre d'unités de la résidence
 * @param _ville - Non utilisé (conservé pour compatibilité)
 * @param occupancyRate - Taux d'occupation (optionnel, 0-1)
 * @returns Le profil suggéré
 */
export function suggestValuationProfile(
  nombreUnites: number,
  _ville?: string,
  occupancyRate?: number
): ValuationProfile {
  // Si taux d'occupation très bas, suggérer redressement
  if (occupancyRate !== undefined && occupancyRate < 0.75) {
    return VALUATION_PROFILES.RPA_REDRESSEMENT;
  }

  // Sélection basée UNIQUEMENT sur le nombre d'unités
  // Grande RPA (80+ unités) - TGA 8%
  if (nombreUnites >= 80) {
    return VALUATION_PROFILES.RPA_URBAINE_80PLUS;
  }

  // RPA moyenne (40-80 unités) - TGA 8.75%
  if (nombreUnites >= 40) {
    return VALUATION_PROFILES.RPA_REGION_40_80;
  }

  // Petite RPA (<40 unités) - TGA 9.5%
  return VALUATION_PROFILES.RPA_PETITE_MOINS_40;
}

/**
 * Liste tous les profils disponibles pour l'UI
 */
export function getAllValuationProfiles(): ValuationProfile[] {
  return Object.values(VALUATION_PROFILES);
}

/**
 * Valide qu'un ID de profil est valide
 */
export function isValidProfileId(profileId: string): profileId is ValuationProfileId {
  return profileId in VALUATION_PROFILES;
}
