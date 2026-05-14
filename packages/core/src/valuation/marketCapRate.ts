/**
 * Module Market Cap Rate
 *
 * Gère la sélection du TGA de marché à partir des comparables ou du profil.
 * Sépare clairement:
 * - TGA de marché retenu (capRateMarketSelected) = issu des comparables ou profil
 * - TGA implicite au prix demandé (capRateImpliedAtAsking) = NOI / askingPrice
 *
 * @author Copilote IA - RPAaVendre.com
 * @version 1.0.0
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Échantillon de TGA comparable (transaction validée)
 */
export interface ComparableCapRateSample {
  /** Identifiant unique de la transaction */
  id: string;
  /** Prix de vente final */
  salePrice: number;
  /** Revenu net d'exploitation (NOI) */
  noi: number;
  /** Taux de capitalisation calculé (noi / salePrice) ou fourni */
  capRate: number;
  /** Tags optionnels pour filtrage (région, type, taille) */
  tags?: string[];
  /** Date de la transaction (pour pondération temporelle) */
  transactionDate?: Date;
}

/**
 * Résultat de la sélection du TGA de marché
 */
export interface MarketCapRateResult {
  /** TGA de marché retenu (final) */
  capRateMarketSelected: number;
  /** Moyenne des TGA comparables (si disponible) */
  capRateComparableAvg?: number;
  /** Médiane des TGA comparables (si disponible) */
  capRateComparableMedian?: number;
  /** Minimum des TGA comparables (si disponible) */
  capRateComparableMin?: number;
  /** Maximum des TGA comparables (si disponible) */
  capRateComparableMax?: number;
  /** Nombre d'échantillons utilisés */
  sampleCount: number;
  /** Source de la sélection */
  source: 'COMPARABLES' | 'PROFILE_FALLBACK';
  /** Notes explicatives */
  notes?: string[];
}

/**
 * Paramètres d'entrée pour la sélection du TGA de marché
 */
export interface SelectMarketCapRateParams {
  /** TGA cible du profil (fallback si pas assez de comparables) */
  profileCapRate: number;
  /** Liste des comparables (optionnel) */
  comparables?: ComparableCapRateSample[];
  /** Ajustement risque en points de base (ex: 25 = +0.25%) */
  riskAdjBps?: number;
  /** Nombre minimum de comparables requis (défaut: 3) */
  minComparables?: number;
}

// ============================================================================
// FONCTIONS UTILITAIRES STATISTIQUES
// ============================================================================

/**
 * Calcule les statistiques descriptives d'un ensemble de valeurs
 *
 * @param samples - Tableau de nombres
 * @returns Statistiques (moyenne, médiane, min, max)
 */
export function computeStats(samples: number[]): {
  avg: number;
  median: number;
  min: number;
  max: number;
} {
  if (samples.length === 0) {
    return { avg: 0, median: 0, min: 0, max: 0 };
  }

  // Moyenne
  const sum = samples.reduce((acc, val) => acc + val, 0);
  const avg = sum / samples.length;

  // Médiane (tri puis milieu)
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  // Min et Max
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  return { avg, median, min, max };
}

/**
 * Limite une valeur entre un minimum et un maximum
 *
 * @param value - Valeur à limiter
 * @param min - Minimum
 * @param max - Maximum
 * @returns Valeur limitée
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Sélectionne le TGA de marché approprié
 *
 * Règles de sélection:
 * 1. Si comparables >= minComparables (défaut 3):
 *    - Calcule les statistiques (avg, median, min, max)
 *    - TGA retenu = médiane + ajustement risque (riskAdjBps)
 *    - TGA retenu est limité entre min et max des comparables
 *    - Source = "COMPARABLES"
 *
 * 2. Sinon (fallback):
 *    - TGA retenu = TGA du profil (profileCapRate)
 *    - Source = "PROFILE_FALLBACK"
 *
 * @param params - Paramètres d'entrée
 * @returns Résultat de la sélection du TGA de marché
 *
 * @example
 * ```typescript
 * const result = selectMarketCapRate({
 *   profileCapRate: 0.085,
 *   comparables: [
 *     { id: '1', salePrice: 5000000, noi: 400000, capRate: 0.08 },
 *     { id: '2', salePrice: 4500000, noi: 351000, capRate: 0.078 },
 *     { id: '3', salePrice: 5200000, noi: 390000, capRate: 0.075 },
 *   ],
 *   riskAdjBps: 25, // +0.25%
 * });
 * // result.capRateMarketSelected ≈ 0.0805 (médiane 0.078 + 0.0025)
 * // result.source = "COMPARABLES"
 * ```
 */
export function selectMarketCapRate(params: SelectMarketCapRateParams): MarketCapRateResult {
  const {
    profileCapRate,
    comparables = [],
    riskAdjBps = 0,
    minComparables = 3,
  } = params;

  const notes: string[] = [];

  // Filtrer les comparables valides (cap rate > 0)
  const validComparables = comparables.filter(
    c => c.capRate > 0 && c.salePrice > 0 && c.noi > 0
  );

  // Cas 1: Suffisamment de comparables
  if (validComparables.length >= minComparables) {
    const capRates = validComparables.map(c => c.capRate);
    const stats = computeStats(capRates);

    // Ajustement risque en décimal (bps -> décimal)
    const riskAdj = riskAdjBps / 10000;

    // TGA retenu = médiane + ajustement, limité entre min et max
    const rawSelected = stats.median + riskAdj;
    const capRateMarketSelected = clamp(rawSelected, stats.min, stats.max);

    // Arrondir à 4 décimales
    const round4 = (v: number) => Math.round(v * 10000) / 10000;

    if (riskAdjBps !== 0) {
      notes.push(`Ajustement risque appliqué: ${riskAdjBps >= 0 ? '+' : ''}${riskAdjBps} bps`);
    }
    notes.push(`Basé sur ${validComparables.length} transactions comparables`);

    return {
      capRateMarketSelected: round4(capRateMarketSelected),
      capRateComparableAvg: round4(stats.avg),
      capRateComparableMedian: round4(stats.median),
      capRateComparableMin: round4(stats.min),
      capRateComparableMax: round4(stats.max),
      sampleCount: validComparables.length,
      source: 'COMPARABLES',
      notes,
    };
  }

  // Cas 2: Fallback sur le profil
  notes.push(
    `Comparables insuffisants (${validComparables.length} < ${minComparables}), utilisation du TGA profil`
  );

  return {
    capRateMarketSelected: profileCapRate,
    sampleCount: validComparables.length,
    source: 'PROFILE_FALLBACK',
    notes,
  };
}

/**
 * Convertit une liste de comparables bruts en échantillons de TGA
 *
 * Utilisé pour transformer les données Firestore en format standard
 *
 * @param comparables - Données brutes des comparables
 * @returns Échantillons de TGA formatés
 */
export function mapComparablesToCapRateSamples(
  comparables: Array<{
    id: string;
    salePrice: number;
    rbp?: number;
    rbe?: number;
    noi?: number;
    totalExpenses?: number;
  }>
): ComparableCapRateSample[] {
  return comparables
    .filter(c => c.salePrice > 0)
    .map(c => {
      // Calculer le NOI si non fourni
      let noi = c.noi || 0;
      if (!noi && c.rbe && c.totalExpenses !== undefined) {
        noi = c.rbe - c.totalExpenses;
      }
      if (!noi && c.rbp && c.totalExpenses !== undefined) {
        // Estimer RBE à 95% du RBP si RBE non disponible
        noi = (c.rbp * 0.95) - c.totalExpenses;
      }

      // Calculer le cap rate
      const capRate = noi > 0 && c.salePrice > 0 ? noi / c.salePrice : 0;

      return {
        id: c.id,
        salePrice: c.salePrice,
        noi,
        capRate,
      };
    })
    .filter(c => c.capRate > 0); // Garder uniquement les valides
}

/**
 * Calcule le TGA implicite au prix demandé
 *
 * @param noi - Revenu net d'exploitation
 * @param askingPrice - Prix demandé
 * @returns TGA implicite (ou undefined si calcul impossible)
 */
export function computeCapRateImpliedAtAsking(
  noi: number,
  askingPrice: number
): number | undefined {
  if (noi <= 0 || askingPrice <= 0) {
    return undefined;
  }
  return Math.round((noi / askingPrice) * 10000) / 10000;
}

/**
 * Évalue si le TGA implicite est agressif par rapport au marché
 *
 * @param capRateImplied - TGA implicite au prix demandé
 * @param marketCapRateMin - TGA minimum du marché (comparables)
 * @param toleranceBps - Tolérance en points de base (défaut: 50 = 0.5%)
 * @returns true si le prix est agressif (TGA implicite trop bas)
 */
export function isAggressivePricing(
  capRateImplied: number,
  marketCapRateMin: number,
  toleranceBps: number = 50
): boolean {
  const tolerance = toleranceBps / 10000;
  return capRateImplied < (marketCapRateMin - tolerance);
}

export default selectMarketCapRate;
