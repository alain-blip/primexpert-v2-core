/**
 * Quality Rules — LOT 6
 *
 * Définit les règles de qualité pour les champs canoniques d'une résidence.
 * Chaque champ a un niveau de criticité et un poids pour le calcul du score.
 *
 * Niveaux:
 * - CRITICAL: bloquant pour un dossier "prêt à travailler"
 * - IMPORTANT: influence valeur/financement
 * - OPTIONAL: nice-to-have
 */

// ============================================================
// TYPES
// ============================================================

export type CriticalityLevel = 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';

export type FieldCategory =
  | 'identity'
  | 'location'
  | 'contact'
  | 'legal'
  | 'capacity'
  | 'building'
  | 'safety'
  | 'finance'
  | 'market';

export interface FieldRule {
  /** Clé canonique du champ */
  key: string;
  /** Catégorie fonctionnelle */
  category: FieldCategory;
  /** Niveau de criticité */
  criticality: CriticalityLevel;
  /** Poids dans le calcul du score (1-10) */
  weight: number;
  /** Label humain */
  label: string;
  /** Champs alternatifs (OR logic) - si un est rempli, la règle est satisfaite */
  alternatives?: string[];
  /** Valeurs considérées comme "inconnues" mais acceptables */
  acceptUnknown?: boolean;
  /** Valeurs explicites considérées comme valides même si falsy */
  acceptFalse?: boolean;
}

export interface CategoryInfo {
  key: FieldCategory;
  label: string;
  icon: string;
}

// ============================================================
// CATÉGORIES
// ============================================================

export const FIELD_CATEGORIES: Record<FieldCategory, CategoryInfo> = {
  identity: { key: 'identity', label: 'Identité', icon: 'Badge' },
  location: { key: 'location', label: 'Localisation', icon: 'LocationOn' },
  contact: { key: 'contact', label: 'Coordonnées', icon: 'Phone' },
  legal: { key: 'legal', label: 'Structure légale', icon: 'Gavel' },
  capacity: { key: 'capacity', label: 'Capacité', icon: 'People' },
  building: { key: 'building', label: 'Bâtiment', icon: 'Apartment' },
  safety: { key: 'safety', label: 'Sécurité', icon: 'Security' },
  finance: { key: 'finance', label: 'Finances', icon: 'AttachMoney' },
  market: { key: 'market', label: 'Marché', icon: 'TrendingUp' },
};

// ============================================================
// RÈGLES DE QUALITÉ (35 CHAMPS CANONIQUES)
// ============================================================

export const QUALITY_RULES: FieldRule[] = [
  // ========== IDENTITY (CRITICAL) ==========
  {
    key: 'name',
    category: 'identity',
    criticality: 'CRITICAL',
    weight: 10,
    label: 'Nom de la résidence',
  },
  {
    key: 'residenceType',
    category: 'identity',
    criticality: 'CRITICAL',
    weight: 8,
    label: 'Type de résidence',
  },
  {
    key: 'categorieRPA',
    category: 'identity',
    criticality: 'CRITICAL',
    weight: 8,
    label: 'Catégorie RPA',
  },

  // ========== LOCATION (CRITICAL) ==========
  {
    key: 'address',
    category: 'location',
    criticality: 'CRITICAL',
    weight: 10,
    label: 'Adresse',
    alternatives: ['adresse'],
  },
  {
    key: 'municipalite',
    category: 'location',
    criticality: 'CRITICAL',
    weight: 8,
    label: 'Municipalité',
    alternatives: ['ville'],
  },
  {
    key: 'regionSociosanitaire',
    category: 'location',
    criticality: 'IMPORTANT',
    weight: 6,
    label: 'Région sociosanitaire',
    alternatives: ['region'],
  },
  {
    key: 'codePostal',
    category: 'location',
    criticality: 'OPTIONAL',
    weight: 3,
    label: 'Code postal',
  },

  // ========== CONTACT (CRITICAL) ==========
  {
    key: 'telephone',
    category: 'contact',
    criticality: 'CRITICAL',
    weight: 8,
    label: 'Téléphone',
  },
  {
    key: 'courriel',
    category: 'contact',
    criticality: 'IMPORTANT',
    weight: 5,
    label: 'Courriel',
  },
  {
    key: 'siteWeb',
    category: 'contact',
    criticality: 'OPTIONAL',
    weight: 2,
    label: 'Site web',
    alternatives: ['websiteUrl', 'siteInternetResidence'],
  },

  // ========== LEGAL (CRITICAL) ==========
  {
    key: 'raisonSociale',
    category: 'legal',
    criticality: 'CRITICAL',
    weight: 8,
    label: 'Raison sociale',
    alternatives: ['neq', 'nomCompagnie'], // Au moins un requis
  },
  {
    key: 'neq',
    category: 'legal',
    criticality: 'IMPORTANT',
    weight: 6,
    label: 'Numéro NEQ',
  },
  {
    key: 'formeJuridique',
    category: 'legal',
    criticality: 'IMPORTANT',
    weight: 5,
    label: 'Forme juridique',
  },

  // ========== CAPACITY (CRITICAL) ==========
  {
    key: 'nombreUnitesTotal',
    category: 'capacity',
    criticality: 'CRITICAL',
    weight: 10,
    label: 'Nombre d\'unités total',
    alternatives: ['unitsCount', 'nombreUnites', 'nombreUnitesRPA'],
  },
  {
    key: 'tauxOccupation',
    category: 'capacity',
    criticality: 'CRITICAL',
    weight: 9,
    label: 'Taux d\'occupation',
    alternatives: ['occupancyRate'],
  },
  {
    key: 'nombreUnitesDisponibles',
    category: 'capacity',
    criticality: 'IMPORTANT',
    weight: 6,
    label: 'Unités disponibles',
  },

  // ========== BUILDING (IMPORTANT) ==========
  {
    key: 'anneeConstruction',
    category: 'building',
    criticality: 'IMPORTANT',
    weight: 7,
    label: 'Année de construction',
    alternatives: ['anneeConstructionApprox', 'yearBuilt'],
  },
  {
    key: 'nombreEtages',
    category: 'building',
    criticality: 'IMPORTANT',
    weight: 5,
    label: 'Nombre d\'étages',
    alternatives: ['floors'],
  },
  {
    key: 'superficieBatiment',
    category: 'building',
    criticality: 'IMPORTANT',
    weight: 5,
    label: 'Superficie du bâtiment',
    alternatives: ['buildingArea'],
  },
  {
    key: 'superficieTerrain',
    category: 'building',
    criticality: 'OPTIONAL',
    weight: 3,
    label: 'Superficie du terrain',
    alternatives: ['landArea'],
  },

  // ========== SAFETY (CRITICAL) ==========
  {
    key: 'systemeGicleurs',
    category: 'safety',
    criticality: 'CRITICAL',
    weight: 9,
    label: 'Système de gicleurs',
    acceptUnknown: true, // "unknown" accepté
    acceptFalse: true, // false explicite = OK (pas de gicleurs)
  },
  {
    key: 'ascenseur',
    category: 'safety',
    criticality: 'IMPORTANT',
    weight: 6,
    label: 'Ascenseur',
    acceptUnknown: true,
    acceptFalse: true,
  },
  {
    key: 'categorieSecurite',
    category: 'safety',
    criticality: 'IMPORTANT',
    weight: 6,
    label: 'Catégorie sécurité',
  },

  // ========== FINANCE (CRITICAL si vendeur) ==========
  {
    key: 'askingPrice',
    category: 'finance',
    criticality: 'IMPORTANT',
    weight: 8,
    label: 'Prix demandé',
    alternatives: ['prixDemande'],
  },
  {
    key: 'revenusAnnuels',
    category: 'finance',
    criticality: 'IMPORTANT',
    weight: 8,
    label: 'Revenus annuels',
    alternatives: ['annualRevenue', 'totalRevenusAnnuels'],
  },
  {
    key: 'depensesAnnuelles',
    category: 'finance',
    criticality: 'IMPORTANT',
    weight: 7,
    label: 'Dépenses annuelles',
    alternatives: ['annualExpenses', 'totalDepensesAnnuelles'],
  },
  {
    key: 'loyerMoyen',
    category: 'finance',
    criticality: 'IMPORTANT',
    weight: 6,
    label: 'Loyer moyen',
    alternatives: ['averageRent'],
  },
  {
    key: 'tauxCapitalisation',
    category: 'finance',
    criticality: 'IMPORTANT',
    weight: 7,
    label: 'Taux de capitalisation',
    alternatives: ['capRate'],
  },
  {
    key: 'evaluationFonciere',
    category: 'finance',
    criticality: 'OPTIONAL',
    weight: 4,
    label: 'Évaluation foncière',
    alternatives: ['propertyAssessment'],
  },

  // ========== MARKET (OPTIONAL) ==========
  {
    key: 'dateOuverture',
    category: 'market',
    criticality: 'OPTIONAL',
    weight: 3,
    label: 'Date d\'ouverture',
    alternatives: ['openingDate'],
  },
  {
    key: 'datePrisePossession',
    category: 'market',
    criticality: 'OPTIONAL',
    weight: 3,
    label: 'Date de prise de possession',
    alternatives: ['possessionDate'],
  },
  {
    key: 'anneeAcquisitionImmeuble',
    category: 'market',
    criticality: 'OPTIONAL',
    weight: 3,
    label: 'Année d\'acquisition immeuble',
  },
  {
    key: 'anneeDebutExploitationRPA',
    category: 'market',
    criticality: 'OPTIONAL',
    weight: 3,
    label: 'Année début exploitation RPA',
  },
];

// ============================================================
// HELPERS
// ============================================================

/**
 * Récupère les règles par catégorie
 */
export function getRulesByCategory(category: FieldCategory): FieldRule[] {
  return QUALITY_RULES.filter((rule) => rule.category === category);
}

/**
 * Récupère les règles par criticité
 */
export function getRulesByCriticality(criticality: CriticalityLevel): FieldRule[] {
  return QUALITY_RULES.filter((rule) => rule.criticality === criticality);
}

/**
 * Récupère une règle par clé
 */
export function getRuleByKey(key: string): FieldRule | undefined {
  return QUALITY_RULES.find((rule) => rule.key === key);
}

/**
 * Poids par criticité pour le scoring
 */
export const CRITICALITY_WEIGHTS: Record<CriticalityLevel, number> = {
  CRITICAL: 3,
  IMPORTANT: 2,
  OPTIONAL: 1,
};

/**
 * Seuils de score pour le statut
 */
export const SCORE_THRESHOLDS = {
  GREEN: 85,
  YELLOW: 60,
  // En dessous de YELLOW = RED
};

/**
 * Seuils de fraîcheur (en jours)
 */
export const FRESHNESS_THRESHOLDS = {
  /** Sources externes considérées stale après X jours */
  SOURCES_STALE_DAYS: 30,
  /** Documents considérés stale après X jours */
  DOCUMENTS_STALE_DAYS: 30,
};

/**
 * Priorités des recommandations
 */
export type RecommendationPriority = 'P0' | 'P1' | 'P2';

/**
 * Types d'actions recommandées
 */
export type RecommendationAction =
  | 'SYNC_SOURCES'
  | 'UPLOAD_DOCUMENT'
  | 'REVIEW_CONFLICT'
  | 'FILL_FIELD'
  | 'REFRESH_SOURCE';

export default QUALITY_RULES;
