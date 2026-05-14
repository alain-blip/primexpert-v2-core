/**
 * calculateResidenceQuality — LOT 6
 *
 * Calculateur de qualité pure function pour les dossiers résidence.
 * Analyse complétude, conflits, fraîcheur et génère des recommandations.
 */

import {
  QUALITY_RULES,
  CRITICALITY_WEIGHTS,
  SCORE_THRESHOLDS,
  FRESHNESS_THRESHOLDS,
  FieldRule,
  FieldCategory,
  CriticalityLevel,
  FIELD_CATEGORIES,
  RecommendationPriority,
  RecommendationAction,
} from './qualityRules';

// ============================================================
// TYPES
// ============================================================

export type QualityStatus = 'red' | 'yellow' | 'green';

export interface CategoryCompleteness {
  filled: number;
  total: number;
  missing: string[];
}

export interface Completeness {
  filled: number;
  total: number;
  percentage: number;
  missing: string[];
  byCategory: Record<FieldCategory, CategoryCompleteness>;
}

export interface Conflict {
  field: string;
  currentSource?: string;
  currentConfidence?: string;
  issue: 'manual_vs_official' | 'source_mismatch' | 'low_confidence' | 'stale';
  details: string;
  severity: 'high' | 'medium' | 'low';
}

export interface SourceFreshness {
  source: string;
  isRecognized: boolean;
  lastCheckedAt?: Date | null;
  stale: boolean;
  daysOld?: number;
}

export interface DocumentsFreshness {
  total: number;
  pending: number;
  failed: number;
  successful: number;
  lastIngestAt?: Date | null;
  stale: boolean;
  daysOld?: number;
}

export interface Freshness {
  sources: SourceFreshness[];
  documents: DocumentsFreshness;
  hasStaleData: boolean;
}

export interface Recommendation {
  priority: RecommendationPriority;
  action: RecommendationAction;
  label: string;
  fields?: string[];
  category?: FieldCategory;
  links?: {
    type: 'button';
    target: 'sync' | 'upload' | 'openTab';
    tabKey?: string;
  };
}

export interface QualityReport {
  score: number;
  status: QualityStatus;
  completeness: Completeness;
  criticalMissing: string[];
  conflicts: Conflict[];
  freshness: Freshness;
  recommendations: Recommendation[];
  computedAt: Date;
}

// Types pour les entrées
export interface FieldProvenance {
  [field: string]: {
    source?: string;
    confidence?: string;
    dateSource?: Date | { toDate: () => Date };
    lastUpdated?: Date | { toDate: () => Date };
  };
}

export interface SourceExterne {
  source: string;
  isRecognized?: boolean;
  lastCheckedAt?: Date | { toDate: () => Date };
  lastUpdatedAt?: Date | { toDate: () => Date };
  status?: string;
}

export interface DocumentSummary {
  total?: number;
  pending?: number;
  failed?: number;
  successful?: number;
  lastIngestAt?: Date | { toDate: () => Date };
}

export interface CalculateQualityInput {
  residence: Record<string, unknown>;
  fieldProvenance?: FieldProvenance;
  sourcesExternes?: SourceExterne[];
  documentsSummary?: DocumentSummary;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Convertit une date Firestore ou Date en Date
 */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Calcule le nombre de jours depuis une date
 */
function daysSince(date: Date | null): number | undefined {
  if (!date) return undefined;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Vérifie si une valeur est considérée comme "remplie"
 */
function isFieldFilled(value: unknown, rule: FieldRule): boolean {
  // Null/undefined = non rempli
  if (value === null || value === undefined) return false;

  // String vide = non rempli
  if (typeof value === 'string' && value.trim() === '') return false;

  // Pour les booléens avec acceptFalse
  if (rule.acceptFalse && typeof value === 'boolean') return true;

  // Pour les valeurs "unknown" acceptées
  if (rule.acceptUnknown) {
    if (value === 'unknown' || value === 'inconnu' || value === '—') return true;
  }

  // Arrays vides = non rempli
  if (Array.isArray(value) && value.length === 0) return false;

  // Objets vides = non rempli
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return false;

  // Nombre 0 peut être valide
  if (typeof value === 'number') return true;

  return true;
}

/**
 * Récupère la valeur d'un champ avec ses alternatives
 */
function getFieldValue(residence: Record<string, unknown>, rule: FieldRule): unknown {
  // Essayer la clé principale
  if (isFieldFilled(residence[rule.key], rule)) {
    return residence[rule.key];
  }

  // Essayer les alternatives
  if (rule.alternatives) {
    for (const alt of rule.alternatives) {
      if (isFieldFilled(residence[alt], rule)) {
        return residence[alt];
      }
    }
  }

  return undefined;
}

/**
 * Vérifie si une règle est satisfaite
 */
function isRuleSatisfied(residence: Record<string, unknown>, rule: FieldRule): boolean {
  const value = getFieldValue(residence, rule);
  return isFieldFilled(value, rule);
}

// ============================================================
// CALCUL COMPLÉTUDE
// ============================================================

function calculateCompleteness(residence: Record<string, unknown>): Completeness {
  const byCategory: Record<FieldCategory, CategoryCompleteness> = {} as Record<FieldCategory, CategoryCompleteness>;

  // Initialiser toutes les catégories
  for (const cat of Object.keys(FIELD_CATEGORIES) as FieldCategory[]) {
    byCategory[cat] = { filled: 0, total: 0, missing: [] };
  }

  let totalFilled = 0;
  let totalFields = 0;
  const allMissing: string[] = [];

  for (const rule of QUALITY_RULES) {
    totalFields++;
    byCategory[rule.category].total++;

    if (isRuleSatisfied(residence, rule)) {
      totalFilled++;
      byCategory[rule.category].filled++;
    } else {
      allMissing.push(rule.key);
      byCategory[rule.category].missing.push(rule.key);
    }
  }

  return {
    filled: totalFilled,
    total: totalFields,
    percentage: totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0,
    missing: allMissing,
    byCategory,
  };
}

// ============================================================
// CALCUL CHAMPS CRITIQUES MANQUANTS
// ============================================================

function calculateCriticalMissing(residence: Record<string, unknown>): string[] {
  const critical: string[] = [];

  for (const rule of QUALITY_RULES) {
    if (rule.criticality === 'CRITICAL' && !isRuleSatisfied(residence, rule)) {
      critical.push(rule.key);
    }
  }

  return critical;
}

// ============================================================
// DÉTECTION CONFLITS
// ============================================================

function detectConflicts(
  residence: Record<string, unknown>,
  fieldProvenance?: FieldProvenance,
  sourcesExternes?: SourceExterne[]
): Conflict[] {
  const conflicts: Conflict[] = [];

  if (!fieldProvenance) return conflicts;

  // Sources officielles connues
  const officialSources = ['MSSS', 'REQ', 'MAMH', 'CNESST'];

  for (const [field, prov] of Object.entries(fieldProvenance)) {
    const source = prov.source || '';
    const confidence = prov.confidence || '';

    // 1. Manual vs Official: si la source est Manual avec high confidence,
    //    mais qu'une source officielle existe avec une valeur différente
    if (source === 'Manual' && confidence === 'high') {
      // Vérifier si on a une source officielle pour ce champ
      const rule = QUALITY_RULES.find((r) => r.key === field);
      if (rule && sourcesExternes) {
        for (const ext of sourcesExternes) {
          if (officialSources.includes(ext.source) && ext.isRecognized) {
            // Potentiel conflit - la valeur manuelle pourrait différer de l'officielle
            conflicts.push({
              field,
              currentSource: source,
              currentConfidence: confidence,
              issue: 'manual_vs_official',
              details: `Valeur manuelle (high) vs source officielle ${ext.source} disponible`,
              severity: 'medium',
            });
            break;
          }
        }
      }
    }

    // 2. Low confidence warning
    if (confidence === 'low' || confidence === 'inferred') {
      conflicts.push({
        field,
        currentSource: source,
        currentConfidence: confidence,
        issue: 'low_confidence',
        details: `Confiance faible (${confidence}) - à valider`,
        severity: 'low',
      });
    }

    // 3. Stale provenance (date > 90 jours)
    const dateSource = toDate(prov.dateSource);
    const days = daysSince(dateSource);
    if (days !== undefined && days > 90) {
      conflicts.push({
        field,
        currentSource: source,
        currentConfidence: confidence,
        issue: 'stale',
        details: `Dernière mise à jour il y a ${days} jours`,
        severity: 'low',
      });
    }
  }

  return conflicts;
}

// ============================================================
// CALCUL FRAÎCHEUR
// ============================================================

function calculateFreshness(
  sourcesExternes?: SourceExterne[],
  documentsSummary?: DocumentSummary
): Freshness {
  const sources: SourceFreshness[] = [];
  let hasStaleData = false;

  // Analyser les sources externes
  const knownSources = ['MSSS', 'REQ', 'MAMH', 'CNESST'];

  if (sourcesExternes && sourcesExternes.length > 0) {
    for (const ext of sourcesExternes) {
      const lastCheckedAt = toDate(ext.lastCheckedAt);
      const daysOld = daysSince(lastCheckedAt);
      const stale = daysOld !== undefined && daysOld > FRESHNESS_THRESHOLDS.SOURCES_STALE_DAYS;

      if (stale) hasStaleData = true;

      sources.push({
        source: ext.source,
        isRecognized: ext.isRecognized ?? false,
        lastCheckedAt,
        stale,
        daysOld,
      });
    }
  } else {
    // Pas de sources => ajouter les sources connues comme non vérifiées
    for (const src of knownSources) {
      sources.push({
        source: src,
        isRecognized: false,
        lastCheckedAt: null,
        stale: true,
      });
      hasStaleData = true;
    }
  }

  // Analyser les documents
  const lastIngestAt = documentsSummary ? toDate(documentsSummary.lastIngestAt) : null;
  const docDaysOld = daysSince(lastIngestAt);
  const docsStale = docDaysOld !== undefined && docDaysOld > FRESHNESS_THRESHOLDS.DOCUMENTS_STALE_DAYS;

  if (docsStale) hasStaleData = true;

  const documents: DocumentsFreshness = {
    total: documentsSummary?.total ?? 0,
    pending: documentsSummary?.pending ?? 0,
    failed: documentsSummary?.failed ?? 0,
    successful: documentsSummary?.successful ?? 0,
    lastIngestAt,
    stale: docsStale,
    daysOld: docDaysOld,
  };

  return {
    sources,
    documents,
    hasStaleData,
  };
}

// ============================================================
// GÉNÉRATION RECOMMANDATIONS
// ============================================================

function generateRecommendations(
  completeness: Completeness,
  criticalMissing: string[],
  conflicts: Conflict[],
  freshness: Freshness
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // P0: Champs critiques manquants
  if (criticalMissing.length > 0) {
    // Grouper par catégorie
    const missingByCategory: Record<FieldCategory, string[]> = {} as Record<FieldCategory, string[]>;

    for (const field of criticalMissing) {
      const rule = QUALITY_RULES.find((r) => r.key === field);
      if (rule) {
        if (!missingByCategory[rule.category]) {
          missingByCategory[rule.category] = [];
        }
        missingByCategory[rule.category].push(field);
      }
    }

    for (const [category, fields] of Object.entries(missingByCategory) as [FieldCategory, string[]][]) {
      const catInfo = FIELD_CATEGORIES[category];
      recommendations.push({
        priority: 'P0',
        action: 'FILL_FIELD',
        label: `Compléter ${fields.length} champ(s) critique(s) dans "${catInfo.label}"`,
        fields,
        category,
        links: {
          type: 'button',
          target: 'openTab',
          tabKey: category === 'identity' || category === 'location' || category === 'legal'
            ? 'identite'
            : category === 'capacity' || category === 'building'
              ? 'capacite'
              : category === 'finance'
                ? 'finances'
                : 'synthese',
        },
      });
    }
  }

  // P0: Sources stale ou non synchronisées
  const staleSources = freshness.sources.filter((s) => s.stale || !s.isRecognized);
  if (staleSources.length > 0) {
    recommendations.push({
      priority: 'P0',
      action: 'SYNC_SOURCES',
      label: `Synchroniser ${staleSources.length} source(s) (${staleSources.map((s) => s.source).join(', ')})`,
      links: {
        type: 'button',
        target: 'sync',
      },
    });
  }

  // P1: Conflits à résoudre
  const highConflicts = conflicts.filter((c) => c.severity === 'high' || c.issue === 'manual_vs_official');
  if (highConflicts.length > 0) {
    recommendations.push({
      priority: 'P1',
      action: 'REVIEW_CONFLICT',
      label: `Valider ${highConflicts.length} conflit(s) de données`,
      fields: highConflicts.map((c) => c.field),
    });
  }

  // P1: Documents en échec ou en attente
  if (freshness.documents.failed > 0 || freshness.documents.pending > 0) {
    const total = freshness.documents.failed + freshness.documents.pending;
    recommendations.push({
      priority: 'P1',
      action: 'UPLOAD_DOCUMENT',
      label: `Traiter ${total} document(s) en attente ou en échec`,
      links: {
        type: 'button',
        target: 'upload',
      },
    });
  }

  // P2: Champs importants manquants
  const importantMissing = completeness.missing.filter((f) => {
    const rule = QUALITY_RULES.find((r) => r.key === f);
    return rule?.criticality === 'IMPORTANT';
  });

  if (importantMissing.length > 3) {
    recommendations.push({
      priority: 'P2',
      action: 'FILL_FIELD',
      label: `Compléter ${importantMissing.length} champ(s) importants pour améliorer le score`,
      fields: importantMissing.slice(0, 5),
    });
  }

  // P2: Low confidence conflicts
  const lowConfidenceConflicts = conflicts.filter((c) => c.issue === 'low_confidence');
  if (lowConfidenceConflicts.length > 3) {
    recommendations.push({
      priority: 'P2',
      action: 'REVIEW_CONFLICT',
      label: `Valider ${lowConfidenceConflicts.length} champ(s) à faible confiance`,
      fields: lowConfidenceConflicts.map((c) => c.field),
    });
  }

  // Trier par priorité
  return recommendations.sort((a, b) => {
    const priorityOrder: Record<RecommendationPriority, number> = { P0: 0, P1: 1, P2: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// ============================================================
// CALCUL SCORE
// ============================================================

function calculateScore(
  completeness: Completeness,
  criticalMissing: string[],
  conflicts: Conflict[]
): number {
  let score = 0;
  let maxScore = 0;

  // Score basé sur les règles pondérées
  for (const rule of QUALITY_RULES) {
    const weight = rule.weight * CRITICALITY_WEIGHTS[rule.criticality];
    maxScore += weight;

    if (!completeness.missing.includes(rule.key)) {
      score += weight;
    }
  }

  // Score de base (0-100)
  let baseScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  // Pénalités
  // -5 points par champ critique manquant au-delà du premier
  const criticalPenalty = Math.max(0, (criticalMissing.length - 1) * 5);

  // -2 points par conflit high severity
  const highConflicts = conflicts.filter((c) => c.severity === 'high');
  const conflictPenalty = highConflicts.length * 2;

  const finalScore = Math.max(0, baseScore - criticalPenalty - conflictPenalty);

  return Math.min(100, finalScore);
}

/**
 * Détermine le statut basé sur le score et les critiques manquants
 */
function determineStatus(score: number, criticalMissing: string[]): QualityStatus {
  // Plus de 2 critiques manquants = RED
  if (criticalMissing.length > 2) return 'red';

  // Score >= 85 et pas de critique manquant = GREEN
  if (score >= SCORE_THRESHOLDS.GREEN && criticalMissing.length === 0) return 'green';

  // Score >= 60 ou 1-2 critiques = YELLOW
  if (score >= SCORE_THRESHOLDS.YELLOW) return 'yellow';

  // Sinon RED
  return 'red';
}

// ============================================================
// FONCTION PRINCIPALE
// ============================================================

/**
 * Calcule le rapport de qualité complet pour une résidence.
 *
 * @param input - Les données de la résidence et ses métadonnées
 * @returns QualityReport - Le rapport de qualité complet
 */
export function calculateResidenceQuality(input: CalculateQualityInput): QualityReport {
  const { residence, fieldProvenance, sourcesExternes, documentsSummary } = input;

  // 1. Calculer la complétude
  const completeness = calculateCompleteness(residence);

  // 2. Identifier les champs critiques manquants
  const criticalMissing = calculateCriticalMissing(residence);

  // 3. Détecter les conflits
  const conflicts = detectConflicts(residence, fieldProvenance, sourcesExternes);

  // 4. Calculer la fraîcheur
  const freshness = calculateFreshness(sourcesExternes, documentsSummary);

  // 5. Calculer le score
  const score = calculateScore(completeness, criticalMissing, conflicts);

  // 6. Déterminer le statut
  const status = determineStatus(score, criticalMissing);

  // 7. Générer les recommandations
  const recommendations = generateRecommendations(
    completeness,
    criticalMissing,
    conflicts,
    freshness
  );

  return {
    score,
    status,
    completeness,
    criticalMissing,
    conflicts,
    freshness,
    recommendations,
    computedAt: new Date(),
  };
}

/**
 * Crée un snapshot simplifié pour la persistance Firestore
 */
export function createQualitySnapshot(report: QualityReport): {
  score: number;
  status: QualityStatus;
  computedAt: Date;
  criticalMissingCount: number;
  conflictsCount: number;
  staleSourcesCount: number;
  completenessPercentage: number;
} {
  return {
    score: report.score,
    status: report.status,
    computedAt: report.computedAt,
    criticalMissingCount: report.criticalMissing.length,
    conflictsCount: report.conflicts.length,
    staleSourcesCount: report.freshness.sources.filter((s) => s.stale).length,
    completenessPercentage: report.completeness.percentage,
  };
}

export default calculateResidenceQuality;
