/**
 * Helpers pour la lecture et l'écriture de champs canoniques
 *
 * Mission 3 — Champs canoniques & Alias Mapper
 *
 * Ces fonctions garantissent une lecture/écriture cohérente
 * des champs en respectant le schéma canonique.
 */

import type {
  FieldSource,
  FieldConfidence,
  FieldProvenance,
  FieldProvenanceMap,
  CanonicalUpdateMeta,
  CanonicalUpdateResult,
} from './types';

import {
  getCanonicalName,
  getAllFieldNames,
  CANONICAL_DEFINITIONS,
  type CanonicalFieldDefinition,
} from './fieldAliases';

// ============================================================================
// LECTURE DE CHAMPS
// ============================================================================

/**
 * Lit la valeur d'un champ canonique depuis un objet résidence
 *
 * Cherche d'abord le nom canonique, puis les alias dans l'ordre de priorité.
 *
 * @param residence - Objet résidence (ou tout objet avec des champs)
 * @param canonicalKey - Nom canonique du champ
 * @returns La valeur du champ ou undefined
 *
 * @example
 * ```ts
 * const residence = { nomResidence: 'Ma RPA', unitsCount: 50 };
 *
 * getResidenceField(residence, 'name');           // 'Ma RPA'
 * getResidenceField(residence, 'nombreUnitesTotal'); // 50
 * ```
 */
export function getResidenceField<T = unknown>(
  residence: Record<string, unknown> | null | undefined,
  canonicalKey: string
): T | undefined {
  if (!residence) return undefined;

  // Obtenir la définition du champ canonique
  const definition = CANONICAL_DEFINITIONS[canonicalKey];
  if (!definition) {
    // Si ce n'est pas un champ canonique connu, essayer de lire directement
    return residence[canonicalKey] as T | undefined;
  }

  // Chercher dans l'ordre: canonical, puis alias
  const allNames = [definition.canonical, ...definition.aliases];

  for (const fieldName of allNames) {
    const value = residence[fieldName];
    if (value !== undefined && value !== null && value !== '') {
      return value as T;
    }
  }

  // Retourner la valeur par défaut si définie
  return definition.defaultValue as T | undefined;
}

/**
 * Lit plusieurs champs canoniques d'un coup
 *
 * @param residence - Objet résidence
 * @param canonicalKeys - Liste des noms canoniques
 * @returns Objet avec les valeurs
 */
export function getResidenceFields<T extends Record<string, unknown>>(
  residence: Record<string, unknown> | null | undefined,
  canonicalKeys: string[]
): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const key of canonicalKeys) {
    const value = getResidenceField(residence, key);
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result as Partial<T>;
}

/**
 * Vérifie si un champ canonique a une valeur dans la résidence
 */
export function hasResidenceField(
  residence: Record<string, unknown> | null | undefined,
  canonicalKey: string
): boolean {
  const value = getResidenceField(residence, canonicalKey);
  return value !== undefined && value !== null && value !== '';
}

// ============================================================================
// ÉCRITURE DE CHAMPS
// ============================================================================

/**
 * Prépare un patch pour mise à jour canonique
 *
 * Transforme un objet avec des noms canoniques en un patch
 * qui écrit UNIQUEMENT dans les champs canoniques.
 *
 * @param patch - Objet avec clés canoniques et valeurs
 * @returns Objet prêt pour updateDoc
 */
export function prepareCanonicalPatch(
  patch: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(patch)) {
    const canonicalName = getCanonicalName(key);

    if (canonicalName) {
      // Utiliser le nom canonique
      result[canonicalName] = value;
    } else {
      // Champ non canonique, garder tel quel
      result[key] = value;
    }
  }

  return result;
}

/**
 * Prépare un patch de migration qui écrit dans le canonique
 * ET maintient les alias pour backward compatibility
 *
 * @param patch - Objet avec clés canoniques et valeurs
 * @param writeAliases - Écrire aussi dans les alias (pour migration)
 */
export function prepareCanonicalPatchWithAliases(
  patch: Record<string, unknown>,
  writeAliases = false
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(patch)) {
    const canonicalName = getCanonicalName(key);

    if (canonicalName) {
      // Toujours écrire dans le canonique
      result[canonicalName] = value;

      // Optionnellement écrire dans les alias
      if (writeAliases) {
        const allNames = getAllFieldNames(canonicalName);
        for (const alias of allNames) {
          if (alias !== canonicalName) {
            result[alias] = value;
          }
        }
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ============================================================================
// GESTION DE LA PROVENANCE
// ============================================================================

/**
 * Crée un objet de provenance pour un champ
 */
export function createFieldProvenance(
  source: FieldSource,
  confidence: FieldConfidence,
  options?: {
    modifiedBy?: string;
    notes?: string;
    dateSource?: string;
  }
): FieldProvenance {
  return {
    source,
    dateSource: options?.dateSource || new Date().toISOString(),
    confidence,
    modifiedBy: options?.modifiedBy,
    notes: options?.notes,
  };
}

/**
 * Compare deux niveaux de confiance
 * @returns 1 si a > b, -1 si a < b, 0 si égaux
 */
export function compareConfidence(a: FieldConfidence, b: FieldConfidence): number {
  const order: Record<FieldConfidence, number> = { high: 3, medium: 2, low: 1 };
  return order[a] - order[b];
}

/**
 * Prépare une mise à jour canonique avec provenance
 *
 * @param patch - Champs à mettre à jour (clés canoniques)
 * @param meta - Métadonnées de la mise à jour
 * @param existingProvenance - Provenance existante (pour comparaison de confiance)
 */
export function prepareCanonicalUpdate(
  patch: Record<string, unknown>,
  meta: CanonicalUpdateMeta,
  existingProvenance?: FieldProvenanceMap
): { updates: Record<string, unknown>; provenance: FieldProvenanceMap; result: CanonicalUpdateResult } {
  const updates: Record<string, unknown> = {};
  const provenance: FieldProvenanceMap = {};
  const result: CanonicalUpdateResult = {
    success: true,
    updatedFields: [],
    skippedFields: [],
  };

  const newProvenance = createFieldProvenance(meta.source, meta.confidence, {
    modifiedBy: meta.userId,
    notes: meta.notes,
  });

  for (const [key, value] of Object.entries(patch)) {
    const canonicalName = getCanonicalName(key) || key;

    // Vérifier si on doit écraser (selon la confiance)
    const existingFieldProvenance = existingProvenance?.[canonicalName];

    if (existingFieldProvenance && !meta.forceOverwrite) {
      const comparison = compareConfidence(meta.confidence, existingFieldProvenance.confidence);

      if (comparison < 0) {
        // Confiance inférieure, on skip
        result.skippedFields.push(canonicalName);
        continue;
      }
    }

    // Écrire la mise à jour
    updates[canonicalName] = value;
    provenance[canonicalName] = newProvenance;
    result.updatedFields.push(canonicalName);
  }

  return { updates, provenance, result };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Valide qu'un objet contient les champs requis
 */
export function validateRequiredFields(
  residence: Record<string, unknown>,
  requiredFields?: string[]
): { valid: boolean; missing: string[] } {
  const fieldsToCheck = requiredFields || Object.keys(CANONICAL_DEFINITIONS).filter(
    (k) => CANONICAL_DEFINITIONS[k].required
  );

  const missing: string[] = [];

  for (const field of fieldsToCheck) {
    if (!hasResidenceField(residence, field)) {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Convertit une valeur selon le type défini
 */
export function coerceFieldValue(
  value: unknown,
  definition: CanonicalFieldDefinition
): unknown {
  if (value === undefined || value === null || value === '') {
    return definition.defaultValue;
  }

  switch (definition.type) {
    case 'number':
      const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : Number(value);
      return isNaN(num) ? definition.defaultValue : num;

    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'oui';
      }
      return Boolean(value);

    case 'string':
      return String(value).trim();

    case 'date':
      // Garder tel quel (string ISO ou Timestamp Firestore)
      return value;

    case 'array':
      return Array.isArray(value) ? value : [value];

    case 'object':
      return value;

    default:
      return value;
  }
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Extrait tous les champs canoniques d'une résidence
 * (normalise les alias vers les noms canoniques)
 */
export function extractCanonicalFields(
  residence: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const canonicalName of Object.keys(CANONICAL_DEFINITIONS)) {
    const value = getResidenceField(residence, canonicalName);
    if (value !== undefined) {
      result[canonicalName] = value;
    }
  }

  return result;
}

/**
 * Génère un rapport de couverture des champs canoniques
 */
export function getFieldCoverageReport(
  residence: Record<string, unknown>
): {
  total: number;
  filled: number;
  missing: string[];
  coverage: number;
} {
  const allFields = Object.keys(CANONICAL_DEFINITIONS);
  const missing: string[] = [];

  for (const field of allFields) {
    if (!hasResidenceField(residence, field)) {
      missing.push(field);
    }
  }

  const filled = allFields.length - missing.length;

  return {
    total: allFields.length,
    filled,
    missing,
    coverage: Math.round((filled / allFields.length) * 100),
  };
}
