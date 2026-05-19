/**
 * Règles financières bancaires — SSOT (port Copilote financialRules.js).
 *
 * Multilogement régulier (5+ logements) — voir aussi schlMultilogementRules.ts :
 *   • Commercial pur (conventionnel) — 15 ans, LTV ~65 %
 *   • SCHL Standard — 35–40 ans, RPV 85 %, CCD 1,20–1,30
 *   • APH Select (50/70/100 pts) — 40/45/50 ans, RPV 95 %, CCD 1,10
 *
 * RPA (≥ 50 places) — paliers APH Select identiques, admissibilité spécifique soins.
 */

import {
  APH_SELECT_TIERS_MULTILOGEMENT,
  getSchlStandardAmortYears,
  resolveAphSelectTierFromPoints,
  resolvePropertyAssetCategory,
  SCHL_APH_SELECT_SHARED,
  SCHL_COMMON_ELIGIBILITY,
  SCHL_RPA_ELIGIBILITY,
  SCHL_STANDARD_MULTILOGEMENT,
  type AphSelectTierDefinition,
  type PropertyAssetCategory,
} from './schlMultilogementRules';

export type { PropertyAssetCategory, AphSelectTierDefinition };
export {
  APH_SELECT_POINTS_PILLARS,
  APH_SELECT_TIERS_MULTILOGEMENT,
  getSchlFinancingComparisonTable,
  resolvePropertyAssetCategory,
  SCHL_APH_SELECT_SHARED,
  SCHL_COMMON_ELIGIBILITY,
  SCHL_RPA_ELIGIBILITY,
  SCHL_STANDARD_MULTILOGEMENT,
} from './schlMultilogementRules';

export const DSCR_RULES = {
  MINIMUM_BANK: 1.25,
  /** CCD minimal RPA / résidences assistées */
  APH_SELECT_ASSISTED_MIN: 1.2,
  /** CCD APH Select — multilogement régulier (paliers 50/70/100 pts) */
  APH_SELECT_MULTILOGEMENT_MIN: 1.1,
  COMFORTABLE: 1.5,
  EXCELLENT: 1.75,
  DEFAULT_TARGET: 1.3,
} as const;

export const LTV_RULES = {
  TYPICAL: 0.65,
  CONSERVATIVE: 0.6,
  MAX_ALLOWED: 0.8,
} as const;

export const AMORTIZATION_RULES = {
  COMMERCIAL_PURE: 15,
  /** SCHL hors APH Select — simulation conservatrice */
  SCHL_INSURED: 20,
  STANDARD: 15,
  SHORT: 15,
  LONG: 30,
} as const;

/** Programme APH Select — paliers multilogement (réexport grille complète). */
export const SCHL_APH_SELECT_RULES = {
  ...SCHL_APH_SELECT_SHARED,
  ELIGIBILITY_RPA: SCHL_RPA_ELIGIBILITY,
  ELIGIBILITY_MULTILOGEMENT: SCHL_COMMON_ELIGIBILITY,
  POINT_TIERS: APH_SELECT_TIERS_MULTILOGEMENT,
  POINT_CATEGORIES_FR: ['Abordabilité', 'Efficacité énergétique', 'Accessibilité'],
  POINT_CATEGORIES_EN: ['Affordability', 'Energy efficiency', 'Accessibility'],
} as const;

export type AphSelectTier = AphSelectTierDefinition;

export const SCHL_FINANCING_RULES = {
  AMORTIZATION_YEARS_MAX: AMORTIZATION_RULES.SCHL_INSURED,
  LABEL_FR: 'Assuré SCHL (hors APH Select)',
  LABEL_EN: 'CMHC insured (non–MLI Select)',
} as const;

export const COMMERCIAL_FINANCING_RULES = {
  AMORTIZATION_YEARS_STANDARD: AMORTIZATION_RULES.COMMERCIAL_PURE,
  LABEL_FR: 'Commercial pur',
  LABEL_EN: 'Conventional commercial',
} as const;

export const INTEREST_RATE_RULES = {
  DEFAULT: 0.065,
} as const;

/** Audit 360° / manque à gagner — ratios sectoriels et capitalisation. */
export const OPTIMIZATION_360_RULES = {
  /** RDE cible (% du RBE) — repli si benchmark portefeuille indisponible */
  EXPENSE_RATIO_TARGET: 0.73,
  /** TGA 10 % : 1 $ de RNE annuel ≈ 10 $ de valeur (si cap rate absent) */
  TGA_VALUE_MULTIPLIER: 10,
  /** Cap rate par défaut (%) si non présent en fiche */
  DEFAULT_CAP_RATE_PCT: 10,
  /** Taux d'inoccupation marché par défaut (loyers) */
  DEFAULT_VACANCY_RATE: 0.03,
  /** Échantillon minimal benchmark portefeuille (futur hook V2) */
  GLOBAL_BENCHMARK_MIN_SAMPLES: 3,
} as const;

export type FinancingProgramId =
  | 'commercial_pure'
  | 'schl_standard'
  | 'schl_insured'
  | 'aph_select';

export type AmortizationComplianceLevel = 'conforme' | 'hors_normes' | 'unknown';

export type EligibilityCriterionStatus = 'conforme' | 'hors_normes' | 'a_verifier';

export interface AmortizationVerdict {
  level: AmortizationComplianceLevel;
  programId: FinancingProgramId;
  expectedYears: number;
  actualYears: number | null;
  isSchlApplicable: boolean;
  color: string;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
}

export interface AphSelectEligibilityCriterion {
  id: string;
  labelFr: string;
  labelEn: string;
  status: EligibilityCriterionStatus;
  detailFr: string;
  detailEn: string;
}

export interface AphSelectEligibilitySummary {
  /** true si tous les critères mesurés sont conformes et points ≥ 50 */
  isEligible: boolean | null;
  aphSelectPoints: number | null;
  tier: AphSelectTier | null;
  criteria: AphSelectEligibilityCriterion[];
  overallLabelFr: string;
  overallLabelEn: string;
  overallColor: string;
}

export interface FinancingProgramContext {
  programId: FinancingProgramId;
  propertyCategory: PropertyAssetCategory;
  isSchlApplicable: boolean;
  aphSelectPoints: number | null;
  aphSelectTier: AphSelectTier | null;
  labelFr: string;
  labelEn: string;
  /** Neuf vs existant — impacte amortissement SCHL Standard (40 vs 35–40 ans). */
  isNewConstruction: boolean | null;
}

export function resolveAphSelectPoints(
  financement: Record<string, unknown> | null | undefined,
  override?: number | null
): number | null {
  if (override != null && Number.isFinite(override)) return Math.round(override);
  if (!financement) return null;
  const keys = [
    'aphSelectPoints',
    'pointsAphSelect',
    'pointsAPH',
    'aphPoints',
    'mliSelectPoints',
  ] as const;
  for (const k of keys) {
    const v = financement[k];
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

/** Palier APH Select atteint (null si < 50 points). */
export function resolveAphSelectTier(points: number | null | undefined): AphSelectTier | null {
  return resolveAphSelectTierFromPoints(points);
}

export function resolveIsSchlApplicable(
  financement: Record<string, unknown> | null | undefined,
  override?: boolean
): boolean {
  if (override === true) return true;
  if (override === false) return false;
  if (!financement || typeof financement !== 'object') return false;

  const truthy = (v: unknown): boolean =>
    v === true ||
    v === 1 ||
    v === '1' ||
    String(v).toLowerCase() === 'true' ||
    String(v).toLowerCase() === 'oui' ||
    String(v).toLowerCase() === 'yes';

  const keys = [
    'schlApplicable',
    'isSchlApplicable',
    'primeSchl',
    'primeSCHL',
    'assuranceSchl',
    'assuranceSCHL',
    'programmeSchl',
    'programmeSCHL',
    'cmhcInsured',
    'isCmhcInsured',
    'aphSelect',
    'isAphSelect',
    'mliSelect',
  ] as const;

  return keys.some((k) => truthy(financement[k]));
}

function resolveIsNewConstruction(
  financement: Record<string, unknown> | null | undefined
): boolean | null {
  if (!financement) return null;
  if (financement.constructionNeuve === true || financement.isNewConstruction === true) return true;
  if (financement.immeubleExistant === true || financement.isExisting === true) return false;
  const s = String(financement.typeProjet ?? financement.projectType ?? '').toLowerCase();
  if (s.includes('neuf') || s.includes('new') || s.includes('construction')) return true;
  if (s.includes('existant') || s.includes('existing') || s.includes('refinanc')) return false;
  return null;
}

export function resolveFinancingProgram(
  financement: Record<string, unknown> | null | undefined,
  options: {
    residence?: Record<string, unknown>;
    baseData?: Record<string, unknown> | null;
    isSchlApplicable?: boolean;
    useAphSelect?: boolean;
    aphSelectPoints?: number | null;
  } = {}
): FinancingProgramContext {
  const residence = options.residence ?? {};
  const baseData = options.baseData ?? null;
  const propertyCategory = resolvePropertyAssetCategory(residence, baseData, financement);
  const isNewConstruction = resolveIsNewConstruction(financement);
  const points = resolveAphSelectPoints(financement, options.aphSelectPoints);
  const tier = resolveAphSelectTier(points);

  const progStr = String(
    financement?.programmeSchl ?? financement?.programme ?? financement?.program ?? ''
  ).toLowerCase();

  const explicitStandard =
    progStr.includes('standard') && !progStr.includes('select') && !progStr.includes('aph');

  const explicitAph =
    options.useAphSelect === true ||
    (!explicitStandard &&
      (progStr.includes('aph') || progStr.includes('select') || progStr.includes('mli')));

  const isAph =
    explicitAph || tier != null || (points != null && points >= SCHL_APH_SELECT_RULES.MIN_POINTS_FOR_BENEFITS);

  const baseCtx = { propertyCategory, isNewConstruction };

  if (isAph) {
    return {
      ...baseCtx,
      programId: 'aph_select',
      isSchlApplicable: true,
      aphSelectPoints: points,
      aphSelectTier: tier,
      labelFr: SCHL_APH_SELECT_RULES.LABEL_FR,
      labelEn: SCHL_APH_SELECT_RULES.LABEL_EN,
    };
  }

  const isSchl = resolveIsSchlApplicable(financement, options.isSchlApplicable);
  const isMultilogement =
    propertyCategory === 'multilogement_regulier' || propertyCategory === 'rpa';

  if (isSchl && isMultilogement) {
    return {
      ...baseCtx,
      programId: 'schl_standard',
      isSchlApplicable: true,
      aphSelectPoints: null,
      aphSelectTier: null,
      labelFr: SCHL_STANDARD_MULTILOGEMENT.LABEL_FR,
      labelEn: SCHL_STANDARD_MULTILOGEMENT.LABEL_EN,
    };
  }

  if (isSchl) {
    return {
      ...baseCtx,
      programId: 'schl_insured',
      isSchlApplicable: true,
      aphSelectPoints: null,
      aphSelectTier: null,
      labelFr: SCHL_FINANCING_RULES.LABEL_FR,
      labelEn: SCHL_FINANCING_RULES.LABEL_EN,
    };
  }

  return {
    ...baseCtx,
    programId: 'commercial_pure',
    isSchlApplicable: false,
    aphSelectPoints: null,
    aphSelectTier: null,
    labelFr: COMMERCIAL_FINANCING_RULES.LABEL_FR,
    labelEn: COMMERCIAL_FINANCING_RULES.LABEL_EN,
  };
}

/** Plafond d'amortissement pour la simulation selon le programme. */
export function getMaxAmortizationYears(
  programId: FinancingProgramId,
  aphSelectPoints?: number | null,
  isNewConstruction?: boolean | null
): number {
  if (programId === 'aph_select') {
    const tier = resolveAphSelectTier(aphSelectPoints ?? null);
    if (tier) return tier.amortYears;
    return APH_SELECT_TIERS_MULTILOGEMENT[APH_SELECT_TIERS_MULTILOGEMENT.length - 1].amortYears;
  }
  if (programId === 'schl_standard') return getSchlStandardAmortYears(isNewConstruction);
  if (programId === 'schl_insured') return AMORTIZATION_RULES.SCHL_INSURED;
  return AMORTIZATION_RULES.COMMERCIAL_PURE;
}

/** Plafond LTV simulation selon le programme (APH : palier de points). */
export function getSimulationLtvMax(
  programId: FinancingProgramId,
  aphSelectPoints?: number | null,
  explicitLtv?: number | null
): number {
  if (explicitLtv != null && explicitLtv > 0) return explicitLtv;
  if (programId === 'aph_select') {
    const tier = resolveAphSelectTier(aphSelectPoints ?? null);
    if (tier) return tier.ltvMax;
    return APH_SELECT_TIERS_MULTILOGEMENT[APH_SELECT_TIERS_MULTILOGEMENT.length - 1].ltvMax;
  }
  if (programId === 'schl_standard') return SCHL_STANDARD_MULTILOGEMENT.LTV_MAX;
  if (programId === 'schl_insured') return LTV_RULES.TYPICAL;
  return LTV_RULES.TYPICAL;
}

/** DSCR cible par défaut pour la simulation. */
export function getDefaultDscrTarget(
  programId: FinancingProgramId,
  aphSelectPoints?: number | null,
  propertyCategory?: PropertyAssetCategory
): number {
  if (programId === 'aph_select') {
    const tier = resolveAphSelectTier(aphSelectPoints ?? null);
    if (tier) return tier.dscrTarget;
    return DSCR_RULES.APH_SELECT_MULTILOGEMENT_MIN;
  }
  if (programId === 'schl_standard') return SCHL_STANDARD_MULTILOGEMENT.DSCR_TYPICAL;
  if (propertyCategory === 'rpa') return DSCR_RULES.APH_SELECT_ASSISTED_MIN;
  return DSCR_RULES.DEFAULT_TARGET;
}

/** CCD minimal pour avis DSCR selon programme. */
export function getMinimumDscrForProgram(
  programId: FinancingProgramId,
  propertyCategory?: PropertyAssetCategory
): number {
  if (programId === 'aph_select') return DSCR_RULES.APH_SELECT_MULTILOGEMENT_MIN;
  if (programId === 'schl_standard') return SCHL_STANDARD_MULTILOGEMENT.DSCR_MIN;
  if (propertyCategory === 'rpa') return DSCR_RULES.APH_SELECT_ASSISTED_MIN;
  return DSCR_RULES.MINIMUM_BANK;
}

export function resolveSimulationAmortizationYears(options: {
  programId: FinancingProgramId;
  aphSelectPoints?: number | null;
  explicitYears?: number | null;
  isNewConstruction?: boolean | null;
}): number {
  const explicit = options.explicitYears;
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) {
    return Math.round(explicit);
  }
  return getMaxAmortizationYears(
    options.programId,
    options.aphSelectPoints,
    options.isNewConstruction
  );
}

export function getAmortizationVerdict(
  amortYears: number | null | undefined,
  program: FinancingProgramContext
): AmortizationVerdict {
  const expectedYears = getMaxAmortizationYears(
    program.programId,
    program.aphSelectPoints,
    program.isNewConstruction
  );
  const { programId, isSchlApplicable } = program;

  if (amortYears == null || !Number.isFinite(amortYears) || amortYears <= 0) {
    return {
      level: 'unknown',
      programId,
      expectedYears,
      actualYears: null,
      isSchlApplicable,
      color: '#6c757d',
      labelFr: '—',
      labelEn: '—',
      descriptionFr: `Amortissement non renseigné — simulation par défaut ${expectedYears} ans (${program.labelFr}).`,
      descriptionEn: `Amortization not set — default simulation ${expectedYears} years (${program.labelEn}).`,
    };
  }

  const rounded = Math.round(amortYears);
  const isConforme = rounded <= expectedYears;

  if (isConforme) {
    const tierNote =
      programId === 'aph_select' && program.aphSelectTier
        ? ` (palier ${program.aphSelectTier.labelFr})`
        : '';
    return {
      level: 'conforme',
      programId,
      expectedYears,
      actualYears: rounded,
      isSchlApplicable,
      color: '#28a745',
      labelFr: 'Conforme',
      labelEn: 'Compliant',
      descriptionFr:
        programId === 'aph_select'
          ? `Amortissement ${rounded} ans — conforme au plafond APH Select${tierNote} (max ${expectedYears} ans).`
          : programId === 'schl_standard'
            ? `Amortissement ${rounded} ans — conforme SCHL Standard multilogement (max ${expectedYears} ans).`
            : programId === 'schl_insured'
              ? `Amortissement ${rounded} ans — conforme au plafond SCHL (${expectedYears} ans max).`
              : `Amortissement ${rounded} ans — conforme au commercial pur (${expectedYears} ans).`,
      descriptionEn:
        programId === 'aph_select'
          ? `Amortization ${rounded} years — within MLI Select cap${tierNote} (max ${expectedYears} years).`
          : programId === 'schl_standard'
            ? `Amortization ${rounded} years — within CMHC Standard multi-unit cap (max ${expectedYears} years).`
            : programId === 'schl_insured'
              ? `Amortization ${rounded} years — within CMHC cap (${expectedYears} years max).`
              : `Amortization ${rounded} years — within conventional commercial standard (${expectedYears} years).`,
    };
  }

  return {
    level: 'hors_normes',
    programId,
    expectedYears,
    actualYears: rounded,
    isSchlApplicable,
    color: '#dc3545',
    labelFr: 'Hors-normes',
    labelEn: 'Non-compliant',
    descriptionFr:
      programId === 'aph_select'
        ? `Amortissement ${rounded} ans dépasse le plafond APH Select (${expectedYears} ans) pour le palier de points.`
        : programId === 'schl_standard'
          ? `Amortissement ${rounded} ans dépasse le plafond SCHL Standard (${expectedYears} ans).`
          : programId === 'schl_insured'
            ? `Amortissement ${rounded} ans dépasse le plafond SCHL (${expectedYears} ans).`
            : `Amortissement ${rounded} ans — hors-normes : commercial pur limité à ${expectedYears} ans.`,
    descriptionEn:
      programId === 'aph_select'
        ? `Amortization ${rounded} years exceeds MLI Select cap (${expectedYears} years) for points tier.`
        : programId === 'schl_standard'
          ? `Amortization ${rounded} years exceeds CMHC Standard cap (${expectedYears} years).`
          : programId === 'schl_insured'
            ? `Amortization ${rounded} years exceeds CMHC cap (${expectedYears} years).`
            : `Amortization ${rounded} years — non-compliant: conventional commercial capped at ${expectedYears} years.`,
  };
}

export interface AphSelectEligibilityInput {
  propertyCategory: PropertyAssetCategory;
  unitCount?: number | null;
  privateOrIndividualUnitsPct?: number | null;
  residentialSurfaceOrValuePct?: number | null;
  commercialSurfaceOrValuePct?: number | null;
  borrowerExperienceYears?: number | null;
  hasQualifiedManagementContract?: boolean | null;
  careLevelMeetsAssisted?: boolean | null;
  aphSelectPoints?: number | null;
  /** Adhésion active au Regroupement québécois des résidences pour aînés (RQRA). */
  membreRQRA?: boolean | null;
  /** Certification MSSS (permis RPA) active à la date de l'analyse. */
  certificationActive?: boolean | null;
}

function numFrom(obj: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function buildAphSelectEligibilityInput(
  residence: Record<string, unknown>,
  baseData: Record<string, unknown> | null,
  financement: Record<string, unknown> | null
): AphSelectEligibilityInput {
  const unitCount =
    numFrom(residence, ['nombreUnitesTotal', 'nombreUnites', 'units', 'unitCount']) ??
    numFrom(baseData, ['nombreUnites', 'units']) ??
    null;

  const propertyCategory = resolvePropertyAssetCategory(residence, baseData, financement);

  return {
    propertyCategory,
    unitCount,
    privateOrIndividualUnitsPct: numFrom(financement, [
      'unitesPriveesPct',
      'placesIndividuellesPct',
      'privateUnitsPct',
      'tauxUnitesPrivees',
    ]),
    residentialSurfaceOrValuePct: numFrom(financement, [
      'superficieResidentiellePct',
      'partValeurResidentielle',
      'residentialSurfacePct',
    ]),
    commercialSurfaceOrValuePct: numFrom(financement, [
      'superficieCommercialePct',
      'partCommerciale',
      'commercialSurfacePct',
    ]),
    borrowerExperienceYears: numFrom(financement, [
      'experienceProprietaireAnnees',
      'borrowerExperienceYears',
    ]),
    hasQualifiedManagementContract:
      financement?.contratGestionQualifie === true ||
      financement?.hasQualifiedManagementContract === true ||
      String(financement?.contratGestionQualifie ?? '').toLowerCase() === 'oui',
    careLevelMeetsAssisted:
      financement?.soinsAdmissibles === true ||
      financement?.careLevelMeetsAssisted === true ||
      ['base', 'modere', 'modéré', 'moderate', 'autonome_assiste'].includes(
        String(financement?.niveauSoins ?? financement?.careLevel ?? '').toLowerCase()
      ),
    aphSelectPoints: resolveAphSelectPoints(financement),
    membreRQRA: resolveRegulatoryBoolean(residence, baseData, financement, [
      'membreRQRA',
      'membreRqra',
      'isRqraMember',
      'adhesionRqra',
      'rqraActive',
    ]),
    certificationActive: resolveRegulatoryBoolean(residence, baseData, financement, [
      'certificationActive',
      'certificationMsssActive',
      'isCertificationActive',
      'permisActif',
      'msssCertificationActive',
    ]),
  };
}

/**
 * Lecture résiliente d'un drapeau réglementaire dans residence / baseData / financement.
 * Retourne `true`, `false` ou `null` (inconnu) — distinction critique pour ne pas
 * pénaliser un dossier juste parce que le champ n'a pas encore été renseigné.
 */
function resolveRegulatoryBoolean(
  residence: Record<string, unknown> | null | undefined,
  baseData: Record<string, unknown> | null | undefined,
  financement: Record<string, unknown> | null | undefined,
  keys: string[]
): boolean | null {
  const sources = [residence, baseData, financement];
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const k of keys) {
      const raw = (src as Record<string, unknown>)[k];
      if (raw === true || raw === 1) return true;
      if (raw === false || raw === 0) return false;
      if (typeof raw === 'string') {
        const norm = raw.trim().toLowerCase();
        if (['true', 'oui', 'yes', '1'].includes(norm)) return true;
        if (['false', 'non', 'no', '0'].includes(norm)) return false;
      }
    }
  }
  return null;
}

export function evaluateAphSelectEligibility(
  input: AphSelectEligibilityInput,
  options: { requireAphPoints?: boolean } = {}
): AphSelectEligibilitySummary {
  const requireAphPoints = options.requireAphPoints ?? true;
  const { MIN_POINTS_FOR_BENEFITS } = SCHL_APH_SELECT_RULES;
  const isRpa = input.propertyCategory === 'rpa';
  const minUnits = isRpa
    ? SCHL_RPA_ELIGIBILITY.MIN_UNITS_OR_PLACES
    : SCHL_COMMON_ELIGIBILITY.MIN_RESIDENTIAL_UNITS;
  const points = input.aphSelectPoints ?? null;
  const tier = resolveAphSelectTier(points);

  const criteria: AphSelectEligibilityCriterion[] = [];

  const push = (
    id: string,
    labelFr: string,
    labelEn: string,
    status: EligibilityCriterionStatus,
    detailFr: string,
    detailEn: string
  ) => {
    criteria.push({ id, labelFr, labelEn, status, detailFr, detailEn });
  };

  if (input.unitCount != null) {
    const ok = input.unitCount >= minUnits;
    push(
      'unit_count',
      isRpa ? 'Taille RPA (≥ 50 places)' : 'Taille (≥ 5 logements résidentiels)',
      isRpa ? 'RPA size (≥ 50 beds)' : 'Size (≥ 5 residential units)',
      ok ? 'conforme' : 'hors_normes',
      `${input.unitCount} ${isRpa ? 'places' : 'logements'} (min. ${minUnits})`,
      `${input.unitCount} ${isRpa ? 'beds' : 'units'} (min. ${minUnits})`
    );
  } else {
    push(
      'unit_count',
      isRpa ? 'Taille RPA (≥ 50 places)' : 'Taille (≥ 5 logements résidentiels)',
      isRpa ? 'RPA size (≥ 50 beds)' : 'Size (≥ 5 residential units)',
      'a_verifier',
      'Nombre d\'unités non renseigné dans la fiche',
      'Unit count not provided in listing'
    );
  }

  if (isRpa && input.privateOrIndividualUnitsPct != null) {
    const pct =
      input.privateOrIndividualUnitsPct > 1
        ? input.privateOrIndividualUnitsPct / 100
        : input.privateOrIndividualUnitsPct;
    const ok = pct >= SCHL_RPA_ELIGIBILITY.MIN_INDIVIDUAL_OR_PRIVATE_PCT;
    push(
      'private_units',
      'Places individuelles / privées (≥ 75 %)',
      'Individual / private units (≥ 75%)',
      ok ? 'conforme' : 'hors_normes',
      `${(pct * 100).toFixed(0)} % (min. 75 %)`,
      `${(pct * 100).toFixed(0)}% (min. 75%)`
    );
  } else if (isRpa) {
    push(
      'private_units',
      'Places individuelles / privées (≥ 75 %)',
      'Individual / private units (≥ 75%)',
      'a_verifier',
      'Répartition privée / individuelle non renseignée',
      'Private / individual mix not provided'
    );
  }

  if (isRpa && input.residentialSurfaceOrValuePct != null) {
    const pct =
      input.residentialSurfaceOrValuePct > 1
        ? input.residentialSurfaceOrValuePct / 100
        : input.residentialSurfaceOrValuePct;
    const ok = pct >= SCHL_RPA_ELIGIBILITY.MIN_RESIDENTIAL_SURFACE_OR_VALUE_PCT;
    push(
      'residential_share',
      'Usage résidentiel RPA (≥ 70 % superficie ou valeur)',
      'Residential use (≥ 70% area or value)',
      ok ? 'conforme' : 'hors_normes',
      `${(pct * 100).toFixed(0)} % (min. 70 %)`,
      `${(pct * 100).toFixed(0)}% (min. 70%)`
    );
  } else if (isRpa) {
    push(
      'residential_share',
      'Usage résidentiel RPA (≥ 70 % superficie ou valeur)',
      'Residential use (≥ 70% area or value)',
      'a_verifier',
      'Part résidentielle non renseignée',
      'Residential share not provided'
    );
  }

  if (!isRpa && input.commercialSurfaceOrValuePct != null) {
    const pct =
      input.commercialSurfaceOrValuePct > 1
        ? input.commercialSurfaceOrValuePct / 100
        : input.commercialSurfaceOrValuePct;
    const ok = pct <= SCHL_COMMON_ELIGIBILITY.MAX_COMMERCIAL_SURFACE_OR_VALUE_PCT;
    push(
      'commercial_share',
      'Usage commercial (≤ 30 % superficie ou valeur)',
      'Commercial use (≤ 30% area or value)',
      ok ? 'conforme' : 'hors_normes',
      `${(pct * 100).toFixed(0)} % (max. 30 %)`,
      `${(pct * 100).toFixed(0)}% (max. 30%)`
    );
  } else if (!isRpa) {
    push(
      'commercial_share',
      'Usage commercial (≤ 30 % superficie ou valeur)',
      'Commercial use (≤ 30% area or value)',
      'a_verifier',
      'Part commerciale non renseignée',
      'Commercial share not provided'
    );
  }

  if (input.borrowerExperienceYears != null || input.hasQualifiedManagementContract) {
    const expOk =
      (input.borrowerExperienceYears ?? 0) >= SCHL_COMMON_ELIGIBILITY.MIN_BORROWER_EXPERIENCE_YEARS;
    const mgmtOk = input.hasQualifiedManagementContract === true;
    const ok = expOk || mgmtOk;
    push(
      'borrower_experience',
      'Expérience propriétaire ou gestion qualifiée (5 ans)',
      'Borrower experience or qualified management (5 years)',
      ok ? 'conforme' : 'hors_normes',
      expOk
        ? `${input.borrowerExperienceYears} ans d'expérience`
        : mgmtOk
          ? 'Contrat de gestion qualifié (≥ 5 ans)'
          : 'Expérience et gestion insuffisantes',
      expOk
        ? `${input.borrowerExperienceYears} years experience`
        : mgmtOk
          ? 'Qualified management contract (≥ 5 years)'
          : 'Insufficient experience and management'
    );
  } else {
    push(
      'borrower_experience',
      'Expérience propriétaire ou gestion qualifiée (5 ans)',
      'Borrower experience or qualified management (5 years)',
      'a_verifier',
      'Expérience / contrat de gestion non documentés',
      'Experience / management contract not documented'
    );
  }

  if (isRpa) {
    if (input.careLevelMeetsAssisted != null) {
      push(
        'care_level',
        'Soins de base ou modérés (autonomie assistée)',
        'Basic or moderate care (assisted living)',
        input.careLevelMeetsAssisted ? 'conforme' : 'hors_normes',
        input.careLevelMeetsAssisted ? 'Profil de soins admissible' : 'Profil de soins à valider avec la SCHL',
        input.careLevelMeetsAssisted ? 'Eligible care profile' : 'Care profile to validate with CMHC'
      );
    } else {
      push(
        'care_level',
        'Soins de base ou modérés (autonomie assistée)',
        'Basic or moderate care (assisted living)',
        'a_verifier',
        'Nature des soins non renseignée',
        'Care level not specified'
      );
    }
  }

  if (requireAphPoints) {
    if (points != null) {
      const ok = points >= MIN_POINTS_FOR_BENEFITS;
      push(
        'aph_points',
        'Points APH Select (≥ 50)',
        'MLI Select points (≥ 50)',
        ok ? 'conforme' : 'hors_normes',
        `${points} points${tier ? ` — ${tier.labelFr}` : ''}`,
        `${points} points${tier ? ` — ${tier.labelEn}` : ''}`
      );
    } else {
      push(
        'aph_points',
        'Points APH Select (≥ 50)',
        'MLI Select points (≥ 50)',
        'a_verifier',
        'Pointage abordabilité / énergie / accessibilité non saisi',
        'Affordability / energy / accessibility score not entered'
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Cross-link réglementaire — Lot R1
  //
  // La SCHL exige que l'exploitant détienne un permis MSSS actif ET soit
  // membre du RQRA pour qu'un dossier APH Select / SCHL Standard soit
  // structurellement admissible. Un FAUX explicite sur l'un ou l'autre
  // déclasse immédiatement l'éligibilité, peu importe le DSCR et les
  // autres critères qualitatifs.
  // ---------------------------------------------------------------------------
  if (input.certificationActive === false) {
    push(
      'msss_certification_active',
      'Certification MSSS active',
      'MSSS certification active',
      'hors_normes',
      'Permis MSSS inactif ou expiré — admissibilité bloquée par la SCHL.',
      'MSSS permit inactive or expired — CMHC blocks eligibility.'
    );
  } else if (input.certificationActive === true) {
    push(
      'msss_certification_active',
      'Certification MSSS active',
      'MSSS certification active',
      'conforme',
      'Permis MSSS actif (registre RPA en règle).',
      'MSSS permit active (RPA registry in good standing).'
    );
  } else {
    push(
      'msss_certification_active',
      'Certification MSSS active',
      'MSSS certification active',
      'a_verifier',
      'État du permis MSSS non renseigné dans la fiche.',
      'MSSS permit status not provided in the file.'
    );
  }

  if (input.membreRQRA === false) {
    push(
      'rqra_membership',
      'Adhésion RQRA active',
      'RQRA membership active',
      'hors_normes',
      "Adhésion au Regroupement québécois des résidences pour aînés (RQRA) inactive — exigence SCHL non respectée.",
      'Quebec association of seniors’ residences (RQRA) membership inactive — CMHC requirement not met.'
    );
  } else if (input.membreRQRA === true) {
    push(
      'rqra_membership',
      'Adhésion RQRA active',
      'RQRA membership active',
      'conforme',
      'Membre actif du RQRA.',
      'Active RQRA member.'
    );
  } else {
    push(
      'rqra_membership',
      'Adhésion RQRA active',
      'RQRA membership active',
      'a_verifier',
      "Statut d'adhésion au RQRA non renseigné.",
      'RQRA membership status not provided.'
    );
  }

  const regulatoryHardFail =
    input.certificationActive === false || input.membreRQRA === false;

  const measured = criteria.filter((c) => c.status !== 'a_verifier');
  const allMeasuredOk = measured.length > 0 && measured.every((c) => c.status === 'conforme');
  const anyHorsNormes = criteria.some((c) => c.status === 'hors_normes');
  const pointsOk = !requireAphPoints || (points != null && points >= MIN_POINTS_FOR_BENEFITS);

  let isEligible: boolean | null = null;
  if (regulatoryHardFail || anyHorsNormes) isEligible = false;
  else if (allMeasuredOk && pointsOk) isEligible = true;
  else if (measured.length === criteria.length && pointsOk) isEligible = true;

  let overallLabelFr = requireAphPoints
    ? 'Admissibilité APH Select — à compléter'
    : 'Admissibilité SCHL Standard — à compléter';
  let overallLabelEn = requireAphPoints
    ? 'MLI Select eligibility — incomplete'
    : 'CMHC Standard eligibility — incomplete';
  let overallColor = '#6c757d';

  if (isEligible === true) {
    overallLabelFr = requireAphPoints
      ? 'Admissible APH Select (critères documentés)'
      : 'Admissible SCHL Standard (critères documentés)';
    overallLabelEn = requireAphPoints
      ? 'MLI Select eligible (documented criteria)'
      : 'CMHC Standard eligible (documented criteria)';
    overallColor = '#28a745';
  } else if (isEligible === false) {
    overallLabelFr = requireAphPoints
      ? 'Non admissible ou hors-normes APH Select'
      : 'Non admissible ou hors-normes SCHL Standard';
    overallLabelEn = requireAphPoints
      ? 'Not eligible or non-compliant with MLI Select'
      : 'Not eligible or non-compliant with CMHC Standard';
    overallColor = '#dc3545';
  }

  return {
    isEligible,
    aphSelectPoints: points,
    tier,
    criteria,
    overallLabelFr,
    overallLabelEn,
    overallColor,
  };
}

export type DscrVerdictLevel = 'excellent' | 'comfortable' | 'minimum' | 'insufficient' | 'unknown';

export interface DscrVerdict {
  level: DscrVerdictLevel;
  isFinanceable: boolean;
  color: string;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
}

export function getDSCRVerdict(
  ratio: number | null | undefined,
  options?: {
    minimumRatio?: number;
    programId?: FinancingProgramId;
    propertyCategory?: PropertyAssetCategory;
  }
): DscrVerdict {
  const minimumBank =
    options?.minimumRatio ??
    (options?.programId
      ? getMinimumDscrForProgram(options.programId, options.propertyCategory)
      : DSCR_RULES.MINIMUM_BANK);

  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) {
    return {
      level: 'unknown',
      isFinanceable: false,
      color: '#6c757d',
      labelFr: '—',
      labelEn: '—',
      descriptionFr: 'Données insuffisantes',
      descriptionEn: 'Insufficient data',
    };
  }

  if (ratio >= DSCR_RULES.EXCELLENT) {
    return {
      level: 'excellent',
      isFinanceable: true,
      color: '#28a745',
      labelFr: 'Excellent',
      labelEn: 'Excellent',
      descriptionFr: `DSCR ${ratio.toFixed(2)}× — Couverture exceptionnelle`,
      descriptionEn: `DSCR ${ratio.toFixed(2)}× — Exceptional coverage`,
    };
  }

  if (ratio >= DSCR_RULES.COMFORTABLE) {
    return {
      level: 'comfortable',
      isFinanceable: true,
      color: '#28a745',
      labelFr: 'Confortable',
      labelEn: 'Comfortable',
      descriptionFr: `DSCR ${ratio.toFixed(2)}× — Seuil de confort atteint`,
      descriptionEn: `DSCR ${ratio.toFixed(2)}× — Comfort threshold met`,
    };
  }

  if (ratio >= minimumBank) {
    return {
      level: 'minimum',
      isFinanceable: true,
      color: '#ffc107',
      labelFr: 'Acceptable',
      labelEn: 'Acceptable',
      descriptionFr: `DSCR ${ratio.toFixed(2)}× — Minimum ${minimumBank.toFixed(2)}× (${options?.programId === 'aph_select' ? 'APH Select' : options?.programId === 'schl_standard' ? 'SCHL Standard' : 'bancaire'})`,
      descriptionEn: `DSCR ${ratio.toFixed(2)}× — Minimum ${minimumBank.toFixed(2)}× (${options?.programId === 'aph_select' ? 'MLI Select' : options?.programId === 'schl_standard' ? 'CMHC Standard' : 'bank'})`,
    };
  }

  return {
    level: 'insufficient',
    isFinanceable: false,
    color: '#dc3545',
    labelFr: 'À haut risque',
    labelEn: 'High risk',
    descriptionFr: `DSCR ${ratio.toFixed(2)}× — Sous le seuil minimal (${minimumBank.toFixed(2)}×)`,
    descriptionEn: `DSCR ${ratio.toFixed(2)}× — Below minimum threshold (${minimumBank.toFixed(2)}×)`,
  };
}
