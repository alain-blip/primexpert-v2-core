/**
 * Catalogue des postes de dépenses admissibles — tendances ACM (SSOT grille financière).
 */

import { EXPENSE_FIELDS } from '../financial/expenseFields';
import { isNonOpexExpenseKey } from '../financial/nonOpexFinancialLines';
import { EXPENSE_LINE_META, canonicalExpenseKey } from './marketPlExpenseDictionary';
import { cleanseMarketRegion, type MarketGpsRatioSample } from './marketGpsViewModel';

/** Postes OPEX affichables en tendances ACM (exclut amortissement, intérêts). */
export const ACM_TREND_EXPENSE_KEYS: string[] = EXPENSE_FIELDS.map((f) => f.key).filter(
  (key) => !isNonOpexExpenseKey(key)
);

const ORDER_INDEX = new Map(ACM_TREND_EXPENSE_KEYS.map((k, i) => [k, i]));

export function expenseTrendLabel(key: string, locale: 'fr' | 'en'): string {
  const meta = EXPENSE_LINE_META[key];
  if (meta) return locale === 'fr' ? meta.labelFr : meta.labelEn;
  return key;
}

/** Clés à graphiquer : toutes les catégories extraites du sujet, sinon catalogue complet. */
export function resolveAcmTrendExpenseKeys(
  subjectExpenses?: Partial<Record<string, number>>
): string[] {
  const fromSubject = Object.entries(subjectExpenses ?? {})
    .filter(([, amount]) => typeof amount === 'number' && amount > 0)
    .map(([key]) => key)
    .filter((key) => !isNonOpexExpenseKey(key));

  const keys =
    fromSubject.length > 0 ? [...new Set(fromSubject)] : [...ACM_TREND_EXPENSE_KEYS];

  return keys.sort((a, b) => (ORDER_INDEX.get(a) ?? 999) - (ORDER_INDEX.get(b) ?? 999));
}

export function hasGpsSamplesForExpenseKey(
  ratioSamples: MarketGpsRatioSample[],
  key: string,
  region?: string
): boolean {
  return ratioSamples.some((s) => {
    if (canonicalExpenseKey(s.labelKey) !== key || s.montantParPorte == null) return false;
    if (!region || region === 'all') return true;
    return cleanseMarketRegion(s.region) === region;
  });
}
