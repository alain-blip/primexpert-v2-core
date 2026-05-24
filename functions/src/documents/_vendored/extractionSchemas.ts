/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/documents/
 * Régénéré : functions/scripts/sync-core-documents.cjs (prebuild)
 */
/**
 * Schémas et normalisation — extraction états financiers (Vertex AI).
 * SSOT ratios d'exploitation par unité ; aucune donnée identifiante.
 */

/** Clés dépenses alignées sur `expenseKeys` (SSOT financier). */
export type BenchmarkExpenseKey =
  | 'mainDOeuvreDirecte'
  | 'salairesAvantages'
  | 'telecommunications'
  | 'energie'
  | 'assurances'
  | 'taxesPermis'
  | 'taxesMunicipalesScolaire'
  | 'nourritures'
  | 'fournituresBureau'
  | 'fraisDeplacements'
  | 'honorairesProfessionnels'
  | 'fraisRepresentation'
  | 'entretienReparation'
  | 'fraisGestion'
  | 'publicite'
  | 'divers';

const CANONICAL_EXPENSE_KEYS: readonly BenchmarkExpenseKey[] = [
  'mainDOeuvreDirecte',
  'salairesAvantages',
  'telecommunications',
  'energie',
  'assurances',
  'taxesPermis',
  'taxesMunicipalesScolaire',
  'nourritures',
  'fournituresBureau',
  'fraisDeplacements',
  'honorairesProfessionnels',
  'fraisRepresentation',
  'entretienReparation',
  'fraisGestion',
  'publicite',
  'divers',
];

export interface FinancialAmountRow {
  label: string;
  value: number;
  currency?: string;
  expenseKey?: BenchmarkExpenseKey | null;
}

export interface OperatingBenchmarkMetrics {
  /** Revenu brut effectif (RBE) ou revenus d'exploitation totaux détectés. */
  revenuTotal: number | null;
  /** Total des dépenses d'exploitation (hors bilan / amortissement / impôts). */
  depensesExploitation: number | null;
  nbPortes: number | null;
  revenuBrutParUnite: number | null;
  depensesExploitationParUnite: number | null;
  /** Ratio dépenses / revenus en points de pourcentage (0–100). */
  ratioFraisExploitation: number | null;
  categoriesRpa?: {
    soins?: number;
    alimentation?: number;
    energie?: number;
  };
  /** Dépenses par clé canonique (montants annuels déclarés). */
  depensesParCle?: Partial<Record<BenchmarkExpenseKey, number>>;
  annee?: number;
}

export interface MarketFinancialBenchmarkDoc {
  region: string;
  regionAdministrative: string;
  sousType: string;
  siloType: string;
  nbPortes: number;
  nbPortesBand: string;
  revenusParPorteAn: number;
  depensesParPorteAn: number;
  ratioFraisExploitationPct?: number;
  depensesParCleParPorte?: Partial<Record<string, number>>;
  categoriesRpaParPorte?: {
    soins?: number;
    alimentation?: number;
    energie?: number;
  };
  date: string;
  anneeDonnees: number;
  provenance: 'etats_financiers';
  injectedAtMillis: number;
}

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

function coerceNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const REVENUE_TOTAL_PATTERNS =
  /revenu(s)?\s*(brut(s)?\s*)?(effectif|total|exploitation)|total\s+des\s+revenus|gross\s+(rental\s+)?income|effective\s+gross/i;

const EXPENSE_TOTAL_PATTERNS =
  /total\s+(des\s+)?(frais|charges|depenses|dépenses)\s*d.exploitation|depenses\s*d.exploitation\s*total|operating\s+expenses?\s*total|total\s+operating/i;

const EXCLUDE_LINE_PATTERNS =
  /amortissement|depreciation|bilan|actif|passif|impot\s+sur|profit\s+net|benefice\s+net|marge\s+nette|interest|interet\s+sur\s+emprunt|financement/i;

function isExcludedLine(label: string): boolean {
  const n = normalizeLabel(label);
  return EXCLUDE_LINE_PATTERNS.test(n);
}

function matchExpenseKeyFromLabel(label: string): BenchmarkExpenseKey | null {
  const n = normalizeLabel(label);
  if (!n || isExcludedLine(label)) return null;
  if (/taxe(s)?\s*(municip|scol)|municipal|school tax/.test(n)) return 'taxesMunicipalesScolaire';
  if (/taxe(s)?\s*et\s*permis|permis/.test(n)) return 'taxesPermis';
  if (/assurance/.test(n)) return 'assurances';
  if (/energie|electricite|électricité|gaz|chauffage|mazout|hydro/.test(n)) return 'energie';
  if (/nourriture|alimentation|repas|food/.test(n)) return 'nourritures';
  if (/soin|infirmier|personnel\s+soignant|main.d.oeuvre\s+directe|salaire/.test(n)) {
    return /soin|infirmier|personnel\s+soignant/.test(n) ? 'mainDOeuvreDirecte' : 'salairesAvantages';
  }
  if (/entretien|reparation|réparation|maintenance/.test(n)) return 'entretienReparation';
  if (/gestion|management/.test(n)) return 'fraisGestion';
  if (/honoraire|professionnel|comptable/.test(n)) return 'honorairesProfessionnels';
  if (/deneigement|déneigement|snow/.test(n)) return 'divers';
  if (/telecom|cable|telephon/.test(n)) return 'telecommunications';
  return null;
}

function findTotalLine(
  amounts: FinancialAmountRow[],
  pattern: RegExp
): number | null {
  for (const row of amounts) {
    if (isExcludedLine(row.label)) continue;
    if (pattern.test(normalizeLabel(row.label))) {
      const v = coerceNum(row.value);
      if (v != null && v > 0) return v;
    }
  }
  return null;
}

function sumRevenueLines(amounts: FinancialAmountRow[]): number {
  let sum = 0;
  let has = false;
  for (const row of amounts) {
    if (isExcludedLine(row.label)) continue;
    const n = normalizeLabel(row.label);
    if (
      /loyer|revenu|location|rent|subsidy|subvention|repas|buanderie|stationnement/.test(n) &&
      !/depense|charge|frais|expense|taxe\s+payee/.test(n)
    ) {
      const v = coerceNum(row.value);
      if (v != null && v > 0) {
        sum += v;
        has = true;
      }
    }
    if (REVENUE_TOTAL_PATTERNS.test(n)) {
      const v = coerceNum(row.value);
      if (v != null && v > 0) return v;
    }
  }
  return has ? sum : 0;
}

function sumExpenseLines(amounts: FinancialAmountRow[]): number {
  const totalLine = findTotalLine(amounts, EXPENSE_TOTAL_PATTERNS);
  if (totalLine != null) return totalLine;

  let sum = 0;
  let has = false;
  for (const row of amounts) {
    if (isExcludedLine(row.label)) continue;
    const n = normalizeLabel(row.label);
    if (
      /depense|charge|frais|expense|salaire|assurance|taxe|entretien|energie|nourriture|honoraire|gestion|telecom/.test(
        n
      ) &&
      !REVENUE_TOTAL_PATTERNS.test(n)
    ) {
      const v = coerceNum(row.value);
      if (v != null && v > 0) {
        sum += v;
        has = true;
      }
    }
  }
  return has ? sum : 0;
}

export function resolveNbPortesBand(nbPortes: number, siloType: string): string {
  if (siloType === 'rpa_ri_chsld') {
    if (nbPortes < 35) return 'RPA_[0-34]';
    if (nbPortes <= 80) return 'RPA_[35-80]';
    return 'RPA_[81+]';
  }
  if (siloType === 'cpe') {
    if (nbPortes < 40) return 'CPE_[0-39]';
    if (nbPortes <= 80) return 'CPE_[40-80]';
    return 'CPE_[81+]';
  }
  if (nbPortes <= 4) return 'PLEX_[1-4]';
  if (nbPortes <= 12) return 'PLEX_[5-12]';
  return 'PLEX_[13+]';
}

export function amountsToFinancialRows(
  amounts: Array<{ label: string; value: number; currency?: string }>
): FinancialAmountRow[] {
  return amounts
    .map((a) => ({
      label: String(a.label ?? '').trim(),
      value: coerceNum(a.value) ?? 0,
      currency: a.currency ?? 'CAD',
      expenseKey: matchExpenseKeyFromLabel(String(a.label ?? '')),
    }))
    .filter((r) => r.label && r.value > 0);
}

export function computeOperatingBenchmarkFromAmounts(
  amounts: FinancialAmountRow[],
  options: {
    nbPortes?: number | null;
    annee?: number;
  } = {}
): OperatingBenchmarkMetrics {
  const revenuLine = findTotalLine(amounts, REVENUE_TOTAL_PATTERNS);
  const revenuTotal = revenuLine != null && revenuLine > 0 ? revenuLine : sumRevenueLines(amounts) || null;

  const depenseLine = findTotalLine(amounts, EXPENSE_TOTAL_PATTERNS);
  const depensesExploitation =
    depenseLine != null && depenseLine > 0 ? depenseLine : sumExpenseLines(amounts) || null;

  const depensesParCle: Partial<Record<BenchmarkExpenseKey, number>> = {};
  for (const row of amounts) {
    const key = row.expenseKey ?? matchExpenseKeyFromLabel(row.label);
    if (!key || !CANONICAL_EXPENSE_KEYS.includes(key)) continue;
    depensesParCle[key] = (depensesParCle[key] ?? 0) + row.value;
  }

  const nbPortes =
    options.nbPortes != null && options.nbPortes > 0 ? Math.round(options.nbPortes) : null;

  const revenuBrutParUnite =
    revenuTotal != null && nbPortes != null && nbPortes > 0 ? revenuTotal / nbPortes : null;
  const depensesExploitationParUnite =
    depensesExploitation != null && nbPortes != null && nbPortes > 0
      ? depensesExploitation / nbPortes
      : null;

  const ratioFraisExploitation =
    revenuTotal != null && revenuTotal > 0 && depensesExploitation != null
      ? (depensesExploitation / revenuTotal) * 100
      : null;

  const categoriesRpa: OperatingBenchmarkMetrics['categoriesRpa'] = {};
  const soins =
    (depensesParCle.mainDOeuvreDirecte ?? 0) + (depensesParCle.salairesAvantages ?? 0);
  if (soins > 0) categoriesRpa.soins = soins;
  if (depensesParCle.nourritures) categoriesRpa.alimentation = depensesParCle.nourritures;
  if (depensesParCle.energie) categoriesRpa.energie = depensesParCle.energie;

  return {
    revenuTotal,
    depensesExploitation,
    nbPortes,
    revenuBrutParUnite,
    depensesExploitationParUnite,
    ratioFraisExploitation,
    categoriesRpa: Object.keys(categoriesRpa).length ? categoriesRpa : undefined,
    depensesParCle: Object.keys(depensesParCle).length ? depensesParCle : undefined,
    annee: options.annee,
  };
}

export function buildMarketFinancialBenchmarkDoc(input: {
  regionDisplayName: string;
  regionAdministrative: string;
  siloType: string;
  nbPortes: number;
  metrics: OperatingBenchmarkMetrics;
  anneeDonnees: number;
  injectedAtMillis?: number;
}): MarketFinancialBenchmarkDoc | null {
  const { metrics, nbPortes } = input;
  if (
    metrics.revenuBrutParUnite == null ||
    metrics.depensesExploitationParUnite == null ||
    !Number.isFinite(metrics.revenuBrutParUnite) ||
    !Number.isFinite(metrics.depensesExploitationParUnite) ||
    nbPortes < 1
  ) {
    return null;
  }

  const now = new Date(input.injectedAtMillis ?? Date.now());
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const sousType = resolveNbPortesBand(nbPortes, input.siloType);

  const depensesParCleParPorte: Record<string, number> = {};
  if (metrics.depensesParCle) {
    for (const [k, v] of Object.entries(metrics.depensesParCle)) {
      if (typeof v === 'number' && v > 0) {
        depensesParCleParPorte[k] = v / nbPortes;
      }
    }
  }

  const categoriesRpaParPorte: MarketFinancialBenchmarkDoc['categoriesRpaParPorte'] = {};
  if (metrics.categoriesRpa?.soins) {
    categoriesRpaParPorte.soins = metrics.categoriesRpa.soins / nbPortes;
  }
  if (metrics.categoriesRpa?.alimentation) {
    categoriesRpaParPorte.alimentation = metrics.categoriesRpa.alimentation / nbPortes;
  }
  if (metrics.categoriesRpa?.energie) {
    categoriesRpaParPorte.energie = metrics.categoriesRpa.energie / nbPortes;
  }

  const doc: MarketFinancialBenchmarkDoc = {
    region: input.regionDisplayName,
    regionAdministrative: input.regionAdministrative,
    sousType,
    siloType: input.siloType,
    nbPortes,
    nbPortesBand: sousType,
    revenusParPorteAn: Math.round(metrics.revenuBrutParUnite),
    depensesParPorteAn: Math.round(metrics.depensesExploitationParUnite),
    date,
    anneeDonnees: input.anneeDonnees,
    provenance: 'etats_financiers',
    injectedAtMillis: input.injectedAtMillis ?? Date.now(),
  };

  if (metrics.ratioFraisExploitation != null) {
    doc.ratioFraisExploitationPct = Math.round(metrics.ratioFraisExploitation * 10) / 10;
  }
  if (Object.keys(depensesParCleParPorte).length) {
    doc.depensesParCleParPorte = depensesParCleParPorte;
  }
  if (Object.keys(categoriesRpaParPorte).length) {
    doc.categoriesRpaParPorte = categoriesRpaParPorte;
  }

  return doc;
}

export function enrichExtractedDataWithOperatingBenchmarks(
  extracted: Record<string, unknown>,
  nbPortesHint?: number | null
): Record<string, unknown> {
  const amountsRaw = Array.isArray(extracted.amounts) ? extracted.amounts : [];
  const amounts = amountsToFinancialRows(
    amountsRaw as Array<{ label: string; value: number; currency?: string }>
  );
  if (!amounts.length) return extracted;

  const nbFromModel = coerceNum(extracted.nbPortes ?? extracted.nombreUnites);
  const nbPortes = nbFromModel ?? nbPortesHint ?? null;
  const annee =
    typeof extracted.annee === 'number' ? extracted.annee : coerceNum(extracted.annee) ?? undefined;

  const operatingBenchmarks = computeOperatingBenchmarkFromAmounts(amounts, {
    nbPortes,
    annee: annee ?? undefined,
  });

  if (
    operatingBenchmarks.revenuBrutParUnite == null &&
    operatingBenchmarks.depensesExploitationParUnite == null
  ) {
    return extracted;
  }

  return { ...extracted, operatingBenchmarks };
}
