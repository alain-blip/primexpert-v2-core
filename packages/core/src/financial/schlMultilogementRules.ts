/**
 * SCHL — Multilogement régulier (5+ logements) & parcours APH Select.
 * Mémoire métier Primexpert (Règle St-Jean / grilles 2025–2026).
 *
 * Deux parcours distincts pour le locatif standard :
 *   A) SCHL Standard — sans points APH Select
 *   B) APH Select — paliers 50 / 70 / 100 points (abordabilité, énergie, accessibilité)
 *
 * Les RPA (≥ 50 places, critères de soins) utilisent les mêmes paliers APH Select
 * mais des seuils d'admissibilité propres (voir SCHL_RPA_ELIGIBILITY).
 *
 * Calculateur officiel :
 * https://www.cmhc-schl.gc.ca/professionnels/financement-de-projets-et-financement-hypothecaire/assurance-pret-hypothecaire/assurance-pret-pour-immeubles-collectifs/aph-select
 */

/** Type d'actif pour choisir la grille d'admissibilité SCHL. */
export type PropertyAssetCategory = 'commercial_pure' | 'multilogement_regulier' | 'rpa';

/** Exigences communes SCHL (Standard et APH Select) — multilogement 5+ logements. */
export const SCHL_COMMON_ELIGIBILITY = {
  MIN_RESIDENTIAL_UNITS: 5,
  /** Portion commerciale (rez-de-chaussée) — idéalement ≤ 30 % superficie ou valeur. */
  MAX_COMMERCIAL_SURFACE_OR_VALUE_PCT: 0.3,
  MIN_BORROWER_EXPERIENCE_YEARS: 5,
  MIN_MANAGEMENT_CONTRACT_YEARS: 5,
  /** Valeur nette ≥ 25 % du prêt ; liquidités minimales 100 000 $. */
  MIN_NET_WORTH_LOAN_PCT: 0.25,
  MIN_LIQUID_ASSETS_CAD: 100_000,
} as const;

/**
 * SCHL Standard — multilogement régulier sans points APH Select.
 * | Amort. | 40 ans (neuf) / 35–40 ans (existant) |
 * | RPV    | jusqu'à 85 % |
 * | CCD    | 1,20 à 1,30 |
 * | Prime  | ~4,50 % à 5,75 % |
 */
export const SCHL_STANDARD_MULTILOGEMENT = {
  LABEL_FR: 'SCHL Standard (multilogement)',
  LABEL_EN: 'CMHC Standard (multi-unit rental)',
  AMORT_YEARS_NEW: 40,
  AMORT_YEARS_EXISTING_MIN: 35,
  AMORT_YEARS_EXISTING_MAX: 40,
  LTV_MAX: 0.85,
  DSCR_MIN: 1.2,
  DSCR_TYPICAL: 1.3,
  PREMIUM_PCT_MIN: 4.5,
  PREMIUM_PCT_MAX: 5.75,
} as const;

/**
 * Piliers de points APH Select — multilogement régulier (pas de contraintes de soins RPA).
 * Abordabilité jusqu'à 130 pts · Énergie jusqu'à 50 pts · Accessibilité jusqu'à 30 pts.
 */
export const APH_SELECT_POINTS_PILLARS = {
  AFFORDABILITY_MAX: 130,
  ENERGY_EFFICIENCY_MAX: 50,
  ACCESSIBILITY_MAX: 30,
  AFFORDABILITY_LABEL_FR: 'Abordabilité (loyers sous seuil marché, engagement 10–20 ans)',
  ENERGY_LABEL_FR: 'Efficacité énergétique (modélisation certifiée, −15 % à −40 % vs code)',
  ACCESSIBILITY_LABEL_FR: 'Accessibilité universelle (CSA B651 ou équivalent)',
} as const;

/** Palier APH Select — grille multilogement régulier (locatif standard). */
export interface AphSelectTierDefinition {
  minPoints: number;
  level: number;
  amortYears: number;
  ltvMax: number;
  dscrTarget: number;
  premiumPct: number;
  labelFr: string;
  labelEn: string;
}

/**
 * Grille comparative SCHL Standard vs APH Select (multilogement régulier).
 * Sources : fiche SCHL APH Select, guides courtiers multilogements 2025–2026.
 */
export const APH_SELECT_TIERS_MULTILOGEMENT: readonly AphSelectTierDefinition[] = [
  {
    minPoints: 100,
    level: 3,
    amortYears: 50,
    ltvMax: 0.95,
    dscrTarget: 1.1,
    premiumPct: 1.25,
    labelFr: 'APH Select — 100 points (Niveau 3)',
    labelEn: 'MLI Select — 100 points (Level 3)',
  },
  {
    minPoints: 70,
    level: 2,
    amortYears: 45,
    ltvMax: 0.95,
    dscrTarget: 1.1,
    premiumPct: 2.0,
    labelFr: 'APH Select — 70 points (Niveau 2)',
    labelEn: 'MLI Select — 70 points (Level 2)',
  },
  {
    minPoints: 50,
    level: 1,
    amortYears: 40,
    ltvMax: 0.95,
    dscrTarget: 1.1,
    premiumPct: 2.5,
    labelFr: 'APH Select — 50 points (Niveau 1)',
    labelEn: 'MLI Select — 50 points (Level 1)',
  },
] as const;

export const SCHL_APH_SELECT_SHARED = {
  LABEL_FR: 'APH Select (SCHL)',
  LABEL_EN: 'CMHC MLI Select',
  MIN_POINTS_FOR_BENEFITS: 50,
  OFFICIAL_URLS: {
    APH_SELECT_FR:
      'https://www.cmhc-schl.gc.ca/professionnels/financement-de-projets-et-financement-hypothecaire/assurance-pret-hypothecaire/assurance-pret-pour-immeubles-collectifs/aph-select',
    COLLECTIVE_INSURANCE_FR:
      'https://www.cmhc-schl.gc.ca/professionnels/financement-de-projets-et-financement-hypothecaire/assurance-pret-hypothecaire/assurance-pret-pour-immeubles-collectifs',
    CALCULATOR_FR:
      'https://www.cmhc-schl.gc.ca/professionnels/financement-de-projets-et-financement-hypothecaire/assurance-pret-hypothecaire/assurance-pret-pour-immeubles-collectifs/aph-select',
  },
} as const;

/** Admissibilité collective RPA (≠ multilogement régulier 5+). */
export const SCHL_RPA_ELIGIBILITY = {
  MIN_UNITS_OR_PLACES: 50,
  MIN_INDIVIDUAL_OR_PRIVATE_PCT: 0.75,
  MIN_RESIDENTIAL_SURFACE_OR_VALUE_PCT: 0.7,
  MIN_DSCR_ASSISTED: 1.2,
} as const;

export function resolvePropertyAssetCategory(
  residence: Record<string, unknown>,
  baseData: Record<string, unknown> | null,
  financement: Record<string, unknown> | null
): PropertyAssetCategory {
  const explicit = String(
    financement?.categorieBien ??
      financement?.propertyCategory ??
      financement?.typeActif ??
      residence?.propertyCategory ??
      residence?.typeBien ??
      ''
  ).toLowerCase();

  if (explicit.includes('rpa') || explicit.includes('personnes_agees') || explicit.includes('senior')) {
    return 'rpa';
  }
  if (
    explicit.includes('multilog') ||
    explicit.includes('multi-unit') ||
    explicit.includes('locatif')
  ) {
    return 'multilogement_regulier';
  }
  if (explicit.includes('commercial')) return 'commercial_pure';

  const unitCount =
    numFromRecord(residence, ['nombreUnitesTotal', 'nombreUnites', 'units', 'unitCount']) ??
    numFromRecord(baseData, ['nombreUnites', 'units']) ??
    null;

  if (unitCount != null && unitCount >= SCHL_RPA_ELIGIBILITY.MIN_UNITS_OR_PLACES) return 'rpa';
  if (unitCount != null && unitCount >= SCHL_COMMON_ELIGIBILITY.MIN_RESIDENTIAL_UNITS) {
    return 'multilogement_regulier';
  }

  return 'commercial_pure';
}

export function resolveAphSelectTierFromPoints(
  points: number | null | undefined
): AphSelectTierDefinition | null {
  if (points == null || !Number.isFinite(points) || points < SCHL_APH_SELECT_SHARED.MIN_POINTS_FOR_BENEFITS) {
    return null;
  }
  for (const tier of APH_SELECT_TIERS_MULTILOGEMENT) {
    if (points >= tier.minPoints) return tier;
  }
  return null;
}

export function getSchlStandardAmortYears(isNewConstruction?: boolean | null): number {
  if (isNewConstruction === true) return SCHL_STANDARD_MULTILOGEMENT.AMORT_YEARS_NEW;
  if (isNewConstruction === false) return SCHL_STANDARD_MULTILOGEMENT.AMORT_YEARS_EXISTING_MAX;
  return SCHL_STANDARD_MULTILOGEMENT.AMORT_YEARS_NEW;
}

function numFromRecord(obj: Record<string, unknown> | null, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Tableau comparatif pour documentation UI / exports. */
export function getSchlFinancingComparisonTable(): Array<{
  programFr: string;
  amortMax: string;
  ltvMax: string;
  dscr: string;
  primeSchl: string;
}> {
  return [
    {
      programFr: SCHL_STANDARD_MULTILOGEMENT.LABEL_FR,
      amortMax: `${SCHL_STANDARD_MULTILOGEMENT.AMORT_YEARS_EXISTING_MIN}–${SCHL_STANDARD_MULTILOGEMENT.AMORT_YEARS_NEW} ans`,
      ltvMax: `${(SCHL_STANDARD_MULTILOGEMENT.LTV_MAX * 100).toFixed(0)} %`,
      dscr: `${SCHL_STANDARD_MULTILOGEMENT.DSCR_MIN.toFixed(2)}–${SCHL_STANDARD_MULTILOGEMENT.DSCR_TYPICAL.toFixed(2)}`,
      primeSchl: `${SCHL_STANDARD_MULTILOGEMENT.PREMIUM_PCT_MIN} % – ${SCHL_STANDARD_MULTILOGEMENT.PREMIUM_PCT_MAX} %`,
    },
    ...APH_SELECT_TIERS_MULTILOGEMENT.slice()
      .reverse()
      .map((t) => ({
        programFr: t.labelFr,
        amortMax: `${t.amortYears} ans`,
        ltvMax: `${(t.ltvMax * 100).toFixed(0)} %`,
        dscr: `${t.dscrTarget.toFixed(2)}`,
        primeSchl: `${t.premiumPct.toFixed(2)} %`,
      })),
  ];
}
