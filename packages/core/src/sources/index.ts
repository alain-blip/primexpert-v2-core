/**
 * Module Sources Externes
 *
 * Normalisation des sources externes (MSSS, REQ, Site web)
 * pour les résidences.
 *
 * @module domain/sources
 */

// Types
export type {
  SourcesExternes,
  SourceRegistreRPA,
  SourceREQ,
  SourceSiteWeb,
  SourceType,
  SourceDetectionResult,
} from './types';

// Fonction principale
export {
  buildSourcesExternesFromResidence,
  type ResidenceSourceFields,
} from './buildSourcesExternes';

// Utilitaires de détection
export {
  isMSSSUrl,
  extractNumeroFromMSSSUrl,
  isValidNumeroRegistre,
  isValidNEQ,
  normalizeNEQ,
  buildREQUrl,
  isValidUrl,
  normalizeUrl,
} from './buildSourcesExternes';

// Utilitaires de résumé
export {
  hasSourcesExternes,
  countRecognizedSources,
  getSourcesSummary,
} from './buildSourcesExternes';
