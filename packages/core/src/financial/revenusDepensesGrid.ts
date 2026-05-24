/**
 * Grille Revenus & Dépenses — calculs SSOT (zéro calcul dans l'UI).
 */

import { EXPENSE_FIELDS } from './expenseFields';
import { MARKET_REF_PCT_OF_RBE } from './expenseFields';
import {
  lineTriggersPortfolioBenchmarkAlert,
  marketAmountFromMedianRatio,
  marketPctFromMedianRatio,
  PORTFOLIO_EXPENSE_RATIO_TOLERANCE,
} from './globalFinancialBenchmark';
import {
  normalizeFinancialData,
  normalizedOperatingAmount,
  sumNormalizedOperatingExpenses,
  type FinancialDataV2Doc,
  type ResidenceFinancialHints,
} from './normalizeFinancialData';

export interface ExpenseVerificationA2 {
  obtained: boolean;
  note: string;
}

export interface PortfolioBenchmarkInput {
  medians: Record<string, number | null> | null;
  thresholdFactor?: number;
}

export interface RevenusDepensesGridOptions {
  expenseAdjustmentsOverride?: Record<string, unknown>;
  portfolioBenchmark?: PortfolioBenchmarkInput;
}

export interface RevenusDepensesExpenseRow {
  kind: 'standard' | 'autre';
  key: string;
  index?: number;
  label: string;
  declared: number;
  adjustment: number;
  normalized: number;
  pctOfRbe: number | null;
  marketRefPct: number | null;
  marketAmount: number | null;
  vendorBelowMarket: boolean;
  verification: ExpenseVerificationA2;
  isPrimary: boolean;
}

export interface RevenusDepensesGridModel {
  hasFinancials: boolean;
  source: string;
  rbe: number | null;
  revenusAnnuels: number | null;
  depensesDeclareesTotal: number | null;
  depensesNormaliseesTotal: number | null;
  noiDeclare: number | null;
  noiNormalise: number | null;
  rows: RevenusDepensesExpenseRow[];
  provenance: {
    lastUpdated: unknown;
    source: string;
    confidenceTier: 'high' | 'medium' | 'low' | 'validation_required';
    coveragePercent: number | null;
  };
}

function parseNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = typeof val === 'string' ? parseFloat(String(val).replace(/[^\d.-]/g, '')) : Number(val);
  return Number.isFinite(n) ? n : 0;
}

function pctOfRbe(amount: number, rbe: number): number | null {
  if (!rbe || rbe <= 0 || !amount) return null;
  return (amount / rbe) * 100;
}

function resolveMarketForRow(
  expenseKey: string,
  rbe: number,
  portfolio?: PortfolioBenchmarkInput
): { marketAmount: number | null; marketRefPct: number | null } {
  const medianRatio = portfolio?.medians?.[expenseKey];
  const fromPortfolio = marketAmountFromMedianRatio(medianRatio, rbe);
  if (fromPortfolio != null) {
    return {
      marketAmount: fromPortfolio,
      marketRefPct: marketPctFromMedianRatio(medianRatio),
    };
  }
  const staticPct = MARKET_REF_PCT_OF_RBE[expenseKey];
  if (staticPct != null && rbe > 0) {
    return {
      marketAmount: (staticPct / 100) * rbe,
      marketRefPct: staticPct,
    };
  }
  return { marketAmount: null, marketRefPct: staticPct ?? null };
}

function mergeVerification(
  verifiedRaw: Record<string, unknown> | undefined,
  key: string
): ExpenseVerificationA2 {
  const r = verifiedRaw?.[key];
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    const o = r as { obtained?: boolean; note?: string };
    return { obtained: !!o.obtained, note: o.note != null ? String(o.note) : '' };
  }
  return { obtained: false, note: '' };
}

function mergeVerificationAutre(
  verifiedRaw: Record<string, unknown> | undefined,
  index: number
): ExpenseVerificationA2 {
  const arr = verifiedRaw?.autres;
  if (!Array.isArray(arr)) return { obtained: false, note: '' };
  const r = arr[index];
  if (r && typeof r === 'object') {
    const o = r as { obtained?: boolean; note?: string };
    return { obtained: !!o.obtained, note: o.note != null ? String(o.note) : '' };
  }
  return { obtained: false, note: '' };
}

function inferConfidence(
  source: string,
  rowCount: number
): 'high' | 'medium' | 'low' | 'validation_required' {
  if (source === 'none' || rowCount === 0) return 'validation_required';
  if (source === 'calculatedResults') return 'high';
  if (source === 'derivedData') return 'medium';
  return 'medium';
}

export function buildRevenusDepensesGrid(
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints = {},
  options: RevenusDepensesGridOptions = {}
): RevenusDepensesGridModel {
  const { calc, baseData, hasFinancials, source } = normalizeFinancialData(financialData, residence);
  const depenses = baseData?.depenses ?? null;
  const expenseAdjustments = {
    ...((baseData?.expenseAdjustments ?? {}) as Record<string, unknown>),
    ...(options.expenseAdjustmentsOverride ?? {}),
  };
  const verified = (expenseAdjustments.verified ?? {}) as Record<string, unknown>;
  const threshold =
    options.portfolioBenchmark?.thresholdFactor ?? PORTFOLIO_EXPENSE_RATIO_TOLERANCE;

  const rbe =
    parseNum(calc?.revenuBrutEffectif) ||
    parseNum(calc?.revenusAnnuels) ||
    parseNum(baseData?.revenusAnnuels) ||
    0;

  const rows: RevenusDepensesExpenseRow[] = [];

  if (depenses && typeof depenses === 'object') {
    for (const field of EXPENSE_FIELDS) {
      const declared = parseNum(depenses[field.key]);
      const adjustment = parseNum(expenseAdjustments[field.key]);
      const normalized = normalizedOperatingAmount(field.key, depenses, expenseAdjustments);
      if (declared === 0 && adjustment === 0 && normalized === 0) continue;

      const { marketAmount, marketRefPct } = resolveMarketForRow(
        field.key,
        rbe,
        options.portfolioBenchmark
      );

      rows.push({
        kind: 'standard',
        key: field.key,
        label: field.label,
        declared,
        adjustment,
        normalized,
        pctOfRbe: pctOfRbe(declared, rbe),
        marketRefPct,
        marketAmount,
        vendorBelowMarket: lineTriggersPortfolioBenchmarkAlert(
          declared,
          marketAmount,
          threshold
        ),
        verification: mergeVerification(verified, field.key),
        isPrimary: Boolean(field.isPrimary),
      });
    }

    const autres = depenses.autresDepenses ?? [];
    autres.forEach((dep, index) => {
      const declared = parseNum(dep?.montant);
      const autresAdj = expenseAdjustments.autresDepenses;
      const adjustment = Array.isArray(autresAdj) ? parseNum(autresAdj[index]) : 0;
      if (declared === 0 && adjustment === 0) return;
      rows.push({
        kind: 'autre',
        key: `autre-${index}`,
        index,
        label: dep?.nom?.trim() ? String(dep.nom) : `Autre dépense ${index + 1}`,
        declared,
        adjustment,
        normalized: declared + adjustment,
        pctOfRbe: pctOfRbe(declared, rbe),
        marketRefPct: null,
        marketAmount: null,
        vendorBelowMarket: false,
        verification: mergeVerificationAutre(verified, index),
        isPrimary: false,
      });
    });
  }

  const depensesNormaliseesTotal = depenses
    ? sumNormalizedOperatingExpenses(depenses, expenseAdjustments)
    : parseNum(calc?.depensesTotalesNormalisees) || null;

  let depensesDeclareesTotal = 0;
  let hasDeclared = false;
  for (const row of rows) {
    depensesDeclareesTotal += row.declared;
    if (row.declared !== 0) hasDeclared = true;
  }

  const noiDeclare =
    rbe > 0 && hasDeclared
      ? rbe - depensesDeclareesTotal
      : parseNum(calc?.revenuNetExploitation) || null;
  const noiNormalise =
    rbe > 0 && depensesNormaliseesTotal != null ? rbe - depensesNormaliseesTotal : null;

  const fd = financialData as Record<string, unknown> | null;
  const lastUpdated = fd?.lastUpdated ?? fd?.updatedAt ?? null;
  const confidenceTier = inferConfidence(source, rows.length);
  const coveragePercent =
    rows.length > 0
      ? Math.min(100, Math.round((rows.filter((r) => r.declared > 0).length / 11) * 100))
      : 0;

  return {
    hasFinancials,
    source,
    rbe: rbe > 0 ? rbe : null,
    revenusAnnuels: parseNum(baseData?.revenusAnnuels) || rbe || null,
    depensesDeclareesTotal: hasDeclared ? depensesDeclareesTotal : null,
    depensesNormaliseesTotal,
    noiDeclare,
    noiNormalise,
    rows,
    provenance: {
      lastUpdated,
      source,
      confidenceTier,
      coveragePercent: hasFinancials ? coveragePercent : null,
    },
  };
}
