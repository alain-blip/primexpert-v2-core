/**
 * Module d'ajustement TGA basé sur le taux de pénétration RPA
 *
 * Implémente la logique: pénétration faible + petite taille = risque accru = TGA supérieur
 *
 * POLICY V1 (bank-grade, défendable en comité de crédit):
 * - Pénétration < 4%: +75 bps
 * - Pénétration 4-6%: +50 bps
 * - Pénétration 6-8%: +25 bps
 * - Pénétration > 8%: +0 bps
 *
 * - Taille ≤ 25 unités: +50 bps
 * - Taille 26-50 unités: +25 bps
 * - Taille > 50 unités: +0 bps
 *
 * @author Copilote IA - RPAaVendre.com
 * @version 1.0.0
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Paramètres de pénétration du marché
 */
export interface MarketPenetration {
  /** Taux de pénétration RPA (ex: 0.035 = 3.5%) */
  tauxPenetrationRPA: number | null;
  /** Tranche d'âge cible utilisée */
  trancheAgeCible: '75+' | '80+' | '85+';
  /** Source de la donnée */
  source: 'MODELE_INTERNE' | 'STATCAN' | 'MSSS' | 'AUTRE';
  /** Niveau de confiance (0-1) */
  confiance: number;
  /** Commentaire optionnel */
  commentaire?: string;
}

/**
 * Résultat de l'ajustement TGA
 */
export interface TgaAdjustmentResult {
  /** TGA de base (avant ajustements pénétration/taille) */
  baseTga: number;
  /** Ajustement pour pénétration (en basis points) */
  penetrationDeltaBps: number;
  /** Ajustement pour taille (en basis points) */
  sizeDeltaBps: number;
  /** Ajustement marché additionnel (en basis points) */
  marketDeltaBps: number;
  /** TGA final après tous les ajustements */
  finalTga: number;
  /** Explications textuelles (prêtes pour PDF) */
  rationale: string[];
  /** Données de pénétration utilisées */
  penetrationData: {
    rate: number | null;
    source: string;
    confiance: number;
    available: boolean;
  };
  /** Catégorie de taille */
  sizeCategory: 'petite' | 'moyenne' | 'grande';
}

/**
 * Paramètres d'entrée pour le calcul d'ajustement TGA
 */
export interface TgaAdjustmentInput {
  /** TGA de base (ex: 0.085 = 8.5%) */
  baseTga: number;
  /** Taux de pénétration RPA (ex: 0.035 = 3.5%) */
  tauxPenetrationRPA: number | null;
  /** Nombre d'unités de la RPA */
  nombreUnites: number | null;
  /** Tier de marché optionnel */
  marketTier?: 'primaire' | 'secondaire' | 'tertiaire';
  /** Source de la pénétration */
  penetrationSource?: string;
  /** Confiance de la donnée de pénétration (0-1) */
  penetrationConfidence?: number;
}

// ============================================================================
// CONSTANTES - POLICY V1
// ============================================================================

/**
 * Grille d'ajustement selon le taux de pénétration RPA
 * Logique: pénétration faible = marché moins mature = risque accru
 */
export const PENETRATION_ADJUSTMENTS = {
  TRES_FAIBLE: { maxRate: 0.04, deltaBps: 75, label: 'Pénétration < 4%' },
  FAIBLE: { minRate: 0.04, maxRate: 0.06, deltaBps: 50, label: 'Pénétration 4-6%' },
  MOYENNE: { minRate: 0.06, maxRate: 0.08, deltaBps: 25, label: 'Pénétration 6-8%' },
  ELEVEE: { minRate: 0.08, deltaBps: 0, label: 'Pénétration > 8%' },
} as const;

/**
 * Grille d'ajustement selon la taille (nombre d'unités)
 * Logique: petite RPA = actif spécialisé = liquidité moindre = risque accru
 */
export const SIZE_ADJUSTMENTS = {
  PETITE: { maxUnits: 25, deltaBps: 50, label: '≤ 25 unités', category: 'petite' as const },
  MOYENNE: { minUnits: 26, maxUnits: 50, deltaBps: 25, label: '26-50 unités', category: 'moyenne' as const },
  GRANDE: { minUnits: 51, deltaBps: 0, label: '> 50 unités', category: 'grande' as const },
} as const;

/**
 * Ajustements optionnels par tier de marché
 */
export const MARKET_TIER_ADJUSTMENTS = {
  primaire: { deltaBps: 0, label: 'Marché primaire (urbain)' },
  secondaire: { deltaBps: 15, label: 'Marché secondaire (péri-urbain)' },
  tertiaire: { deltaBps: 25, label: 'Marché tertiaire (rural)' },
} as const;

// ============================================================================
// FONCTIONS
// ============================================================================

/**
 * Calcule l'ajustement TGA selon le taux de pénétration
 *
 * @param tauxPenetrationRPA - Taux de pénétration (0-1, ex: 0.035 = 3.5%)
 * @returns Ajustement en basis points et label
 */
export function calculatePenetrationDelta(
  tauxPenetrationRPA: number | null
): { deltaBps: number; label: string; available: boolean } {
  if (tauxPenetrationRPA === null || tauxPenetrationRPA === undefined) {
    return { deltaBps: 0, label: 'Pénétration non disponible', available: false };
  }

  // Normaliser si en pourcentage (ex: 3.5 au lieu de 0.035)
  const rate = tauxPenetrationRPA > 1 ? tauxPenetrationRPA / 100 : tauxPenetrationRPA;

  if (rate < PENETRATION_ADJUSTMENTS.TRES_FAIBLE.maxRate) {
    return { deltaBps: PENETRATION_ADJUSTMENTS.TRES_FAIBLE.deltaBps, label: PENETRATION_ADJUSTMENTS.TRES_FAIBLE.label, available: true };
  } else if (rate < PENETRATION_ADJUSTMENTS.FAIBLE.maxRate) {
    return { deltaBps: PENETRATION_ADJUSTMENTS.FAIBLE.deltaBps, label: PENETRATION_ADJUSTMENTS.FAIBLE.label, available: true };
  } else if (rate < PENETRATION_ADJUSTMENTS.MOYENNE.maxRate) {
    return { deltaBps: PENETRATION_ADJUSTMENTS.MOYENNE.deltaBps, label: PENETRATION_ADJUSTMENTS.MOYENNE.label, available: true };
  } else {
    return { deltaBps: PENETRATION_ADJUSTMENTS.ELEVEE.deltaBps, label: PENETRATION_ADJUSTMENTS.ELEVEE.label, available: true };
  }
}

/**
 * Calcule l'ajustement TGA selon la taille de la RPA
 *
 * @param nombreUnites - Nombre d'unités
 * @returns Ajustement en basis points, label et catégorie
 */
export function calculateSizeDelta(
  nombreUnites: number | null
): { deltaBps: number; label: string; category: 'petite' | 'moyenne' | 'grande' | 'unknown' } {
  if (nombreUnites === null || nombreUnites === undefined || nombreUnites <= 0) {
    return { deltaBps: 0, label: 'Taille non disponible', category: 'unknown' };
  }

  if (nombreUnites <= SIZE_ADJUSTMENTS.PETITE.maxUnits) {
    return {
      deltaBps: SIZE_ADJUSTMENTS.PETITE.deltaBps,
      label: SIZE_ADJUSTMENTS.PETITE.label,
      category: SIZE_ADJUSTMENTS.PETITE.category,
    };
  } else if (nombreUnites <= SIZE_ADJUSTMENTS.MOYENNE.maxUnits) {
    return {
      deltaBps: SIZE_ADJUSTMENTS.MOYENNE.deltaBps,
      label: SIZE_ADJUSTMENTS.MOYENNE.label,
      category: SIZE_ADJUSTMENTS.MOYENNE.category,
    };
  } else {
    return {
      deltaBps: SIZE_ADJUSTMENTS.GRANDE.deltaBps,
      label: SIZE_ADJUSTMENTS.GRANDE.label,
      category: SIZE_ADJUSTMENTS.GRANDE.category,
    };
  }
}

/**
 * Calcule l'ajustement TGA selon le tier de marché
 *
 * @param marketTier - Tier de marché (optionnel)
 * @returns Ajustement en basis points et label
 */
export function calculateMarketTierDelta(
  marketTier?: 'primaire' | 'secondaire' | 'tertiaire'
): { deltaBps: number; label: string } {
  if (!marketTier || !MARKET_TIER_ADJUSTMENTS[marketTier]) {
    return { deltaBps: 0, label: 'Tier de marché non spécifié' };
  }

  return {
    deltaBps: MARKET_TIER_ADJUSTMENTS[marketTier].deltaBps,
    label: MARKET_TIER_ADJUSTMENTS[marketTier].label,
  };
}

/**
 * Génère le rationale textuel pour l'ajustement TGA
 *
 * @param input - Paramètres de calcul
 * @param penetrationResult - Résultat pénétration
 * @param sizeResult - Résultat taille
 * @param marketResult - Résultat marché
 * @param finalTga - TGA final calculé
 * @returns Tableau de strings prêts pour PDF/UI
 */
function generateRationale(
  input: TgaAdjustmentInput,
  penetrationResult: { deltaBps: number; label: string; available: boolean },
  sizeResult: { deltaBps: number; label: string },
  marketResult: { deltaBps: number; label: string },
  finalTga: number
): string[] {
  const rationale: string[] = [];
  const bpsToPercent = (bps: number) => (bps / 100).toFixed(2);

  // Constat de pénétration
  if (penetrationResult.available && input.tauxPenetrationRPA !== null) {
    const ratePercent = (input.tauxPenetrationRPA > 1 ? input.tauxPenetrationRPA : input.tauxPenetrationRPA * 100).toFixed(1);
    rationale.push(
      `Le taux de pénétration RPA local est estimé à ${ratePercent}% (clientèle cible 80+), ce qui reflète ${
        input.tauxPenetrationRPA < 0.04 ? 'une adoption significativement plus faible que la moyenne' :
        input.tauxPenetrationRPA < 0.06 ? 'une adoption plus faible que la moyenne' :
        input.tauxPenetrationRPA < 0.08 ? 'une adoption proche de la moyenne' :
        'une adoption supérieure à la moyenne'
      }.`
    );
  } else {
    rationale.push(
      'Le taux de pénétration RPA local n\'est pas disponible. Aucun ajustement de risque marché n\'est appliqué.'
    );
  }

  // Traduction risque (taille + liquidité)
  if (input.nombreUnites !== null && input.nombreUnites > 0) {
    const sizeDesc = sizeResult.deltaBps > 0
      ? `présente un profil de liquidité et de volatilité plus élevé`
      : `bénéficie d'un profil de liquidité favorable`;
    rationale.push(
      `Dans ce contexte, une résidence de ${input.nombreUnites} unités ${sizeDesc}.`
    );
  }

  // Conclusion TGA
  const totalAdjBps = penetrationResult.deltaBps + sizeResult.deltaBps + marketResult.deltaBps;
  if (totalAdjBps > 0) {
    const adjustmentDetails: string[] = [];
    if (penetrationResult.deltaBps > 0) adjustmentDetails.push(`pénétration +${bpsToPercent(penetrationResult.deltaBps)}%`);
    if (sizeResult.deltaBps > 0) adjustmentDetails.push(`taille +${bpsToPercent(sizeResult.deltaBps)}%`);
    if (marketResult.deltaBps > 0) adjustmentDetails.push(`marché +${bpsToPercent(marketResult.deltaBps)}%`);

    rationale.push(
      `En conséquence, le taux de capitalisation est ajusté de +${bpsToPercent(totalAdjBps)}% (${adjustmentDetails.join(', ')}) pour refléter le rendement exigé, portant le TGA à ${(finalTga * 100).toFixed(2)}%.`
    );
  } else {
    rationale.push(
      `Aucun ajustement de risque n'est requis. Le TGA de base de ${(input.baseTga * 100).toFixed(2)}% est maintenu.`
    );
  }

  return rationale;
}

/**
 * Calcule l'ajustement TGA complet basé sur pénétration et taille
 *
 * FORMULE:
 * finalTga = baseTga + (penetrationDeltaBps + sizeDeltaBps + marketDeltaBps) / 10000
 *
 * @param input - Paramètres d'entrée
 * @returns Résultat complet avec TGA ajusté et rationale
 *
 * @example
 * ```typescript
 * const result = computeTgaAdjustment({
 *   baseTga: 0.085,
 *   tauxPenetrationRPA: 0.035, // 3.5%
 *   nombreUnites: 22,
 *   marketTier: 'secondaire',
 * });
 * // result.finalTga = 0.1015 (8.5% + 0.75% pénétration + 0.50% taille + 0.15% marché)
 * // result.penetrationDeltaBps = 75
 * // result.sizeDeltaBps = 50
 * // result.marketDeltaBps = 15
 * ```
 */
export function computeTgaAdjustment(input: TgaAdjustmentInput): TgaAdjustmentResult {
  // 1. Ajustement pénétration
  const penetrationResult = calculatePenetrationDelta(input.tauxPenetrationRPA);

  // 2. Ajustement taille
  const sizeResult = calculateSizeDelta(input.nombreUnites);

  // 3. Ajustement tier de marché
  const marketResult = calculateMarketTierDelta(input.marketTier);

  // 4. Calcul TGA final
  const totalDeltaBps = penetrationResult.deltaBps + sizeResult.deltaBps + marketResult.deltaBps;
  const finalTga = input.baseTga + (totalDeltaBps / 10000);

  // 5. Génération du rationale
  const rationale = generateRationale(input, penetrationResult, sizeResult, marketResult, finalTga);

  return {
    baseTga: input.baseTga,
    penetrationDeltaBps: penetrationResult.deltaBps,
    sizeDeltaBps: sizeResult.deltaBps,
    marketDeltaBps: marketResult.deltaBps,
    finalTga: Math.round(finalTga * 10000) / 10000, // Arrondir à 4 décimales
    rationale,
    penetrationData: {
      rate: input.tauxPenetrationRPA,
      source: input.penetrationSource || 'MODELE_INTERNE',
      confiance: input.penetrationConfidence || 0.7,
      available: penetrationResult.available,
    },
    sizeCategory: sizeResult.category === 'unknown' ? 'moyenne' : sizeResult.category,
  };
}

/**
 * Crée un objet MarketPenetration avec des valeurs par défaut
 *
 * @param rate - Taux de pénétration
 * @param options - Options additionnelles
 * @returns Objet MarketPenetration complet
 */
export function createMarketPenetration(
  rate: number | null,
  options: Partial<Omit<MarketPenetration, 'tauxPenetrationRPA'>> = {}
): MarketPenetration {
  return {
    tauxPenetrationRPA: rate,
    trancheAgeCible: options.trancheAgeCible || '80+',
    source: options.source || 'MODELE_INTERNE',
    confiance: options.confiance ?? 0.7,
    commentaire: options.commentaire,
  };
}

/**
 * Formate le résultat TGA pour affichage UI/PDF
 *
 * @param result - Résultat du calcul TGA
 * @returns Objet formaté pour affichage
 */
export function formatTgaAdjustmentForDisplay(result: TgaAdjustmentResult): {
  baseTgaDisplay: string;
  penetrationAdjDisplay: string;
  sizeAdjDisplay: string;
  marketAdjDisplay: string;
  finalTgaDisplay: string;
  totalAdjDisplay: string;
  rationale: string[];
} {
  const bpsToPercentStr = (bps: number) => {
    if (bps === 0) return '—';
    return `${bps >= 0 ? '+' : ''}${(bps / 100).toFixed(2)}%`;
  };

  const totalAdj = result.penetrationDeltaBps + result.sizeDeltaBps + result.marketDeltaBps;

  return {
    baseTgaDisplay: `${(result.baseTga * 100).toFixed(2)}%`,
    penetrationAdjDisplay: bpsToPercentStr(result.penetrationDeltaBps),
    sizeAdjDisplay: bpsToPercentStr(result.sizeDeltaBps),
    marketAdjDisplay: bpsToPercentStr(result.marketDeltaBps),
    finalTgaDisplay: `${(result.finalTga * 100).toFixed(2)}%`,
    totalAdjDisplay: bpsToPercentStr(totalAdj),
    rationale: result.rationale,
  };
}

export default computeTgaAdjustment;
