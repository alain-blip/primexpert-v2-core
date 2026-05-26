/**
 * SELLER NARRATIVE SELECTION — Templates Fallback (sans IA)
 * AI interpreter over deterministic benchmarks (no judgment)
 *
 * Ces templates sont utilisés lorsque:
 * - L'IA n'est pas disponible
 * - La validation JSON de l'IA échoue
 * - Le mode 'RULES' est explicitement demandé
 *
 * @author Copilote IA - RPAaVendre.com
 * @version 1.0.0
 */

import type {
  SellerNarrativeDecision,
  SellerNarrativeVariant,
  NarrativeConfidence,
  NarrativeFeatureVector,
  PricingOpportunityTag,
} from './types';
import { GAP_THRESHOLDS } from './types';

// ============================================================================
// TEMPLATES NARRATIFS PAR VARIANTE
// ============================================================================

/**
 * Templates pour chaque variante narrative
 * Textes ultra premium, sans jugement, ton conseiller
 */
const NARRATIVE_TEMPLATES: Record<
  SellerNarrativeVariant,
  {
    readingAngle: string;
    signedReading: string;
    talkTrackBullets: [string, string, string];
  }
> = {
  /**
   * STABLE_LISIBLE
   * Performance alignée avec les repères du marché
   */
  STABLE_LISIBLE: {
    readingAngle: 'Lecture basée sur repères comparables et performance démontrée',
    signedReading:
      'Les indicateurs financiers de la résidence s\'inscrivent dans les repères généralement observés ' +
      'pour des configurations comparables sur le marché des résidences privées pour aînés au Québec. ' +
      'La structure des dépenses et le rendement implicite se situent dans des plages cohérentes avec ' +
      'les pratiques usuelles du segment. Cette lecture permet d\'aborder les discussions avec les ' +
      'acheteurs potentiels sur une base claire et documentée, facilitant ainsi un processus de ' +
      'transaction structuré et professionnel.',
    talkTrackBullets: [
      'Les ratios d\'exploitation s\'inscrivent dans les repères du marché comparable',
      'La structure financière facilite une lecture claire pour les acheteurs',
      'Le positionnement actuel soutient une mise en marché structurée',
    ],
  },

  /**
   * EQUILIBRE
   * Performance avec quelques écarts notables mais dans une plage acceptable
   */
  EQUILIBRE: {
    readingAngle: 'Lecture comparative basée sur les pratiques observées dans le segment',
    signedReading:
      'L\'analyse comparative révèle une structure d\'exploitation présentant des caractéristiques ' +
      'propres à l\'historique de la résidence. Certains indicateurs se situent dans des plages ' +
      'légèrement différentes des repères médians du marché, ce qui peut influencer la perception ' +
      'des acheteurs lors de l\'analyse du dossier. Ces éléments constituent des points de discussion ' +
      'pertinents lors des échanges, permettant de contextualiser la performance démontrée dans le ' +
      'cadre des choix de gestion effectués au fil du temps.',
    talkTrackBullets: [
      'Certains indicateurs présentent des caractéristiques propres à la résidence',
      'La structure actuelle reflète des choix de gestion spécifiques à l\'historique',
      'Ces éléments peuvent être contextualisés lors des discussions avec les acheteurs',
    ],
  },

  /**
   * POTENTIEL_NON_REFLETE
   * Performance actuelle ne reflète pas pleinement le potentiel opérationnel théorique
   * (texte exact exigé par le cahier des charges)
   */
  POTENTIEL_NON_REFLETE: {
    readingAngle: 'Lecture basée sur le potentiel opérationnel théorique et l\'historique de la résidence',
    signedReading:
      'Un acheteur expérimenté observera une exploitation dont la performance actuelle ne reflète pas ' +
      'pleinement le potentiel opérationnel théorique, principalement en raison de choix de gestion ' +
      'et d\'organisation propres à l\'historique de la résidence. Cette lecture ne constitue pas une ' +
      'appréciation de la qualité de la gestion, mais une interprétation de la façon dont le marché ' +
      'analyse la performance démontrée à un moment donné. Cette transparence permet d\'aborder les ' +
      'discussions sur une base factuelle et de positionner le dossier avec clarté.',
    talkTrackBullets: [
      'Le potentiel opérationnel théorique dépasse la performance actuellement démontrée',
      'Les choix de gestion historiques expliquent le positionnement actuel',
      'Cette lecture permet d\'anticiper les questions des acheteurs expérimentés',
    ],
  },
};

// ============================================================================
// TEMPLATES AVEC CONFIDENCE LOW (Données insuffisantes)
// ============================================================================

/**
 * Templates prudents pour confidence LOW
 * Utilisés quand les données de comparables sont insuffisantes
 */
const LOW_CONFIDENCE_TEMPLATES: Record<
  SellerNarrativeVariant,
  {
    readingAngle: string;
    signedReading: string;
    talkTrackBullets: [string, string, string];
  }
> = {
  STABLE_LISIBLE: {
    readingAngle: 'Lecture basée sur les repères usuels du marché',
    signedReading:
      'Sur la base des informations disponibles et des repères usuels du marché des résidences ' +
      'privées pour aînés au Québec, les indicateurs de la résidence s\'inscrivent dans des plages ' +
      'généralement observées pour ce type d\'actif. Cette lecture préliminaire permet d\'orienter ' +
      'les discussions, tout en reconnaissant que des analyses complémentaires pourront affiner ' +
      'le positionnement lors du processus de mise en marché.',
    talkTrackBullets: [
      'Les indicateurs s\'inscrivent dans les repères usuels du marché',
      'La lecture actuelle constitue une base pour les discussions préliminaires',
      'Des analyses complémentaires pourront affiner le positionnement',
    ],
  },

  EQUILIBRE: {
    readingAngle: 'Lecture préliminaire basée sur les informations disponibles',
    signedReading:
      'Les informations disponibles suggèrent une structure d\'exploitation présentant des ' +
      'caractéristiques qui pourront être contextualisées lors des échanges avec les acheteurs. ' +
      'Cette lecture préliminaire, basée sur les repères usuels du marché, permet d\'anticiper ' +
      'les points de discussion pertinents tout en reconnaissant l\'importance d\'une analyse ' +
      'approfondie dans le cadre du processus de mise en marché.',
    talkTrackBullets: [
      'La structure présente des caractéristiques à contextualiser lors des échanges',
      'Les repères usuels du marché orientent cette lecture préliminaire',
      'Une analyse approfondie affinera le positionnement',
    ],
  },

  POTENTIEL_NON_REFLETE: {
    readingAngle: 'Lecture préliminaire basée sur les informations disponibles',
    signedReading:
      'Sur la base des informations disponibles, la performance démontrée semble se situer en deçà ' +
      'de ce que les repères usuels du marché suggèrent pour ce type de résidence. Cette observation ' +
      'préliminaire ne constitue pas un jugement sur la gestion, mais une indication de la façon dont ' +
      'un acheteur pourrait percevoir le dossier. Une analyse plus approfondie permettra de mieux ' +
      'contextualiser cette lecture dans le cadre du processus de mise en marché.',
    talkTrackBullets: [
      'La performance observée se situe en deçà des repères usuels du marché',
      'Cette lecture préliminaire anticipe la perception potentielle des acheteurs',
      'Une analyse approfondie permettra de contextualiser cette observation',
    ],
  },
};

// ============================================================================
// TEMPLATES — BOUSSOLE TGA IMPLICITE VS TGA CIBLE (ACM)
// ============================================================================

const PRICING_OPPORTUNITY_TEMPLATES: Record<
  PricingOpportunityTag,
  {
    readingAngle: string;
    signedReading: string;
    talkTrackBullets: [string, string, string];
    variant: SellerNarrativeVariant;
  }
> = {
  OPPORTUNITÉ_SOUS_ÉVALUÉE: {
    variant: 'STABLE_LISIBLE',
    readingAngle:
      'Lecture — rendement au prix demandé supérieur au taux de capitalisation cible du marché',
    signedReading:
      'Au prix demandé actuel, le taux de capitalisation implicite dépasse le taux de capitalisation ' +
      'cible retenu pour le marché régional. En d’autres termes, l’offre présente un rendement ' +
      'exceptionnel par rapport aux attentes des investisseurs pour ce segment. Cette configuration ' +
      'constitue une opportunité de création de valeur pour un acheteur expérimenté : le prix ' +
      'demandé traduit une aubaine financière plutôt qu’une sous-performance de l’exploitation. ' +
      'La mise en marché peut s’appuyer sur cette lecture pour positionner le dossier avec ' +
      'transparence et crédibilité auprès du marché.',
    talkTrackBullets: [
      'Le rendement implicite au prix demandé dépasse le taux cible du marché',
      'Le prix offre une marge de création de valeur pour l’acheteur',
      'Positionner le dossier sur l’opportunité financière, pas sur la critique opérationnelle',
    ],
  },
  SURÉVALUÉ_RISQUE: {
    variant: 'EQUILIBRE',
    readingAngle:
      'Lecture — rendement au prix demandé inférieur au taux de capitalisation cible du marché',
    signedReading:
      'Au prix demandé actuel, le taux de capitalisation implicite se situe en deçà du taux de ' +
      'capitalisation cible retenu pour le marché régional. Les acheteurs expérimentés ' +
      'interpréteront cette lecture comme un prix qui ne génère pas suffisamment de rendement ' +
      'pour justifier l’investissement au regard des repères du segment. Une discussion structurée ' +
      'sur le positionnement tarifaire permettra d’aligner les attentes et de faciliter un ' +
      'processus de transaction réaliste.',
    talkTrackBullets: [
      'Le rendement implicite est inférieur au taux cible du marché',
      'Le prix demandé peut limiter l’intérêt des investisseurs institutionnels',
      'Préparer une justification ou un ajustement de prix en cohérence avec le marché',
    ],
  },
  PRIX_JUSTE: {
    variant: 'STABLE_LISIBLE',
    readingAngle:
      'Lecture — prix demandé aligné avec le taux de capitalisation cible du marché',
    signedReading:
      'Au prix demandé actuel, le taux de capitalisation implicite s’aligne avec le taux de ' +
      'capitalisation cible retenu pour le marché régional. La propriété se positionne de façon ' +
      'cohérente avec les attentes des investisseurs pour des configurations comparables. Cette ' +
      'lecture soutient une mise en marché structurée, fondée sur des repères financiers ' +
      'reconnus et une transparence adaptée aux échanges avec les acheteurs potentiels.',
    talkTrackBullets: [
      'Le rendement implicite correspond au taux cible du marché',
      'Le positionnement tarifaire est cohérent avec les repères régionaux',
      'Faciliter des discussions factuelles avec les acheteurs',
    ],
  },
};

// ============================================================================
// FONCTION DE SÉLECTION DÉTERMINISTE
// ============================================================================

/**
 * Détermine la variante narrative basée sur les écarts calculés
 *
 * Règles de sélection:
 * - STABLE_LISIBLE: tous les écarts < NOTABLE_GAP_PCT (8%)
 * - EQUILIBRE: au moins un écart entre NOTABLE et SIGNIFICANT
 * - POTENTIEL_NON_REFLETE: au moins un écart >= SIGNIFICANT_GAP_PCT (15%)
 *
 * @param featureVector - Vecteur de caractéristiques avec les écarts calculés
 * @returns Variante narrative sélectionnée
 */
export function selectVariantByRules(
  featureVector: NarrativeFeatureVector
): SellerNarrativeVariant {
  const { SIGNIFICANT_GAP_PCT, NOTABLE_GAP_PCT, SIGNIFICANT_CAPRATE_BPS } = GAP_THRESHOLDS;

  // Collecter les écarts absolus disponibles
  const gaps: number[] = [];

  if (featureVector.expenseRatioGapPct !== null) {
    gaps.push(Math.abs(featureVector.expenseRatioGapPct));
  }
  if (featureVector.salaryRatioGapPct !== null) {
    gaps.push(Math.abs(featureVector.salaryRatioGapPct));
  }
  if (featureVector.foodRatioGapPct !== null) {
    gaps.push(Math.abs(featureVector.foodRatioGapPct));
  }
  if (featureVector.noiMarginGapPct !== null) {
    // Pour NOI margin, un écart négatif signifie sous-performance
    // On prend la valeur absolue pour la classification
    gaps.push(Math.abs(featureVector.noiMarginGapPct));
  }

  // Ne pas mélanger l'écart TGA (boussole prix) avec les ratios d'exploitation :
  // un TGA implicite élevé = opportunité, pas une « sous-performance ».

  // Si aucun écart disponible, défaut STABLE_LISIBLE
  if (gaps.length === 0) {
    return 'STABLE_LISIBLE';
  }

  const maxGap = Math.max(...gaps);

  // Classification basée sur l'écart maximum
  if (maxGap >= SIGNIFICANT_GAP_PCT) {
    return 'POTENTIEL_NON_REFLETE';
  }

  if (maxGap >= NOTABLE_GAP_PCT) {
    return 'EQUILIBRE';
  }

  return 'STABLE_LISIBLE';
}

/**
 * Détermine le niveau de confiance basé sur les données disponibles
 *
 * @param featureVector - Vecteur de caractéristiques
 * @returns Niveau de confiance
 */
export function determineConfidence(
  featureVector: NarrativeFeatureVector
): NarrativeConfidence {
  const { sampleCount, hasMarketData } = featureVector;

  if (!hasMarketData || sampleCount < 10) {
    return 'LOW';
  }

  if (sampleCount >= 20) {
    return 'HIGH';
  }

  return 'MEDIUM';
}

// ============================================================================
// FONCTION PRINCIPALE - GÉNÉRATION TEMPLATE FALLBACK
// ============================================================================

/**
 * Génère une décision narrative basée sur les règles déterministes (fallback)
 *
 * Cette fonction est utilisée:
 * - En mode 'RULES' explicite
 * - Comme fallback si l'IA échoue
 * - Si la validation JSON de l'IA échoue
 *
 * @param featureVector - Vecteur de caractéristiques calculé
 * @returns Décision narrative complète
 */
export function generateFallbackNarrative(
  featureVector: NarrativeFeatureVector
): SellerNarrativeDecision {
  const confidence = determineConfidence(featureVector);

  const opportunityTag = featureVector.pricingOpportunityTag;
  if (opportunityTag) {
    const oppTemplate = PRICING_OPPORTUNITY_TEMPLATES[opportunityTag];
    const reasons: string[] = [
      `Pricing tag: ${opportunityTag}`,
      `Confidence: ${confidence}`,
      `Cap rate gap: ${featureVector.capRateGapBps ?? 'n/a'} bps`,
    ];
    if (featureVector.expenseRatioGapPct !== null) {
      reasons.push(`Expense ratio gap: ${featureVector.expenseRatioGapPct.toFixed(1)}%`);
    }
    const trendSuffix =
      featureVector.costTrendNotes?.length ?
        '\n\n' + (featureVector.costTrendNotes[0] ?? featureVector.costTrendNotes.join(' '))
      : '';
    return {
      variant: oppTemplate.variant,
      confidence,
      readingAngle: oppTemplate.readingAngle,
      signedReading: oppTemplate.signedReading + trendSuffix,
      talkTrackBullets: oppTemplate.talkTrackBullets,
      reasons,
      source: 'RULES',
    };
  }

  const variant = selectVariantByRules(featureVector);

  // Sélectionner le template approprié selon la confiance
  const templates = confidence === 'LOW'
    ? LOW_CONFIDENCE_TEMPLATES
    : NARRATIVE_TEMPLATES;

  const template = templates[variant];

  // Construire les raisons pour debug
  const reasons: string[] = [
    `Variant selected: ${variant}`,
    `Confidence: ${confidence}`,
    `Sample count: ${featureVector.sampleCount}`,
    `Has market data: ${featureVector.hasMarketData}`,
  ];

  if (featureVector.expenseRatioGapPct !== null) {
    reasons.push(`Expense ratio gap: ${featureVector.expenseRatioGapPct.toFixed(1)}%`);
  }
  if (featureVector.noiMarginGapPct !== null) {
    reasons.push(`NOI margin gap: ${featureVector.noiMarginGapPct.toFixed(1)}%`);
  }
  if (featureVector.capRateGapBps !== null) {
    reasons.push(`Cap rate gap: ${featureVector.capRateGapBps.toFixed(0)} bps`);
  }

  const trendSuffix =
    featureVector.costTrendNotes?.length ?
      '\n\n' + featureVector.costTrendNotes.slice(0, 2).join(' ')
    : '';

  return {
    variant,
    confidence,
    readingAngle: template.readingAngle,
    signedReading: template.signedReading + trendSuffix,
    talkTrackBullets: template.talkTrackBullets,
    reasons,
    source: 'RULES',
  };
}

export default generateFallbackNarrative;
