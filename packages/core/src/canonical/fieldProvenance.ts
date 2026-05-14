/**
 * Gestion de la provenance des champs
 *
 * Mission 3 — Champs canoniques & Alias Mapper
 *
 * Ce module gère la traçabilité des données:
 * - D'où vient la donnée (source)
 * - Quand a-t-elle été obtenue
 * - Quel est son niveau de confiance
 */

import type {
  FieldSource,
  FieldConfidence,
  FieldProvenance,
  FieldProvenanceMap,
} from './types';

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Priorité des sources (pour résolution de conflits)
 * Plus le nombre est élevé, plus la source est prioritaire
 */
export const SOURCE_PRIORITY: Record<FieldSource, number> = {
  Manual: 100,      // Saisie manuelle = plus prioritaire
  RegistreRPA: 90,  // Source officielle
  REQ: 85,          // Source officielle
  PDF: 70,          // Extraction document
  Sync: 60,         // Synchronisation
  Import: 50,       // Import batch
  Unknown: 0,       // Source inconnue
};

/**
 * Confiance par défaut selon la source
 */
export const DEFAULT_CONFIDENCE: Record<FieldSource, FieldConfidence> = {
  Manual: 'high',
  RegistreRPA: 'high',
  REQ: 'high',
  PDF: 'medium',
  Sync: 'medium',
  Import: 'low',
  Unknown: 'low',
};

// ============================================================================
// CRÉATION DE PROVENANCE
// ============================================================================

/**
 * Crée une provenance pour une source RegistreRPA (MSSS)
 */
export function createRegistreRPAProvenance(
  dateSource?: string,
  notes?: string
): FieldProvenance {
  return {
    source: 'RegistreRPA',
    dateSource: dateSource || new Date().toISOString(),
    confidence: 'high',
    notes,
  };
}

/**
 * Crée une provenance pour une source REQ
 */
export function createREQProvenance(
  dateSource?: string,
  notes?: string
): FieldProvenance {
  return {
    source: 'REQ',
    dateSource: dateSource || new Date().toISOString(),
    confidence: 'high',
    notes,
  };
}

/**
 * Crée une provenance pour une extraction PDF
 */
export function createPDFProvenance(
  documentName?: string,
  confidence: FieldConfidence = 'medium'
): FieldProvenance {
  return {
    source: 'PDF',
    dateSource: new Date().toISOString(),
    confidence,
    notes: documentName ? `Extrait de: ${documentName}` : undefined,
  };
}

/**
 * Crée une provenance pour une saisie manuelle
 */
export function createManualProvenance(
  userId?: string,
  notes?: string
): FieldProvenance {
  return {
    source: 'Manual',
    dateSource: new Date().toISOString(),
    confidence: 'high',
    modifiedBy: userId,
    notes,
  };
}

/**
 * Crée une provenance pour un import
 */
export function createImportProvenance(
  importSource?: string,
  confidence: FieldConfidence = 'low'
): FieldProvenance {
  return {
    source: 'Import',
    dateSource: new Date().toISOString(),
    confidence,
    notes: importSource,
  };
}

/**
 * Crée une provenance pour une synchronisation
 */
export function createSyncProvenance(
  syncSource?: string
): FieldProvenance {
  return {
    source: 'Sync',
    dateSource: new Date().toISOString(),
    confidence: 'medium',
    notes: syncSource,
  };
}

// ============================================================================
// COMPARAISON ET RÉSOLUTION
// ============================================================================

/**
 * Compare deux provenances et retourne la plus prioritaire
 *
 * Règles de priorité:
 * 1. Confiance (high > medium > low)
 * 2. Priorité de la source (voir SOURCE_PRIORITY)
 * 3. Date la plus récente
 */
export function compareProvenance(a: FieldProvenance, b: FieldProvenance): number {
  // 1. Comparer la confiance
  const confidenceOrder: Record<FieldConfidence, number> = { high: 3, medium: 2, low: 1 };
  const confidenceDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
  if (confidenceDiff !== 0) return confidenceDiff;

  // 2. Comparer la priorité de source
  const sourceDiff = SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source];
  if (sourceDiff !== 0) return sourceDiff;

  // 3. Comparer les dates (plus récent = prioritaire)
  const dateA = new Date(a.dateSource).getTime();
  const dateB = new Date(b.dateSource).getTime();
  return dateA - dateB;
}

/**
 * Détermine si une nouvelle provenance doit remplacer l'existante
 */
export function shouldOverwrite(
  existing: FieldProvenance | undefined,
  incoming: FieldProvenance
): boolean {
  if (!existing) return true;
  return compareProvenance(incoming, existing) >= 0;
}

/**
 * Fusionne deux maps de provenance
 * Garde la provenance la plus prioritaire pour chaque champ
 */
export function mergeProvenanceMaps(
  existing: FieldProvenanceMap | undefined,
  incoming: FieldProvenanceMap
): FieldProvenanceMap {
  const result: FieldProvenanceMap = { ...existing };

  for (const [field, provenance] of Object.entries(incoming)) {
    if (shouldOverwrite(result[field], provenance)) {
      result[field] = provenance;
    }
  }

  return result;
}

// ============================================================================
// ANALYSE DE PROVENANCE
// ============================================================================

/**
 * Obtient un résumé de la provenance pour une résidence
 */
export function getProvenanceSummary(
  provenanceMap: FieldProvenanceMap | undefined
): {
  totalFields: number;
  bySource: Record<FieldSource, number>;
  byConfidence: Record<FieldConfidence, number>;
  averageAge: number; // en jours
} {
  const summary = {
    totalFields: 0,
    bySource: {} as Record<FieldSource, number>,
    byConfidence: {} as Record<FieldConfidence, number>,
    averageAge: 0,
  };

  if (!provenanceMap) return summary;

  const now = Date.now();
  let totalAge = 0;

  for (const provenance of Object.values(provenanceMap)) {
    summary.totalFields++;

    // Compter par source
    summary.bySource[provenance.source] = (summary.bySource[provenance.source] || 0) + 1;

    // Compter par confiance
    summary.byConfidence[provenance.confidence] = (summary.byConfidence[provenance.confidence] || 0) + 1;

    // Calculer l'âge
    const age = now - new Date(provenance.dateSource).getTime();
    totalAge += age;
  }

  if (summary.totalFields > 0) {
    summary.averageAge = Math.round(totalAge / summary.totalFields / (1000 * 60 * 60 * 24)); // en jours
  }

  return summary;
}

/**
 * Identifie les champs avec une provenance faible (potentiellement à mettre à jour)
 */
export function getWeakProvenanceFields(
  provenanceMap: FieldProvenanceMap | undefined,
  options?: {
    maxAge?: number; // en jours
    minConfidence?: FieldConfidence;
  }
): string[] {
  if (!provenanceMap) return [];

  const weakFields: string[] = [];
  const now = Date.now();
  const maxAgeMs = (options?.maxAge || 365) * 24 * 60 * 60 * 1000;
  const minConfidenceLevel = options?.minConfidence || 'medium';
  const confidenceOrder: Record<FieldConfidence, number> = { high: 3, medium: 2, low: 1 };
  const minLevel = confidenceOrder[minConfidenceLevel];

  for (const [field, provenance] of Object.entries(provenanceMap)) {
    const isOld = now - new Date(provenance.dateSource).getTime() > maxAgeMs;
    const isLowConfidence = confidenceOrder[provenance.confidence] < minLevel;

    if (isOld || isLowConfidence) {
      weakFields.push(field);
    }
  }

  return weakFields;
}

/**
 * Génère un rapport lisible de la provenance
 */
export function formatProvenanceReport(
  provenanceMap: FieldProvenanceMap | undefined
): string[] {
  if (!provenanceMap || Object.keys(provenanceMap).length === 0) {
    return ['Aucune provenance enregistrée'];
  }

  const lines: string[] = [];
  const summary = getProvenanceSummary(provenanceMap);

  lines.push(`📊 ${summary.totalFields} champs avec provenance`);
  lines.push('');

  // Par source
  lines.push('Par source:');
  for (const [source, count] of Object.entries(summary.bySource)) {
    lines.push(`  ${source}: ${count}`);
  }
  lines.push('');

  // Par confiance
  lines.push('Par niveau de confiance:');
  for (const [confidence, count] of Object.entries(summary.byConfidence)) {
    const icon = confidence === 'high' ? '✓' : confidence === 'medium' ? '~' : '?';
    lines.push(`  ${icon} ${confidence}: ${count}`);
  }
  lines.push('');

  lines.push(`Âge moyen des données: ${summary.averageAge} jours`);

  return lines;
}

// ============================================================================
// UTILITAIRES FIRESTORE
// ============================================================================

/**
 * Prépare un objet de provenance pour écriture Firestore
 * (convertit en format compatible)
 */
export function prepareProvenanceForFirestore(
  provenanceMap: FieldProvenanceMap
): Record<string, FieldProvenance> {
  // Firestore accepte les objets imbriqués, donc on retourne tel quel
  return provenanceMap;
}

/**
 * Crée un patch Firestore qui inclut la provenance
 *
 * @example
 * ```ts
 * const patch = createProvenancePatch(
 *   { name: 'Ma RPA', nombreUnitesTotal: 50 },
 *   createManualProvenance(userId)
 * );
 *
 * // Résultat:
 * // {
 * //   name: 'Ma RPA',
 * //   nombreUnitesTotal: 50,
 * //   'fieldProvenance.name': { source: 'Manual', ... },
 * //   'fieldProvenance.nombreUnitesTotal': { source: 'Manual', ... }
 * // }
 * ```
 */
export function createProvenancePatch(
  fields: Record<string, unknown>,
  provenance: FieldProvenance
): Record<string, unknown> {
  const patch: Record<string, unknown> = { ...fields };

  for (const field of Object.keys(fields)) {
    patch[`fieldProvenance.${field}`] = provenance;
  }

  return patch;
}
