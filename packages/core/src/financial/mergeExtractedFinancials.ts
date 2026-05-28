/**
 * Fusion partielle extraction IA → financial/dataV2 (Hub Finance).
 * Met à jour uniquement les blocs présents dans l'extraction (revenus OU dépenses).
 */

import {
  enrichExtractedDataWithOperatingBenchmarks,
  type OperatingBenchmarkMetrics,
} from '../documents/extractionSchemas';
import { recomputeFinancialCalculatedResults } from './applyExtractedFinancials';
import type { FinancialBaseData, FinancialCalc, FinancialDataV2Doc } from './normalizeFinancialData';
import { isNonOpexExpenseKey } from './nonOpexFinancialLines';

function finitePositive(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function withOperatingBenchmarks(extracted: Record<string, unknown>): Record<string, unknown> {
  if (extracted.operatingBenchmarks) return extracted;
  const amounts = Array.isArray(extracted.amounts) ? extracted.amounts : [];
  const revenus = Array.isArray(extracted.revenus) ? extracted.revenus : [];
  const depenses = Array.isArray(extracted.depenses) ? extracted.depenses : [];
  const taxes = Array.isArray(extracted.taxes) ? extracted.taxes : [];
  if (!amounts.length && !revenus.length && !depenses.length && !taxes.length) {
    return extracted;
  }
  return enrichExtractedDataWithOperatingBenchmarks(extracted);
}

export interface MergeExtractedFinancialInput {
  existing: FinancialDataV2Doc | null;
  extracted: Record<string, unknown>;
  /** Montants par clé dépense (validation courtier ou auto-mapping). */
  expensePatchFromRows?: Record<string, number>;
  /** false = ne pas toucher au RBE existant. */
  mergeRevenues?: boolean;
  /** false = ne pas toucher aux dépenses existantes. */
  mergeExpenses?: boolean;
}

export interface MergeExtractedFinancialResult {
  doc: FinancialDataV2Doc;
  touchedRevenues: boolean;
  touchedExpenses: boolean;
}

/** Indique si l'extraction peut modifier le RBE (confirmation courtier recommandée). */
export function extractedPatchTouchesRevenues(extracted: Record<string, unknown>): boolean {
  const enriched = withOperatingBenchmarks(extracted);
  const ob = enriched.operatingBenchmarks as OperatingBenchmarkMetrics | undefined;
  return finitePositive(ob?.revenuTotal) != null;
}

export function mergeExtractedIntoFinancialDataV2(
  input: MergeExtractedFinancialInput
): MergeExtractedFinancialResult | null {
  const { existing, extracted, expensePatchFromRows } = input;
  const mergeRevenues = input.mergeRevenues !== false;
  const mergeExpenses = input.mergeExpenses !== false;

  const enriched = withOperatingBenchmarks(extracted);
  const ob = enriched.operatingBenchmarks as OperatingBenchmarkMetrics | undefined;

  const base: FinancialBaseData = { ...(existing?.baseData ?? {}) };
  const existingDep = (base.depenses ?? {}) as Record<string, number>;
  const depPatch: Record<string, number> = { ...existingDep };

  let touchedRevenues = false;
  let touchedExpenses = false;

  if (mergeRevenues) {
    const rbe = finitePositive(ob?.revenuTotal);
    if (rbe != null) {
      base.revenusAnnuels = rbe;
      touchedRevenues = true;
    }
  }

  if (ob?.nbPortes != null && ob.nbPortes > 0) {
    base.nombreUnites = ob.nbPortes;
  }

  if (mergeExpenses && ob?.depensesParCle) {
    for (const [key, amount] of Object.entries(ob.depensesParCle)) {
      if (!amount || amount <= 0 || isNonOpexExpenseKey(key)) continue;
      depPatch[key] = amount;
      touchedExpenses = true;
    }
  }

  if (expensePatchFromRows) {
    for (const [key, amount] of Object.entries(expensePatchFromRows)) {
      if (amount > 0) {
        depPatch[key] = amount;
        touchedExpenses = true;
      }
    }
  }

  if (ob?.nonOpexExcluded && Object.keys(ob.nonOpexExcluded).length > 0) {
    base.nonOpexExcluded = {
      ...(base.nonOpexExcluded ?? {}),
      ...ob.nonOpexExcluded,
    };
  }

  if (typeof enriched.annee === 'number' && enriched.annee > 1990 && enriched.annee < 2100) {
    (base as Record<string, unknown>).anneeFiscale = enriched.annee;
  }

  if (touchedExpenses || Object.keys(depPatch).length > 0) {
    base.depenses = depPatch;
  }

  if (!touchedRevenues && !touchedExpenses) return null;

  const calculatedResults = recomputeFinancialCalculatedResults(
    base,
    existing?.calculatedResults ?? null
  );

  const calc: FinancialCalc | null = calculatedResults
    ? {
        ...calculatedResults,
        _source: 'document_extraction',
        _confidence: 'validation_required',
      }
    : existing?.calculatedResults ?? null;

  return {
    doc: {
      baseData: base,
      calculatedResults: calc,
    },
    touchedRevenues,
    touchedExpenses,
  };
}
