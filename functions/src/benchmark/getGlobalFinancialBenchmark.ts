/**
 * Benchmark global — ratios dépense / RBE depuis financial/dataV2 (recyclage legacy).
 * Agrégation anonyme, filtre IQR 1,5×, médianes par poste.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { info as logInfo } from 'firebase-functions/logger';
import type { Firestore } from 'firebase-admin/firestore';
import { getDb } from '../lib/firestore';
import {
  declaredAmountForBenchmarkKey,
  EXPENSE_KEYS_BENCHMARK,
} from './expenseKeysMirror';

const MAX_RESIDENCES = 250;
const BATCH = 30;
const DEFAULT_MIN_SAMPLES = 3;
const MAX_RATIO_PER_LINE = 0.995;

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function excludeResidenceFromBenchmark(residenceData: Record<string, unknown> | undefined): boolean {
  if (!residenceData) return false;
  const qs = residenceData.qualitySnapshot as { status?: string } | undefined;
  if (qs?.status === 'red') return true;
  const st = String(residenceData.statut ?? residenceData.status ?? '').toUpperCase();
  return st === 'INCOMPLETE' || st === 'BROUILLON' || st === 'DRAFT';
}

function medianSorted(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function quartilesSorted(sorted: number[]) {
  if (sorted.length === 0) return { q1: 0, q3: 0 };
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted.slice(0, sorted.length % 2 === 1 ? mid : mid);
  const upper = sorted.slice(sorted.length % 2 === 1 ? mid + 1 : mid);
  return { q1: medianSorted(lower), q3: medianSorted(upper) };
}

function robustMean(ratios: number[], minSamples: number) {
  const rawCount = ratios.length;
  if (rawCount < minSamples) return { mean: null as number | null, usedCount: rawCount, rawCount };

  const sorted = [...ratios].sort((a, b) => a - b);
  const { q1, q3 } = quartilesSorted(sorted);
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  const filtered = sorted.filter((r) => r >= low && r <= high);
  const usedCount = filtered.length;
  if (usedCount < minSamples) return { mean: null, usedCount, rawCount };
  const sum = filtered.reduce((a, b) => a + b, 0);
  return { mean: sum / usedCount, usedCount, rawCount };
}

function medianOf(nums: number[]): number | null {
  const v = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

function sumDeclaredOperatingExpenses(dep: Record<string, unknown>): number {
  let total = 0;
  for (const key of EXPENSE_KEYS_BENCHMARK) {
    total += declaredAmountForBenchmarkKey(dep, key);
  }
  const autres = dep.autresDepenses;
  if (Array.isArray(autres)) {
    for (const row of autres) {
      total += parseNum((row as { montant?: unknown })?.montant);
    }
  }
  return total;
}

function getUnitsFromDocs(
  residenceData: Record<string, unknown>,
  data: Record<string, unknown>
): number {
  const base = (data.baseData ?? {}) as Record<string, unknown>;
  const calc = (data.calculatedResults ?? {}) as Record<string, unknown>;
  return (
    parseNum(residenceData.nombreUnitesTotal) ||
    parseNum(residenceData.nombreUnites) ||
    parseNum(residenceData.capacite) ||
    parseNum(calc.nombreUnites) ||
    parseNum(base.nombreUnites) ||
    0
  );
}

function determineDataV2Year(data: Record<string, unknown>): number {
  const base = (data.baseData ?? {}) as Record<string, unknown>;
  if (base.anneeFinanciere != null && base.anneeFinanciere !== '') {
    const y = parseInt(String(base.anneeFinanciere).trim(), 10);
    if (Number.isFinite(y) && y >= 2000 && y <= 2100) return y;
  }
  if (data.year != null && data.year !== '') {
    const y = parseInt(String(data.year), 10);
    if (Number.isFinite(y) && y >= 2000 && y <= 2100) return y;
  }
  const lu = data.lastUpdated as { toDate?: () => Date } | string | undefined;
  if (lu) {
    const ts =
      typeof lu === 'object' && lu && typeof lu.toDate === 'function'
        ? lu.toDate()
        : new Date(lu as string);
    if (ts instanceof Date && !Number.isNaN(ts.getTime())) return ts.getFullYear();
  }
  return new Date().getFullYear();
}

const GROUP_KEYS_PAYROLL = ['salairesAvantages', 'mainDOeuvreDirecte'];
const GROUP_KEYS_FOOD = ['nourritures'];
const GROUP_KEYS_ENERGY = ['energie'];
const GROUP_KEYS_TAX_INS = ['taxesMunicipalesScolaire', 'assurances', 'taxesPermis'];
const GROUP_KEYS_MAINT = ['entretienReparation'];
const GROUP_KEYS_PRIOR = new Set([
  ...GROUP_KEYS_PAYROLL,
  ...GROUP_KEYS_FOOD,
  ...GROUP_KEYS_ENERGY,
  ...GROUP_KEYS_TAX_INS,
  ...GROUP_KEYS_MAINT,
]);
const GROUP_KEYS_ADMIN_MISC = EXPENSE_KEYS_BENCHMARK.filter((k) => !GROUP_KEYS_PRIOR.has(k));

const BENCHMARK_DISPLAY_GROUPS = [
  { id: 'payroll', labelFr: 'Masse salariale', labelEn: 'Payroll', keys: GROUP_KEYS_PAYROLL },
  { id: 'food', labelFr: 'Alimentation', labelEn: 'Food service', keys: GROUP_KEYS_FOOD },
  { id: 'energy', labelFr: 'Énergie', labelEn: 'Utilities', keys: GROUP_KEYS_ENERGY },
  { id: 'tax_ins', labelFr: 'Taxes et assurances', labelEn: 'Taxes & insurance', keys: GROUP_KEYS_TAX_INS },
  { id: 'maint', labelFr: 'Entretien et réparations', labelEn: 'Maintenance', keys: GROUP_KEYS_MAINT },
  {
    id: 'admin_misc',
    labelFr: 'Administration et divers',
    labelEn: 'Admin & misc',
    keys: GROUP_KEYS_ADMIN_MISC,
  },
];

function sumDepKeys(dep: Record<string, unknown>, keys: readonly string[]): number {
  let s = 0;
  for (const k of keys) s += declaredAmountForBenchmarkKey(dep, k);
  return s;
}

async function persistMarketFinancialBenchmarks(
  db: Firestore,
  payload: {
    medians: Record<string, number | null>;
    means: Record<string, number | null>;
    summary: Record<string, unknown>;
    windowMinYear: number;
    windowMaxYear: number;
    dossierCount: number;
  }
): Promise<void> {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const depensesParClePct: Record<string, number> = {};
  for (const [k, v] of Object.entries(payload.medians)) {
    if (v != null && Number.isFinite(v)) depensesParClePct[k] = Math.round(v * 10000) / 100;
  }

  await db.collection('market_financial_benchmarks').add({
    region: 'Portefeuille',
    regionAdministrative: '00-portefeuille',
    sousType: 'PORTEFEUILLE_GLOBAL',
    siloType: 'rpa_ri_chsld',
    nbPortes: 0,
    nbPortesBand: 'PORTEFEUILLE',
    revenusParPorteAn: payload.summary.medianIncomePerUnit ?? 0,
    depensesParPorteAn: payload.summary.medianExpensePerUnit ?? 0,
    ratioFraisExploitationPct:
      payload.summary.medianExpenseRatio != null
        ? Math.round((payload.summary.medianExpenseRatio as number) * 1000) / 10
        : null,
    depensesParClePctRbe: depensesParClePct,
    meansPctRbe: payload.means,
    mediansPctRbe: payload.medians,
    date,
    anneeDonnees: payload.windowMaxYear,
    provenance: 'etats_financiers',
    injectedAtMillis: Date.now(),
    dossierCount: payload.dossierCount,
    windowMinYear: payload.windowMinYear,
    windowMaxYear: payload.windowMaxYear,
  });
}

export const getGlobalFinancialBenchmark = onCall(
  {
    region: process.env.FUNCTION_REGION || 'us-central1',
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentification requise.');
    }

    const db = getDb();
    const currentYear = new Date().getFullYear();
    const windowMinYear = currentYear - 2;
    const windowMaxYear = currentYear;

    const perKeyRatios: Record<string, number[]> = Object.create(null);
    for (const k of EXPENSE_KEYS_BENCHMARK) perKeyRatios[k] = [];

    const rdeRatios: number[] = [];
    const profitMargins: number[] = [];
    const incomePerUnit: number[] = [];
    const expensePerUnit: number[] = [];
    const groupRatioArrays: Record<string, number[]> = Object.create(null);
    const groupCostPerUnitArrays: Record<string, number[]> = Object.create(null);
    for (const g of BENCHMARK_DISPLAY_GROUPS) {
      groupRatioArrays[g.id] = [];
      groupCostPerUnitArrays[g.id] = [];
    }

    const resSnap = await db.collection('residences').limit(MAX_RESIDENCES).get();
    let dataV2Hits = 0;
    let excludedOutOfRollingWindow = 0;
    let dossiersInRollingWindow = 0;
    let qualityExcluded = 0;

    const docs = resSnap.docs;
    for (let i = 0; i < docs.length; i += BATCH) {
      const slice = docs.slice(i, i + BATCH);
      const fdSnaps = await Promise.all(
        slice.map((d) => db.doc(`residences/${d.id}/financial/dataV2`).get())
      );

      for (let j = 0; j < fdSnaps.length; j += 1) {
        const resDoc = slice[j]!;
        const residenceData = resDoc.data() as Record<string, unknown>;
        if (excludeResidenceFromBenchmark(residenceData)) {
          qualityExcluded += 1;
          continue;
        }

        const fd = fdSnaps[j]!;
        if (!fd.exists) continue;
        const data = fd.data() as Record<string, unknown>;
        const docYear = determineDataV2Year(data);
        if (docYear < windowMinYear || docYear > windowMaxYear) {
          excludedOutOfRollingWindow += 1;
          continue;
        }
        dataV2Hits += 1;

        const calc = (data.calculatedResults ?? {}) as Record<string, unknown>;
        const rbe = parseNum(calc.revenuBrutEffectif);
        if (rbe <= 0) continue;
        dossiersInRollingWindow += 1;

        const base = (data.baseData ?? {}) as Record<string, unknown>;
        const dep = (base.depenses ?? {}) as Record<string, unknown>;
        const units = getUnitsFromDocs(residenceData, data);
        const totalDep = sumDeclaredOperatingExpenses(dep);
        const rde = totalDep > 0 ? totalDep / rbe : null;
        if (rde != null && rde > 0 && rde <= 0.995) {
          rdeRatios.push(rde);
          profitMargins.push(Math.max(0, 1 - rde));
        }
        if (units > 0) {
          incomePerUnit.push(rbe / units);
          if (totalDep >= 0) expensePerUnit.push(totalDep / units);
        }

        for (const key of EXPENSE_KEYS_BENCHMARK) {
          const amt = declaredAmountForBenchmarkKey(dep, key);
          if (amt <= 0) continue;
          const ratio = amt / rbe;
          if (ratio > 0 && ratio <= MAX_RATIO_PER_LINE) perKeyRatios[key]!.push(ratio);
        }

        for (const g of BENCHMARK_DISPLAY_GROUPS) {
          const gAmt = sumDepKeys(dep, g.keys);
          if (gAmt <= 0 || rbe <= 0) continue;
          const gr = gAmt / rbe;
          if (gr > 0 && gr <= MAX_RATIO_PER_LINE) groupRatioArrays[g.id]!.push(gr);
          if (units > 0) groupCostPerUnitArrays[g.id]!.push(gAmt / units);
        }
      }
    }

    const means: Record<string, number | null> = Object.create(null);
    const counts: Record<string, number> = Object.create(null);
    let outliersDropped = 0;

    for (const key of EXPENSE_KEYS_BENCHMARK) {
      const raw = perKeyRatios[key] ?? [];
      const { mean, usedCount, rawCount } = robustMean(raw, DEFAULT_MIN_SAMPLES);
      counts[key] = mean != null ? usedCount : rawCount;
      means[key] = mean;
      if (mean != null && usedCount < rawCount) outliersDropped += rawCount - usedCount;
    }

    const medians: Record<string, number | null> = Object.create(null);
    for (const key of EXPENSE_KEYS_BENCHMARK) {
      const raw = perKeyRatios[key] ?? [];
      medians[key] =
        raw.length >= DEFAULT_MIN_SAMPLES ? medianOf(raw) : null;
    }

    const summary = {
      medianExpenseRatio: medianOf(rdeRatios),
      medianProfitMargin: medianOf(profitMargins),
      medianIncomePerUnit: medianOf(incomePerUnit),
      medianExpensePerUnit: medianOf(expensePerUnit),
      summarySampleCount: Math.max(rdeRatios.length, incomePerUnit.length),
      dossierCount: dossiersInRollingWindow,
      windowMinYear,
      windowMaxYear,
    };

    const benchmarkGroups = BENCHMARK_DISPLAY_GROUPS.map((g) => {
      const ratios = groupRatioArrays[g.id] ?? [];
      const { mean, usedCount, rawCount } = robustMean(ratios, DEFAULT_MIN_SAMPLES);
      return {
        id: g.id,
        labelFr: g.labelFr,
        labelEn: g.labelEn,
        pctOfRevenue: mean,
        avgCostPerUnit: medianOf(groupCostPerUnitArrays[g.id] ?? []),
        ratioSampleCount: mean != null ? usedCount : rawCount,
        costPerUnitSampleCount: (groupCostPerUnitArrays[g.id] ?? []).length,
      };
    });

    logInfo('getGlobalFinancialBenchmark.done', {
      scanned: resSnap.size,
      dataV2Hits,
      dossiersInRollingWindow,
      qualityExcluded,
      outliersDroppedApprox: outliersDropped,
    });

    const result = {
      means,
      medians,
      counts,
      scannedResidences: resSnap.size,
      dataV2DocumentsRead: dataV2Hits,
      excludedOutOfRollingWindow,
      benchmarkWindow: {
        minYear: windowMinYear,
        maxYear: windowMaxYear,
        dossierCount: dossiersInRollingWindow,
        currentYear,
      },
      qualityExcludedCount: qualityExcluded,
      minSamples: DEFAULT_MIN_SAMPLES,
      thresholdFactor: 0.85,
      summary,
      benchmarkGroups,
    };

    try {
      await persistMarketFinancialBenchmarks(db, {
        medians,
        means,
        summary,
        windowMinYear,
        windowMaxYear,
        dossierCount: dossiersInRollingWindow,
      });
    } catch (err) {
      logInfo('getGlobalFinancialBenchmark.persist_skipped', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return result;
  }
);
