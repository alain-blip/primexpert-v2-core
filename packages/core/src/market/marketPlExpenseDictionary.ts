/**
 * Dictionnaire exhaustif des postes P&L — Dashboard GPS (SSOT).
 * Aligné sur expenseFields / expenseKeys + libellés extraits par l'IA.
 */

import { EXPENSE_FIELDS } from '../financial/expenseFields';

export type PlExpenseGroup = 'fixes' | 'operationnelles' | 'gestion';

export interface ExpenseLineMeta {
  labelFr: string;
  labelEn: string;
  group: PlExpenseGroup;
  /** Poste résiduel mineur — fourre-tout strict. */
  isResidual?: boolean;
}

/** Métadonnées par clé canonique (SSOT affichage + regroupement). */
export const EXPENSE_LINE_META: Record<string, ExpenseLineMeta> = {};

for (const field of EXPENSE_FIELDS) {
  EXPENSE_LINE_META[field.key] = {
    labelFr: field.label,
    labelEn: field.labelEn,
    group: classifyExpenseGroupForKey(field.key),
  };
}

/** Rétrocompatibilité clés courtes héritées V1 / agrégats. */
const LEGACY_KEY_ALIASES: Record<string, string> = {
  energie: 'energie',
  assurance: 'assurances',
  assurances: 'assurances',
  taxes: 'taxesPermis',
  salaires: 'salairesAvantages',
  nourriture: 'nourritures',
  entretien: 'entretienReparation',
  gestion: 'fraisGestion',
  administration: 'fournituresBureau',
  autre: 'divers',
};

Object.assign(EXPENSE_LINE_META, {
  energie: { labelFr: 'Énergie', labelEn: 'Energy', group: 'fixes' },
  assurances: { labelFr: 'Assurances', labelEn: 'Insurance', group: 'fixes' },
  taxesPermis: { labelFr: 'Taxes et permis', labelEn: 'Taxes and permits', group: 'fixes' },
  salairesAvantages: {
    labelFr: "Salaires et charges sociales",
    labelEn: 'Salaries & benefits',
    group: 'operationnelles',
  },
  nourritures: { labelFr: 'Achats de nourriture', labelEn: 'Food purchases', group: 'operationnelles' },
  entretienReparation: {
    labelFr: 'Entretien / Réparation',
    labelEn: 'Maintenance / repairs',
    group: 'operationnelles',
  },
  fraisGestion: { labelFr: 'Frais de gestion', labelEn: 'Management fees', group: 'gestion' },
  divers: {
    labelFr: 'Divers (résiduel)',
    labelEn: 'Miscellaneous (residual)',
    group: 'operationnelles',
    isResidual: true,
  },
  'poste:reserve_structurale': {
    labelFr: 'Réserve structurale',
    labelEn: 'Replacement reserve',
    group: 'operationnelles',
  },
  autre: {
    labelFr: "Autres dépenses d'exploitation (résiduel)",
    labelEn: 'Other operating expenses (residual)',
    group: 'operationnelles',
    isResidual: true,
  },
});

/** Ordre d'affichage comptable (fixes → opérationnelles → gestion → résiduel). */
const DISPLAY_ORDER: string[] = [
  'energie',
  'assurances',
  'taxesPermis',
  'taxesMunicipalesScolaire',
  'taxesScolaires',
  'locationEquipements',
  'locationEntrepot',
  'ascenseur',
  'mainDOeuvreDirecte',
  'salairesAvantages',
  'nourritures',
  'fournituresCuisine',
  'entretienReparation',
  'fournituresEntretien',
  'fournituresEntretienMenager',
  'fournituresGenerales',
  'fournituresMedicales',
  'telecommunications',
  'publicite',
  'fraisRepresentation',
  'fraisDeplacements',
  'fraisFormation',
  'fraisLoisir',
  'fournituresBureau',
  'honorairesProfessionnels',
  'honoraireAgencePlacement',
  'agencePlacement',
  'comptabilite',
  'fraisLegaux',
  'fraisGeneraux',
  'sousTraitance',
  'interetsBancaires',
  'interetsDetteLP',
  'amortissement',
  'fraisGestion',
  'divers',
  'autre',
];

/** Motifs label → clé (ordre = priorité). */
const LABEL_PATTERNS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /rde|ratio des d[eé]penses|operating expense ratio|oer/i, key: 'rde' },
  { pattern: /^rbe\b|revenu brut effectif|effective gross|egi/i, key: 'rbe' },
  { pattern: /^rne\b|revenu net d.exploitation|net operating income|\bnoi\b/i, key: 'rne' },
  { pattern: /main d['']?[oœ]uvre directe|direct labour|direct labor/i, key: 'mainDOeuvreDirecte' },
  { pattern: /salaire|salary|charges sociales|payroll|personnel/i, key: 'salairesAvantages' },
  { pattern: /t[eé]l[eé]com|c[aâ]blodistribution|t[eé]l[eé]phon/i, key: 'telecommunications' },
  { pattern: /[eé]nergie|\benergy\b|electricit|hydro|gaz naturel/i, key: 'energie' },
  { pattern: /assurance|\binsurance\b/i, key: 'assurances' },
  { pattern: /taxe municip|taxe scol|school tax|municipal tax/i, key: 'taxesMunicipalesScolaire' },
  { pattern: /taxe|taxes|\btax\b|permis/i, key: 'taxesPermis' },
  { pattern: /nourriture|food|alimentation|repas|achats de nourriture/i, key: 'nourritures' },
  { pattern: /fourniture.*bureau|office supply|papeterie|poste/i, key: 'fournituresBureau' },
  { pattern: /fourniture.*cuisine|kitchen supply/i, key: 'fournituresCuisine' },
  { pattern: /fourniture.*entretien|cleaning supply|entretien m[eé]nager/i, key: 'fournituresEntretienMenager' },
  { pattern: /fourniture.*m[eé]dic|medical supply/i, key: 'fournituresMedicales' },
  { pattern: /fourniture/i, key: 'fournituresGenerales' },
  { pattern: /d[eé]placement|travel|kilom[eé]trage|automobile/i, key: 'fraisDeplacements' },
  { pattern: /honoraire|professional fee|comptab|notair|avocat/i, key: 'honorairesProfessionnels' },
  { pattern: /repr[eé]sentation|entertainment/i, key: 'fraisRepresentation' },
  { pattern: /publicit[eé]|advertis|marketing/i, key: 'publicite' },
  { pattern: /entretien|r[eé]paration|maintenance|\brepair/i, key: 'entretienReparation' },
  { pattern: /formation|training/i, key: 'fraisFormation' },
  { pattern: /loisir|r[eé]cr[eé]atif|recreation/i, key: 'fraisLoisir' },
  { pattern: /gestion|management fee/i, key: 'fraisGestion' },
  { pattern: /agence.*placement|placement agency/i, key: 'agencePlacement' },
  { pattern: /sous.?trait|subcontract/i, key: 'sousTraitance' },
  { pattern: /int[eé]r[eê]t|interest expense/i, key: 'interetsBancaires' },
  { pattern: /amortissement|depreciation/i, key: 'amortissement' },
  { pattern: /location.*[eé]quipement|equipment rent/i, key: 'locationEquipements' },
  { pattern: /location.*entrep[oô]t|warehouse rent/i, key: 'locationEntrepot' },
  { pattern: /ascenseur|elevator/i, key: 'ascenseur' },
  { pattern: /l[eé]gal|legal fee/i, key: 'fraisLegaux' },
  { pattern: /administration|\badmin\b/i, key: 'fraisGeneraux' },
  { pattern: /^autre(s)?\s|autres d[eé]penses|miscellaneous|\bdivers\b|^other\b/i, key: 'divers' },
  { pattern: /r[eé]serve structurale|replacement reserve|reserve structurale/i, key: 'poste:reserve_structurale' },
  { pattern: /valeur [eé]valu[eé]e|evaluated value/i, key: 'valeurEvaluee' },
  { pattern: /revenu brut potentiel|potential gross income/i, key: 'rbPotentiel' },
  { pattern: /revenu net effectif|\bnoi\b|net operating income/i, key: 'rne' },
  { pattern: /^revenu net\b|\bnet income\b/i, key: 'rne' },
];

/** Fusion de clés proches (extractions IA redondantes). */
const LABEL_KEY_MERGE_ALIASES: Record<string, string> = {
  'poste:reserve_structurale_immeuble': 'poste:reserve_structurale',
  'poste:reserve_structurale_batiment': 'poste:reserve_structurale',
  'poste:reserve_structurale_batisse': 'poste:reserve_structurale',
  'poste:reserve_de_replacement': 'poste:reserve_structurale',
  'poste:reserve_replacement': 'poste:reserve_structurale',
  'poste:reserve_structurale_immeuble_entier': 'poste:reserve_structurale',
  valeurEvaluee: 'valeurEvaluee',
  rbPotentiel: 'rbPotentiel',
};

export function mergeMarketLabelKey(labelKey: string, labelDisplay: string): string {
  const display = labelDisplay
    .replace(/\s*[—–-]\s*(par unit[eé]|par porte|\/\s*unit[eé]|annuel|ratio\s*\(?%?\)?|ratio).*$/i, '')
    .trim()
    .toLowerCase();

  if (/r[eé]serve structurale/.test(display)) return 'poste:reserve_structurale';

  const fromAlias = LABEL_KEY_MERGE_ALIASES[labelKey];
  if (fromAlias) return fromAlias;

  if (labelKey.startsWith('poste:reserve_structurale')) return 'poste:reserve_structurale';

  return labelKey;
}

export function classifyExpenseGroupForKey(labelKey: string): PlExpenseGroup {
  switch (labelKey) {
    case 'energie':
    case 'assurances':
    case 'taxesPermis':
    case 'taxesMunicipalesScolaire':
    case 'taxesScolaires':
    case 'locationEquipements':
    case 'locationEntrepot':
    case 'ascenseur':
      return 'fixes';
    case 'fraisGestion':
    case 'honorairesProfessionnels':
    case 'honoraireAgencePlacement':
    case 'comptabilite':
    case 'fraisLegaux':
    case 'agencePlacement':
      return 'gestion';
    default:
      return 'operationnelles';
  }
}

export function classifyExpenseGroup(labelKey: string): PlExpenseGroup {
  const canonical = LEGACY_KEY_ALIASES[labelKey] ?? labelKey;
  return EXPENSE_LINE_META[canonical]?.group ?? classifyExpenseGroupForKey(canonical);
}

export function isResidualExpenseKey(labelKey: string): boolean {
  const canonical = LEGACY_KEY_ALIASES[labelKey] ?? labelKey;
  return Boolean(EXPENSE_LINE_META[canonical]?.isResidual);
}

function stripMeasurementSuffix(label: string): string {
  return label
    .replace(/\s*[—–-]\s*(par unit[eé]|par porte|\/\s*unit[eé]|annuel|ratio\s*\(?%?\)?|ratio).*$/i, '')
    .trim();
}

function slugifyLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

function resolveCanonicalKey(rawKey: string): string {
  return LEGACY_KEY_ALIASES[rawKey] ?? rawKey;
}

export function canonicalExpenseKey(labelKey: string): string {
  return resolveCanonicalKey(labelKey);
}

/** Clé de regroupement ratio — granularité complète (pas de fourre-tout sauf résiduel explicite). */
export function normalizeRatioLabelKey(label: string): string {
  const cleaned = stripMeasurementSuffix(label.trim());
  if (!cleaned) return 'divers';

  for (const { pattern, key } of LABEL_PATTERNS) {
    if (pattern.test(cleaned)) return key;
  }

  for (const field of EXPENSE_FIELDS) {
    if (cleaned.toLowerCase() === field.label.toLowerCase()) return field.key;
    if (cleaned.toLowerCase() === field.labelEn.toLowerCase()) return field.key;
  }

  const slug = slugifyLabel(cleaned);
  if (!slug) return 'divers';
  return mergeMarketLabelKey(`poste:${slug}`, cleaned);
}

export function resolveExpenseLineMeta(
  labelKey: string,
  labelDisplay?: string
): ExpenseLineMeta {
  const canonical = resolveCanonicalKey(labelKey);
  const meta = EXPENSE_LINE_META[canonical];
  if (meta) return meta;

  const display = labelDisplay?.trim() || labelKey.replace(/^poste:/, '').replace(/_/g, ' ');
  return {
    labelFr: display,
    labelEn: display,
    group: classifyExpenseGroup(canonical),
  };
}

export function compareExpenseLineKeys(a: string, b: string): number {
  const rank = (key: string): number => {
    const canonical = resolveCanonicalKey(key);
    if (EXPENSE_LINE_META[canonical]?.isResidual) return 10_000;
    const idx = DISPLAY_ORDER.indexOf(canonical);
    if (idx >= 0) return idx;
    if (canonical.startsWith('poste:')) return 9_000;
    return 8_000;
  };
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  return resolveCanonicalKey(a).localeCompare(resolveCanonicalKey(b), 'fr-CA');
}

/** Libellé d'affichage dominant pour une clé à partir des échantillons. */
export function dominantLabelDisplay(
  labelKey: string,
  samples: Array<{ labelKey: string; labelDisplay: string }>
): string | undefined {
  const counts = new Map<string, number>();
  for (const s of samples) {
    if (s.labelKey !== labelKey || !s.labelDisplay?.trim()) continue;
    const d = stripMeasurementSuffix(s.labelDisplay.trim());
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [label, n] of counts) {
    if (n > bestN) {
      best = label;
      bestN = n;
    }
  }
  return best;
}
