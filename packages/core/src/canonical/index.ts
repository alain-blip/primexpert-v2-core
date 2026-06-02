/**
 * Module Canonical Fields
 *
 * Gestion des champs canoniques, alias, et provenance
 * pour les données de résidences.
 *
 * @module domain/canonical
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  FieldSource,
  FieldConfidence,
  FieldProvenance,
  FieldProvenanceMap,
  FieldCategory,
  CanonicalFieldDefinition,
  ResidenceWithProvenance,
  CanonicalUpdateMeta,
  CanonicalUpdateResult,
} from './types';

// ============================================================================
// CONTEXTE DE PROPRIÉTÉ (SSOT quad-contexte v3.5)
// ============================================================================

export type { PropertyContext, LegacyAssetNiche } from './propertyContext';

export {
  PROPERTY_CONTEXTS,
  DEFAULT_PROPERTY_CONTEXT,
  PROPERTY_CONTEXT_LABELS,
  PROPERTY_CONTEXT_SELECTOR_LABELS,
  isPropertyContext,
  parsePropertyContext,
  assetNicheToPropertyContext,
  propertyContextToAssetNiche,
  propertyContextUsesRpaModel,
  propertyContextLabel,
  propertyContextSelectorLabel,
  resolveResidencePropertyContext,
} from './propertyContext';

// ============================================================================
// ALIAS ET DÉFINITIONS
// ============================================================================

export {
  // Groupes de champs
  IDENTITY_FIELDS,
  LOCATION_FIELDS,
  LEGAL_FIELDS,
  CAPACITY_FIELDS,
  BUILDING_FIELDS,
  SAFETY_FIELDS,
  FINANCE_FIELDS,
  TRANSACTION_FIELDS,
  ALL_CANONICAL_FIELDS,

  // Maps de lookup
  ALIAS_TO_CANONICAL,
  CANONICAL_DEFINITIONS,

  // Helpers alias
  getCanonicalName,
  isCanonicalName,
  isKnownField,
  getFieldDefinition,
  getAllFieldNames,
  getFieldsByCategory,
  getRequiredFields,
} from './fieldAliases';

// ============================================================================
// HELPERS DE LECTURE/ÉCRITURE
// ============================================================================

export {
  // Lecture
  getResidenceField,
  getResidenceFields,
  hasResidenceField,

  // Écriture
  prepareCanonicalPatch,
  prepareCanonicalPatchWithAliases,

  // Mise à jour avec provenance
  createFieldProvenance,
  compareConfidence,
  prepareCanonicalUpdate,

  // Validation
  validateRequiredFields,
  coerceFieldValue,

  // Utilitaires
  extractCanonicalFields,
  getFieldCoverageReport,
} from './canonicalHelpers';

// ============================================================================
// PROVENANCE
// ============================================================================

export {
  // Constantes
  SOURCE_PRIORITY,
  DEFAULT_CONFIDENCE,

  // Création de provenance
  createRegistreRPAProvenance,
  createREQProvenance,
  createPDFProvenance,
  createManualProvenance,
  createImportProvenance,
  createSyncProvenance,

  // Comparaison
  compareProvenance,
  shouldOverwrite,
  mergeProvenanceMaps,

  // Analyse
  getProvenanceSummary,
  getWeakProvenanceFields,
  formatProvenanceReport,

  // Firestore
  prepareProvenanceForFirestore,
  createProvenancePatch,
} from './fieldProvenance';
