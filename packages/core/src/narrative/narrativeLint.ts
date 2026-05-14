/**
 * SELLER NARRATIVE SELECTION — Lint et validation du texte
 * AI interpreter over deterministic benchmarks (no judgment)
 *
 * Ce module vérifie que le texte généré (IA ou templates) respecte
 * les règles de vocabulaire non négociables.
 *
 * @author Copilote IA - RPAaVendre.com
 * @version 1.0.0
 */

import { FORBIDDEN_WORDS, RECOMMENDED_EXPRESSIONS } from './types';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Résultat de la vérification lint
 */
export interface NarrativeLintResult {
  /** Le texte est-il valide (aucun mot interdit) */
  isValid: boolean;
  /** Mots interdits trouvés dans le texte */
  foundWords: string[];
  /** Expressions recommandées utilisées */
  usedRecommendedExpressions: string[];
  /** Score de qualité narrative (0-100) */
  qualityScore: number;
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Normalise un texte pour la recherche (minuscules, accents normalisés)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Retirer les accents
    .replace(/['']/g, "'"); // Normaliser les apostrophes
}

/**
 * Vérifie si un mot interdit est présent dans le texte
 * Utilise une recherche par limites de mots pour éviter les faux positifs
 */
function findForbiddenWord(normalizedText: string, word: string): boolean {
  const normalizedWord = normalizeText(word);

  // Pour les expressions multi-mots, recherche directe
  if (normalizedWord.includes(' ')) {
    return normalizedText.includes(normalizedWord);
  }

  // Pour les mots simples, utiliser les limites de mots
  const regex = new RegExp(`\\b${normalizedWord}\\b`, 'i');
  return regex.test(normalizedText);
}

// ============================================================================
// FONCTION PRINCIPALE - LINT
// ============================================================================

/**
 * Vérifie un texte narrative pour les mots interdits
 *
 * @param text - Texte à vérifier
 * @returns Résultat de la vérification avec détails
 */
export function lintNarrativeText(text: string): NarrativeLintResult {
  const normalizedText = normalizeText(text);
  const foundWords: string[] = [];
  const usedRecommendedExpressions: string[] = [];

  // Vérifier les mots interdits
  for (const word of FORBIDDEN_WORDS) {
    if (findForbiddenWord(normalizedText, word)) {
      foundWords.push(word);
    }
  }

  // Vérifier les expressions recommandées utilisées
  for (const expression of RECOMMENDED_EXPRESSIONS) {
    const normalizedExpr = normalizeText(expression);
    if (normalizedText.includes(normalizedExpr)) {
      usedRecommendedExpressions.push(expression);
    }
  }

  // Calculer le score de qualité
  // - Base: 100 points
  // - -20 points par mot interdit
  // - +5 points par expression recommandée (max +30)
  let qualityScore = 100;
  qualityScore -= foundWords.length * 20;
  qualityScore += Math.min(usedRecommendedExpressions.length * 5, 30);
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  return {
    isValid: foundWords.length === 0,
    foundWords,
    usedRecommendedExpressions,
    qualityScore,
  };
}

// ============================================================================
// FONCTION DE SANITIZATION
// ============================================================================

/**
 * Table de remplacement pour les mots interdits
 * Chaque mot interdit est remplacé par une expression neutre équivalente
 */
const REPLACEMENT_MAP: Record<string, string> = {
  'problème': 'élément',
  'probleme': 'élément',
  'faiblesse': 'caractéristique',
  'risque': 'élément',
  'risques': 'éléments',
  'urgence': 'opportunité',
  'urgent': 'pertinent',
  'pression': 'contexte',
  'mal exploité': 'potentiel non pleinement exprimé',
  'mal exploitée': 'potentiel non pleinement exprimé',
  'inefficace': 'susceptible d\'optimisation',
  'défavorable': 'à contextualiser',
  'defavorable': 'à contextualiser',
  'trop élevé': 'au-dessus des repères usuels',
  'trop elevé': 'au-dessus des repères usuels',
  'trop élevée': 'au-dessus des repères usuels',
  'trop bas': 'en deçà des repères usuels',
  'trop basse': 'en deçà des repères usuels',
  'sous-performance': 'écart par rapport aux repères',
  'sous-performant': 'en deçà des repères',
  'mauvais': 'à améliorer',
  'mauvaise': 'à améliorer',
  'critique': 'notable',
  'alarmant': 'notable',
  'inquiétant': 'à considérer',
};

/**
 * Remplace les mots interdits par des alternatives neutres
 *
 * @param text - Texte contenant potentiellement des mots interdits
 * @returns Texte sanitisé
 */
export function sanitizeNarrativeText(text: string): string {
  let sanitizedText = text;

  // Remplacer chaque mot interdit par son équivalent neutre
  for (const [forbidden, replacement] of Object.entries(REPLACEMENT_MAP)) {
    // Créer une regex insensible à la casse
    const regex = new RegExp(forbidden, 'gi');
    sanitizedText = sanitizedText.replace(regex, replacement);
  }

  return sanitizedText;
}

// ============================================================================
// FONCTION DE VALIDATION COMPLÈTE
// ============================================================================

/**
 * Valide et corrige un texte narrative en une seule opération
 *
 * @param text - Texte à valider
 * @param autoFix - Si true, corrige automatiquement les problèmes
 * @returns Texte validé (et corrigé si autoFix) + résultat lint
 */
export function validateAndFixNarrative(
  text: string,
  autoFix = true
): { text: string; lintResult: NarrativeLintResult } {
  const lintResult = lintNarrativeText(text);

  if (lintResult.isValid || !autoFix) {
    return { text, lintResult };
  }

  const fixedText = sanitizeNarrativeText(text);
  const finalLintResult = lintNarrativeText(fixedText);

  return { text: fixedText, lintResult: finalLintResult };
}

export default lintNarrativeText;
