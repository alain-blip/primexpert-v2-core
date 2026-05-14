/**
 * Types pour le système de champs canoniques
 *
 * Mission 3 — Champs canoniques & Alias Mapper
 */

// ============================================================================
// SOURCES DE DONNÉES
// ============================================================================

/**
 * Sources possibles pour les données d'une résidence
 */
export type FieldSource =
  | 'RegistreRPA'  // MSSS / Registre des RPA
  | 'REQ'          // Registraire des entreprises du Québec
  | 'PDF'          // Extraction de document PDF
  | 'Manual'       // Saisie manuelle utilisateur
  | 'Import'       // Import batch / migration
  | 'Sync'         // Synchronisation automatique
  | 'Unknown';     // Source inconnue (legacy)

/**
 * Niveau de confiance de la donnée
 */
export type FieldConfidence = 'high' | 'medium' | 'low';

/**
 * Provenance d'un champ
 */
export interface FieldProvenance {
  /** Source de la donnée */
  source: FieldSource;
  /** Date de la source (ISO string) */
  dateSource: string;
  /** Niveau de confiance */
  confidence: FieldConfidence;
  /** Utilisateur ayant modifié (si Manual) */
  modifiedBy?: string;
  /** Notes sur la provenance */
  notes?: string;
}

/**
 * Map de provenance pour tous les champs
 */
export type FieldProvenanceMap = Record<string, FieldProvenance>;

// ============================================================================
// CATÉGORIES DE CHAMPS
// ============================================================================

/**
 * Catégories de champs canoniques
 */
export type FieldCategory =
  | 'identity'      // Identification de la résidence
  | 'location'      // Localisation et adresse
  | 'legal'         // Structure juridique
  | 'capacity'      // Capacité et unités
  | 'building'      // Bâtiment et immobilier
  | 'safety'        // Sécurité
  | 'finance'       // Finances
  | 'accounting'    // Comptabilité / Amortissements / BAIIA
  | 'operations'    // Opérations
  | 'transaction';  // Transaction

// ============================================================================
// DÉFINITION D'UN CHAMP CANONIQUE
// ============================================================================

/**
 * Définition complète d'un champ canonique
 */
export interface CanonicalFieldDefinition {
  /** Nom canonique du champ */
  canonical: string;
  /** Alias (noms alternatifs) - dans l'ordre de priorité */
  aliases: string[];
  /** Catégorie du champ */
  category: FieldCategory;
  /** Type de donnée */
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  /** Description du champ */
  description: string;
  /** Champ requis? */
  required?: boolean;
  /** Valeur par défaut */
  defaultValue?: unknown;
}

// ============================================================================
// RÉSIDENCE AVEC PROVENANCE
// ============================================================================

/**
 * Extension du type Residence avec provenance
 */
export interface ResidenceWithProvenance {
  /** ID du document Firestore */
  id?: string;
  /** Champs de la résidence (clé: valeur) */
  [key: string]: unknown;
  /** Provenance des champs */
  fieldProvenance?: FieldProvenanceMap;
}

// ============================================================================
// MISE À JOUR CANONIQUE
// ============================================================================

/**
 * Métadonnées pour une mise à jour canonique
 */
export interface CanonicalUpdateMeta {
  /** Source de la mise à jour */
  source: FieldSource;
  /** Niveau de confiance */
  confidence: FieldConfidence;
  /** Utilisateur (si Manual) */
  userId?: string;
  /** Notes */
  notes?: string;
  /** Écraser même si confiance inférieure? */
  forceOverwrite?: boolean;
}

/**
 * Résultat d'une mise à jour canonique
 */
export interface CanonicalUpdateResult {
  /** Succès de l'opération */
  success: boolean;
  /** Champs mis à jour */
  updatedFields: string[];
  /** Champs ignorés (confiance inférieure) */
  skippedFields: string[];
  /** Erreurs éventuelles */
  errors?: Record<string, string>;
}
