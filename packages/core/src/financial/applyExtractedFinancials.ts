/**
 * Injection SSOT — extraction états financiers → financial/dataV2.
 * RBE = revenus totaux ; RNE = RBE − dépenses d'exploitation admissibles (jamais bénéfice net).
 */

import type { OperatingBenchmarkMetrics } from '../documents/extractionSchemas';
import type { FinancialBaseData, FinancialCalc, FinancialDataV2Doc } from './normalizeFinancialData';
import { isNonOpexExpenseKey } from './nonOpexFinancialLines';
import { applyCanonicalMetricsToCalc, resolveCanonicalFinancialMetrics } from './resolveCanonicalRne';

function finitePositive(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

export function buildFinancialDataV2PatchFromExtraction(
  extracted: Record<string, unknown>
): Partial<FinancialDataV2Doc> | null {
  const ob = extracted.operatingBenchmarks as OperatingBenchmarkMetrics | undefined;
  const rbe = finitePositive(ob?.revenuTotal);
  if (rbe == null) return null;

  const depensesExploitation = finitePositive(ob?.depensesExploitation);
  if (depensesExploitation == null || depensesExploitation <= 0) return null;

  const computedRne = Math.round(rbe - depensesExploitation);
  const rne = computedRne;
  if (rne >= rbe || rne <= 0) return null;

  const depenses: Record<string, number> = {};
  if (ob?.depensesParCle) {
    for (const [key, amount] of Object.entries(ob.depensesParCle)) {
      if (!amount || amount <= 0 || isNonOpexExpenseKey(key)) continue;
      depenses[key] = amount;
    }
  }

  const baseData: FinancialBaseData = {
    revenusAnnuels: rbe,
    depenses,
    ...(ob?.nonOpexExcluded ? { nonOpexExcluded: ob.nonOpexExcluded } : {}),
    ...(ob?.nbPortes ? { nombreUnites: ob.nbPortes } : {}),
  };

  const calculatedResults: FinancialCalc = {
    revenusAnnuels: rbe,
    revenuBrutEffectif: rbe,
    revenuNetExploitation: rne,
    depensesTotales: depensesExploitation,
    depensesTotalesNormalisees: depensesExploitation,
    facteurDepenses: rbe > 0 ? depensesExploitation / rbe : null,
    _source: 'document_extraction',
    _confidence: 'high',
  };

  return { baseData, calculatedResults };
}

/** Recalcule calculatedResults depuis baseData (SSOT injection / merge Firestore). */
export function recomputeFinancialCalculatedResults(
  baseData: FinancialBaseData | null | undefined,
  existingCalc?: FinancialCalc | null
): FinancialCalc | null {
  if (!baseData) return null;
  const seed: FinancialCalc = {
    ...(existingCalc ?? {}),
    revenusAnnuels:
      finitePositive(baseData.revenusAnnuels) ??
      finitePositive(existingCalc?.revenuBrutEffectif) ??
      finitePositive(existingCalc?.revenusAnnuels) ??
      null,
    revenuBrutEffectif:
      finitePositive(baseData.revenusAnnuels) ??
      finitePositive(existingCalc?.revenuBrutEffectif) ??
      null,
  };
  const metrics = resolveCanonicalFinancialMetrics(seed, baseData);
  if (metrics.rbe == null) return null;
  return applyCanonicalMetricsToCalc(seed, baseData);
}
