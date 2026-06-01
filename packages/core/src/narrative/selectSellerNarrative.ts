/**
 * SELLER NARRATIVE SELECTION — Logique de sélection principale
 * AI interpreter over deterministic benchmarks (no judgment)
 *
 * Ce module:
 * 1. Construit le feature vector à partir des données résidence + benchmarks
 * 2. Appelle l'IA (si mode AI) ou utilise les règles déterministes
 * 3. Valide et lint le résultat avant de le retourner
 *
 * @author Copilote IA - RPAaVendre.com
 * @version 1.0.0
 */

import type {
  SellerNarrativeDecision,
  NarrativeFeatureVector,
  NarrativeOptions,
} from './types';
import { DEFAULT_NARRATIVE_OPTIONS } from './types';
import { generateFallbackNarrative } from './sellerNarrativeTemplates';
import { generateAINarrative } from '@primexpert/core/services/aiNarrativeService';
import { lintNarrativeText, sanitizeNarrativeText } from './narrativeLint';
import type { ComparableBenchmarks } from '../valuation/comparableBenchmarks';
import { classifyPricingOpportunityTag } from './pricingOpportunity';
import {
  computeCapitalizationRateDecimal,
  normalizeCapRateToDecimal,
} from '../financial/capitalization';

// ============================================================================
// INTERFACES POUR LES DONNÉES D'ENTRÉE
// ============================================================================

/**
 * Données financières de la résidence pour le calcul du feature vector
 */
export interface ResidenceFinancials {
  /** Revenu brut effectif (RBE) */
  rbe: number;
  /** Revenu net d'exploitation (NOI) */
  noi?: number;
  /** Total des dépenses */
  totalExpenses?: number;
  /** Dépenses salaires */
  salaires?: number;
  /** Dépenses nourriture */
  nourriture?: number;
  /** Prix demandé (pour calcul cap rate implicite) */
  prixDemande?: number;
}

/**
 * Données de marché optionnelles
 */
export interface MarketData {
  /** Cap rate médian du marché (si disponible via marketCapRate.ts) */
  capRateMedian?: number;
  /** Notes tendances inflation coûts régionaux (GPS) */
  costTrendNotes?: string[];
}

// ============================================================================
// CONSTRUCTION DU FEATURE VECTOR
// ============================================================================

/**
 * Calcule l'écart en pourcentage entre deux valeurs
 * Retourne null si l'une des valeurs est invalide
 */
function calculateGapPct(
  residenceValue: number | undefined | null,
  benchmarkValue: number | undefined | null
): number | null {
  if (
    residenceValue === undefined ||
    residenceValue === null ||
    benchmarkValue === undefined ||
    benchmarkValue === null ||
    benchmarkValue === 0
  ) {
    return null;
  }

  const gap = residenceValue - benchmarkValue;
  return Math.round((gap / benchmarkValue) * 1000) / 10; // Arrondi à 0.1%
}

/**
 * Construit le feature vector à partir des données résidence et benchmarks
 *
 * @param residenceData - Données financières de la résidence
 * @param benchmarks - Benchmarks des comparables (ou defaults)
 * @param marketData - Données de marché optionnelles
 * @returns Feature vector pour la sélection narrative
 */
export function buildFeatureVector(
  residenceData: ResidenceFinancials,
  benchmarks: ComparableBenchmarks,
  marketData?: MarketData
): NarrativeFeatureVector {
  const { rbe, noi, totalExpenses, salaires, nourriture, prixDemande } = residenceData;

  // Calculer les ratios de la résidence
  const residenceExpenseRatio = rbe > 0 && totalExpenses ? totalExpenses / rbe : null;
  const residenceSalaryRatio = rbe > 0 && salaires ? salaires / rbe : null;
  const residenceFoodRatio = rbe > 0 && nourriture ? nourriture / rbe : null;
  const residenceNoiMargin = rbe > 0 && noi ? noi / rbe : null;

  // Cap rate implicite au prix demandé
  const capRateImplied =
    prixDemande && prixDemande > 0 && noi
      ? computeCapitalizationRateDecimal(noi, prixDemande)
      : null;

  // Cap rate de référence (priorité: marketData > benchmarks)
  const capRateReference = normalizeCapRateToDecimal(
    marketData?.capRateMedian ?? benchmarks.capRateMedian ?? null
  );

  // Calculer les écarts
  const expenseRatioGapPct = calculateGapPct(residenceExpenseRatio, benchmarks.expenseRatioAvg);
  const salaryRatioGapPct = calculateGapPct(residenceSalaryRatio, benchmarks.salaryRatioAvg);
  const foodRatioGapPct = calculateGapPct(residenceFoodRatio, benchmarks.foodRatioAvg);

  // Pour NOI margin, calculer l'écart vs (1 - expense ratio benchmark)
  const benchmarkNoiMargin = benchmarks.expenseRatioAvg
    ? 1 - benchmarks.expenseRatioAvg
    : null;
  const noiMarginGapPct = calculateGapPct(residenceNoiMargin, benchmarkNoiMargin);

  // Cap rate gap en points de base (100 bps = 1%)
  let capRateGapBps: number | null = null;
  if (capRateImplied !== null && capRateReference !== null) {
    capRateGapBps = Math.round((capRateImplied - capRateReference) * 10000);
  }

  const pricingOpportunityTag = classifyPricingOpportunityTag(
    capRateImplied,
    capRateReference
  );

  return {
    // Écarts calculés
    expenseRatioGapPct,
    salaryRatioGapPct,
    foodRatioGapPct,
    noiMarginGapPct,
    capRateGapBps,
    pricingOpportunityTag,

    // Métadonnées
    sampleCount: benchmarks.sampleCount,
    hasMarketData: benchmarks.source === 'COMPARABLES' || !!marketData?.capRateMedian,
    benchmarkSource: benchmarks.source,

    // Ratios bruts (pour contexte IA)
    residenceRatios: {
      expenseRatio: residenceExpenseRatio,
      salaryRatio: residenceSalaryRatio,
      foodRatio: residenceFoodRatio,
      noiMargin: residenceNoiMargin,
      capRateImplied,
    },

    // Repères de marché (pour contexte IA)
    marketBenchmarks: {
      expenseRatioAvg: benchmarks.expenseRatioAvg ?? null,
      salaryRatioAvg: benchmarks.salaryRatioAvg ?? null,
      foodRatioAvg: benchmarks.foodRatioAvg ?? null,
      capRateMedian: capRateReference,
    },
    costTrendNotes: marketData?.costTrendNotes?.length ? marketData.costTrendNotes : undefined,
  };
}

// ============================================================================
// FONCTION PRINCIPALE - SÉLECTION NARRATIVE
// ============================================================================

/**
 * Sélectionne et génère la narrative vendeur appropriée
 *
 * Flux:
 * 1. Construire le feature vector
 * 2. Si mode AI: appeler l'IA, valider JSON, lint texte
 * 3. Si IA échoue ou mode RULES: utiliser fallback déterministe
 * 4. Sanitizer le texte final (retirer mots interdits si présents)
 * 5. Retourner la décision narrative
 *
 * @param residenceData - Données financières de la résidence
 * @param benchmarks - Benchmarks des comparables
 * @param marketData - Données de marché optionnelles
 * @param options - Options de configuration
 * @returns Décision narrative ou null si mode OFF
 */
export async function selectSellerNarrative(
  residenceData: ResidenceFinancials,
  benchmarks: ComparableBenchmarks,
  marketData?: MarketData,
  options: Partial<NarrativeOptions> = {}
): Promise<SellerNarrativeDecision | null> {
  const config = { ...DEFAULT_NARRATIVE_OPTIONS, ...options };

  // Mode OFF: ne pas générer de narrative
  if (config.narrativeMode === 'OFF') {
    return null;
  }

  // Construire le feature vector
  const featureVector = buildFeatureVector(residenceData, benchmarks, marketData);

  if (config.debug) {
    console.log('[Narrative] Feature vector:', featureVector);
  }

  let decision: SellerNarrativeDecision;

  // Mode AI: tenter l'IA d'abord
  if (config.narrativeMode === 'AI') {
    try {
      const aiDecision = await generateAINarrative(featureVector, config.aiTimeoutMs);

      if (aiDecision) {
        // Lint le texte de l'IA
        const lintResult = lintNarrativeText(aiDecision.signedReading);

        if (lintResult.isValid) {
          decision = aiDecision;
          if (config.debug) {
            console.log('[Narrative] AI decision accepted:', decision.variant);
          }
        } else {
          // IA a produit des mots interdits, sanitizer et utiliser quand même
          if (config.debug) {
            console.warn('[Narrative] AI text contains forbidden words:', lintResult.foundWords);
          }
          decision = {
            ...aiDecision,
            signedReading: sanitizeNarrativeText(aiDecision.signedReading),
          };
        }
      } else {
        // IA a retourné null, utiliser fallback
        if (config.debug) {
          console.log('[Narrative] AI returned null, using fallback');
        }
        decision = generateFallbackNarrative(featureVector);
      }
    } catch (error) {
      // Erreur IA, utiliser fallback
      if (config.debug) {
        console.error('[Narrative] AI error, using fallback:', error);
      }
      decision = generateFallbackNarrative(featureVector);
    }
  } else {
    // Mode RULES: utiliser directement le fallback
    decision = generateFallbackNarrative(featureVector);
    if (config.debug) {
      console.log('[Narrative] RULES mode, using fallback:', decision.variant);
    }
  }

  // Lint final du texte (sécurité supplémentaire)
  const finalLint = lintNarrativeText(decision.signedReading);
  if (!finalLint.isValid) {
    decision = {
      ...decision,
      signedReading: sanitizeNarrativeText(decision.signedReading),
    };
  }

  // Lint des bullets aussi
  decision.talkTrackBullets = decision.talkTrackBullets.map(bullet => {
    const bulletLint = lintNarrativeText(bullet);
    return bulletLint.isValid ? bullet : sanitizeNarrativeText(bullet);
  }) as [string, string, string];

  return decision;
}

export default selectSellerNarrative;
