/**
 * SELLER NARRATIVE SELECTION — Types et interfaces
 * AI interpreter over deterministic benchmarks (no judgment)
 *
 * @author Copilote IA - RPAaVendre.com
 * @version 1.0.0
 */

// ============================================================================
// TYPES PRINCIPAUX
// ============================================================================

/**
 * Variantes narratives possibles pour le rapport vendeur
 * Ces labels sont internes et ne doivent PAS apparaître dans le PDF
 */
export type SellerNarrativeVariant =
  | 'STABLE_LISIBLE'           // Performance alignée avec le marché
  | 'EQUILIBRE'                // Performance avec quelques écarts notables
  | 'POTENTIEL_NON_REFLETE';   // Performance actuelle < potentiel théorique

/** Tag interne — boussole TGA implicite vs TGA cible (jamais affiché tel quel au client). */
export type PricingOpportunityTag =
  | 'OPPORTUNITÉ_SOUS_ÉVALUÉE'
  | 'SURÉVALUÉ_RISQUE'
  | 'PRIX_JUSTE';

/**
 * Niveau de confiance de la décision narrative
 */
export type NarrativeConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Décision narrative complète pour le rapport vendeur
 */
export interface SellerNarrativeDecision {
  /** Variante sélectionnée (interne, ne pas afficher) */
  variant: SellerNarrativeVariant;

  /** Niveau de confiance basé sur la qualité des données */
  confidence: NarrativeConfidence;

  /** Angle de lecture - 1 ligne en haut de la section (ex: "Lecture basée sur repères comparables...") */
  readingAngle: string;

  /** Texte "lecture signée" prêt à imprimer dans le PDF (60-140 mots) */
  signedReading: string;

  /** 3 bullets pour discussion vendeur (8-16 mots chacun) */
  talkTrackBullets: [string, string, string];

  /** Raisons internes (debug uniquement, jamais imprimées) */
  reasons?: string[];

  /** Source de la décision */
  source: 'AI' | 'RULES';
}

// ============================================================================
// FEATURE VECTOR - Entrées pour la sélection narrative
// ============================================================================

/**
 * Vecteur de caractéristiques pour la sélection narrative
 * Calculé à partir des ratios résidence vs benchmarks
 */
export interface NarrativeFeatureVector {
  // Écarts en pourcentage (résidence vs benchmark)
  /** Écart ratio dépenses totales (%) */
  expenseRatioGapPct: number | null;

  /** Écart ratio salaires (%) */
  salaryRatioGapPct: number | null;

  /** Écart ratio nourriture (%) */
  foodRatioGapPct: number | null;

  /** Écart ratio NOI/RBE (%) - positif = mieux que marché */
  noiMarginGapPct: number | null;

  /** Écart cap rate en points de base (bps) - positif = rendement supérieur */
  capRateGapBps: number | null;

  /** Boussole prix demandé vs TGA cible (prioritaire pour la rédaction) */
  pricingOpportunityTag: PricingOpportunityTag | null;

  // Métadonnées sur la qualité des données
  /** Nombre de comparables utilisés pour les benchmarks */
  sampleCount: number;

  /** Indique si des données de marché sont disponibles */
  hasMarketData: boolean;

  /** Source des benchmarks utilisés */
  benchmarkSource: 'COMPARABLES' | 'PROFILE_DEFAULTS';

  /** Notes tendances coûts régionaux (inflation GPS) pour le moteur narratif */
  costTrendNotes?: string[];

  // Ratios bruts de la résidence (pour contexte IA)
  residenceRatios: {
    expenseRatio: number | null;
    salaryRatio: number | null;
    foodRatio: number | null;
    noiMargin: number | null;
    capRateImplied: number | null;
  };

  // Repères de marché (pour contexte IA)
  marketBenchmarks: {
    expenseRatioAvg: number | null;
    salaryRatioAvg: number | null;
    foodRatioAvg: number | null;
    capRateMedian: number | null;
  };
}

// ============================================================================
// OPTIONS DE CONFIGURATION
// ============================================================================

/**
 * Options pour la sélection narrative
 */
export interface NarrativeOptions {
  /**
   * Mode de sélection narrative
   * - 'AI': Utilise l'IA avec fallback sur règles
   * - 'RULES': Utilise uniquement les règles déterministes
   * - 'OFF': Section narrative non affichée
   */
  narrativeMode: 'AI' | 'RULES' | 'OFF';

  /** Timeout pour l'appel IA en ms (défaut: 10000) */
  aiTimeoutMs?: number;

  /** Activer les logs de debug */
  debug?: boolean;
}

/**
 * Options par défaut
 */
export const DEFAULT_NARRATIVE_OPTIONS: NarrativeOptions = {
  narrativeMode: 'AI',
  aiTimeoutMs: 10000,
  debug: false,
};

// ============================================================================
// CONSTANTES DE SEUILS
// ============================================================================

/**
 * Seuils pour la détermination de la confiance
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Seuil pour HIGH confidence */
  HIGH_SAMPLE_COUNT: 20,
  /** Seuil pour MEDIUM confidence */
  MEDIUM_SAMPLE_COUNT: 10,
} as const;

/**
 * Seuils pour la classification des écarts (en %)
 */
export const GAP_THRESHOLDS = {
  /** Écart considéré comme significatif (%) */
  SIGNIFICANT_GAP_PCT: 15,
  /** Écart considéré comme notable (%) */
  NOTABLE_GAP_PCT: 8,
  /** Écart cap rate significatif (bps) */
  SIGNIFICANT_CAPRATE_BPS: 100,
} as const;

// ============================================================================
// MOTS INTERDITS / AUTORISÉS
// ============================================================================

/**
 * Mots strictement interdits dans le texte final du PDF
 * (vérification obligatoire avant impression)
 */
export const FORBIDDEN_WORDS = [
  'problème',
  'probleme',
  'faiblesse',
  'risque',
  'risques',
  'urgence',
  'urgent',
  'pression',
  'mal exploité',
  'mal exploitée',
  'inefficace',
  'défavorable',
  'defavorable',
  'trop élevé',
  'trop elevé',
  'trop élevée',
  'trop bas',
  'trop basse',
  'sous-performance',
  'sous-performant',
  'mauvais',
  'mauvaise',
  'critique',
  'alarmant',
  'inquiétant',
] as const;

/**
 * Expressions recommandées pour le vocabulaire conseiller
 */
export const RECOMMENDED_EXPRESSIONS = [
  'se situe',
  's\'inscrit',
  'lecture comparative',
  'repères',
  'repères de marché',
  'repères usuels',
  'peut influencer',
  'performance démontrée',
  'potentiel opérationnel théorique',
  'historique de la résidence',
  'pratiques observées',
  'configurations comparables',
] as const;
