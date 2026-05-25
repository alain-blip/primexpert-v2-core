/**
 * Lignes hors exploitation — exclues du RNE (SSOT CPA / OACIQ).
 * Ne pas confondre avec le bénéfice net ni les frais financiers.
 */

/** Clés Firestore historiques à exclure des totaux OPEX. */
export const NON_OPEX_EXPENSE_KEYS = [
  'amortissement',
  'interetsBancaires',
  'interetsDetteLP',
] as const;

export type NonOpexExpenseKey = (typeof NON_OPEX_EXPENSE_KEYS)[number];

export interface NonOpexExcludedTotals {
  amortissement: number | null;
  fraisFinanciers: number | null;
  impotsSurLeRevenu: number | null;
  beneficeNetExtrait: number | null;
}

const NET_INCOME_LINE_PATTERN =
  /benefice\s+net|bénéfice\s+net|perte\s+nette|profit\s+net|net\s+(income|earnings|profit|loss)|resultat\s+net|marge\s+nette/i;

const NON_OPEX_LABEL_PATTERN =
  /amortissement|depreciation|dotation\s+(aux\s+)?amort|frais\s+financier|charges\s+financier|interet|intérêt|interest\s+expense|interest\s+paid|financement\s+(de\s+la\s+)?dette|frais\s+bancair|impot\s+sur\s+le\s+revenu|impôts\s+sur\s+le\s+revenu|income\s+tax|taxe\s+sur\s+le\s+revenu/i;

const REVENUE_TOTAL_PRIORITY_PATTERN =
  /^(produits?\s+totaux?|revenus?\s+totaux?|chiffre\s+d.?affaires(\s+total)?|total\s+des\s+revenus|revenu\s+brut\s+effectif|effective\s+gross\s+income|gross\s+revenue)/i;

export function normalizeFinancialLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isNetIncomeBottomLineLabel(label: string): boolean {
  return NET_INCOME_LINE_PATTERN.test(normalizeFinancialLabel(label));
}

export function isNonOpexExpenseLabel(label: string): boolean {
  const n = normalizeFinancialLabel(label);
  if (!n) return false;
  if (isNetIncomeBottomLineLabel(label)) return true;
  return NON_OPEX_LABEL_PATTERN.test(n);
}

export function isNonOpexExpenseKey(key: string): boolean {
  return (NON_OPEX_EXPENSE_KEYS as readonly string[]).includes(key);
}

export function isRevenueTotalPriorityLabel(label: string): boolean {
  return REVENUE_TOTAL_PRIORITY_PATTERN.test(normalizeFinancialLabel(label));
}

export function extractNonOpexExcludedFromLabeledAmounts(
  rows: ReadonlyArray<{ label: string; value: number }>
): NonOpexExcludedTotals {
  let amortissement: number | null = null;
  let fraisFinanciers: number | null = null;
  let impotsSurLeRevenu: number | null = null;
  let beneficeNetExtrait: number | null = null;

  const add = (current: number | null, value: number): number =>
    current == null ? value : current + value;

  for (const row of rows) {
    const label = String(row.label ?? '').trim();
    const v = row.value;
    if (!label || !Number.isFinite(v) || v === 0) continue;
    const n = normalizeFinancialLabel(label);

    if (isNetIncomeBottomLineLabel(label)) {
      beneficeNetExtrait = add(beneficeNetExtrait, v);
      continue;
    }
    if (!isNonOpexExpenseLabel(label)) continue;

    if (/amortissement|depreciation|dotation/.test(n)) {
      amortissement = add(amortissement, v);
    } else if (/impot|impôt|income\s+tax/.test(n)) {
      impotsSurLeRevenu = add(impotsSurLeRevenu, v);
    } else if (/interet|intérêt|interest|financier|bancair|financement/.test(n)) {
      fraisFinanciers = add(fraisFinanciers, v);
    }
  }

  return { amortissement, fraisFinanciers, impotsSurLeRevenu, beneficeNetExtrait };
}
