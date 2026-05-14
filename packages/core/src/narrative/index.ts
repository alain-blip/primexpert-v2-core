/**
 * SELLER NARRATIVE SELECTION — Module exports
 * AI interpreter over deterministic benchmarks (no judgment)
 *
 * @author Copilote IA - RPAaVendre.com
 * @version 1.0.0
 */

// Types
export type {
  SellerNarrativeVariant,
  NarrativeConfidence,
  SellerNarrativeDecision,
  NarrativeFeatureVector,
  NarrativeOptions,
} from './types';

export {
  DEFAULT_NARRATIVE_OPTIONS,
  CONFIDENCE_THRESHOLDS,
  GAP_THRESHOLDS,
  FORBIDDEN_WORDS,
  RECOMMENDED_EXPRESSIONS,
} from './types';

// Sélection principale
export {
  selectSellerNarrative,
  buildFeatureVector,
} from './selectSellerNarrative';
export type { ResidenceFinancials, MarketData } from './selectSellerNarrative';

// Templates fallback
export {
  generateFallbackNarrative,
  selectVariantByRules,
  determineConfidence,
} from './sellerNarrativeTemplates';

// Lint et validation
export {
  lintNarrativeText,
  sanitizeNarrativeText,
  validateAndFixNarrative,
} from './narrativeLint';
export type { NarrativeLintResult } from './narrativeLint';
