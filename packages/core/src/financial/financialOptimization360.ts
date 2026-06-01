/**
 * Vérification de performance 360° — Manque à gagner / Lost Profits (SSOT).
 * Compare RBE/NOI actuel vs références marché (grille CPA normalisée + % sectoriels RPA).
 * Impact valeur : NOI latent ÷ taux de capitalisation (ou repli TGA 10 %).
 */

import { EXPENSE_FIELDS, MARKET_REF_PCT_OF_RBE } from './expenseFields';
import { EXPENSE_KEYS } from './expenseKeys';
import { OPTIMIZATION_360_RULES } from './financialRules';
import {
  normalizedOperatingAmount,
  sumNormalizedOperatingExpenses,
  type FinancialCalc,
  type FinancialBaseData,
} from './normalizeFinancialData';
import { resolvePrixDemande } from './computeFinancabilite';
import { normalizeTgaPct } from './capitalization';
import { safeNum } from './safeNumbers';

const OPS_ENERGY_KEYS = ['energie', 'entretienReparation'] as const;

export interface PortfolioBenchmarkContext {
  means: Record<string, number>;
  counts: Record<string, number>;
  minSamples: number;
  source: 'portfolio' | 'sector_ref';
}

export interface LostProfitsLeverRow {
  id: string;
  leverFr: string;
  leverEn: string;
  constatFr: string;
  constatEn: string;
  noiGapAnnual: number;
  valueImpact: number;
  direction: 'recover' | 'loss';
}

export interface ExpenseVarianceRow {
  key: string;
  label: string;
  actualNorm: number;
  benchmarkDollar: number;
  ecartDollar: number;
  valueImpact: number;
}

export interface LostProfits360Result {
  hasData: boolean;
  insufficientReasonFr: string | null;
  insufficientReasonEn: string | null;
  rbe: number;
  noiDeclared: number | null;
  noiNormalized: number | null;
  units: number;
  capRatePct: number;
  capRateSource: 'fiche' | 'default';
  loyerReelMensuel: number | null;
  loyerMarcheMensuel: number | null;
  rows: LostProfitsLeverRow[];
  totalNoiGapAnnual: number;
  totalValueImpact: number;
  valeurRecuperable: number;
  valeurPerdue: number;
  basePrice: number;
  targetOptimizedPrice: number;
  gaugeLostPct: number;
  gaugeRecoverPct: number;
  topExpenseGaps: ExpenseVarianceRow[];
  expenseVarianceTop: ExpenseVarianceRow[];
  benchmarkSource: PortfolioBenchmarkContext['source'];
  sectorFallbackActive: boolean;
}

export interface ComputeLostProfits360Params {
  residence?: Record<string, unknown>;
  calc?: FinancialCalc | null;
  baseData?: FinancialBaseData | null;
  prixDemande?: number | null;
  /** Taux d'inoccupation marché (0.03 = 3 %). */
  vacancyRate?: number;
  /** Cap rate en % (ex. 10). Prioritaire sur TGA_VALUE_MULTIPLIER. */
  capRatePct?: number | null;
  portfolioCtx?: PortfolioBenchmarkContext | null;
}

function expenseLabelFr(key: string): string {
  const f = EXPENSE_FIELDS.find((x) => x.key === key);
  return f ? f.label : key;
}

function pct1(r: number | null): string {
  if (r == null || !Number.isFinite(r)) return '—';
  return `${(r * 100).toFixed(1)} %`;
}

/**
 * Traduit un écart de NOI annuel en impact sur la valeur marchande.
 * Formule : ΔV = ΔNOI ÷ (Cap Rate)  —  ex. 25 000 $ / 10 % = 250 000 $.
 */
export function noiGapToMarketValue(
  annualNoiGap: number,
  capRatePct: number | null | undefined
): number {
  const gap = safeNum(annualNoiGap);
  if (gap == null || gap <= 0) return 0;
  const cap = safeNum(capRatePct);
  if (cap != null && cap > 0) {
    return gap / (cap / 100);
  }
  return gap * OPTIMIZATION_360_RULES.TGA_VALUE_MULTIPLIER;
}

/** @deprecated Utiliser noiGapToMarketValue */
export function calculateLostValue(annualGapAbs: number, capRatePct?: number | null): number {
  return noiGapToMarketValue(annualGapAbs, capRatePct);
}

function getUnits(
  residence: Record<string, unknown>,
  calc: FinancialCalc,
  baseData: FinancialBaseData | null
): number {
  return (
    safeNum(residence.nombreUnitesTotal) ??
    safeNum(residence.nombreUnites) ??
    safeNum(residence.capacite) ??
    safeNum(calc.nombreUnites) ??
    safeNum(baseData?.nombreUnites) ??
    0
  );
}

/** Références marché sectorielles (% du RBE) tant que le benchmark portefeuille V2 n'est pas branché. */
export function buildSectorBenchmarkContext(): PortfolioBenchmarkContext {
  const means: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const [k, pct] of Object.entries(MARKET_REF_PCT_OF_RBE)) {
    if (pct != null && Number.isFinite(pct)) {
      means[k] = pct / 100;
      counts[k] = 99;
    }
  }
  return {
    means,
    counts,
    minSamples: OPTIMIZATION_360_RULES.GLOBAL_BENCHMARK_MIN_SAMPLES,
    source: 'sector_ref',
  };
}

function lineSurplusVsBenchmark(
  keys: readonly string[],
  dep: Record<string, unknown>,
  expenseAdj: Record<string, unknown>,
  means: Record<string, number> | undefined,
  counts: Record<string, number> | undefined,
  minSamples: number,
  rbe: number
): {
  surplus: number;
  actual: number;
  bench: number;
  used: number;
  realRatio: number | null;
  benchRatio: number | null;
} {
  let actual = 0;
  let bench = 0;
  let used = 0;
  for (const k of keys) {
    const mean = means?.[k];
    const n = counts?.[k] ?? 0;
    if (mean == null || !Number.isFinite(mean) || n < minSamples) continue;
    used += 1;
    bench += mean * rbe;
    actual += Math.max(0, normalizedOperatingAmount(k, dep, expenseAdj));
  }
  if (used === 0) {
    return { surplus: 0, actual, bench, used: 0, realRatio: null, benchRatio: null };
  }
  const surplus = Math.max(0, actual - bench);
  return {
    surplus,
    actual,
    bench,
    used,
    realRatio: rbe > 0 ? actual / rbe : null,
    benchRatio: rbe > 0 ? bench / rbe : null,
  };
}

function resolveCapRatePct(
  calc: FinancialCalc,
  baseData: FinancialBaseData | null,
  override?: number | null
): { capRatePct: number; source: 'fiche' | 'default' } {
  const fromOverride = safeNum(override);
  if (fromOverride != null && fromOverride > 0) {
    return { capRatePct: normalizeTgaPct(fromOverride) ?? fromOverride, source: 'fiche' };
  }
  const tga = safeNum(calc.tauxCapitalisation);
  if (tga != null && tga > 0) {
    return { capRatePct: normalizeTgaPct(tga) ?? tga, source: 'fiche' };
  }
  const fin = (baseData?.financement ?? {}) as Record<string, unknown>;
  const tgaFin = safeNum(fin.tgaPreteur) ?? safeNum(fin.tga);
  if (tgaFin != null && tgaFin > 0) {
    return { capRatePct: normalizeTgaPct(tgaFin) ?? tgaFin, source: 'fiche' };
  }
  return {
    capRatePct: OPTIMIZATION_360_RULES.DEFAULT_CAP_RATE_PCT,
    source: 'default',
  };
}

export function computeLostProfits360(params: ComputeLostProfits360Params): LostProfits360Result {
  const residence = params.residence ?? {};
  const calc = params.calc ?? ({} as FinancialCalc);
  const baseData = params.baseData ?? null;
  const dep = (baseData?.depenses ?? {}) as Record<string, unknown>;
  const expenseAdj = (baseData?.expenseAdjustments ?? {}) as Record<string, unknown>;

  const rbe = safeNum(calc.revenuBrutEffectif) ?? safeNum(calc.revenusAnnuels) ?? 0;
  const noiDeclared = safeNum(calc.revenuNetExploitation);
  const units = getUnits(residence, calc, baseData);

  if (!baseData?.depenses || rbe <= 0) {
    return {
      hasData: false,
      insufficientReasonFr:
        'Grille Revenus & Dépenses ou revenu brut effectif (RBE) manquants — complétez financial/dataV2 pour activer la vérification 360°.',
      insufficientReasonEn:
        'Revenue & expense grid or EGI missing — complete financial/dataV2 to enable the 360° verification.',
      rbe: 0,
      noiDeclared,
      noiNormalized: null,
      units,
      capRatePct: OPTIMIZATION_360_RULES.DEFAULT_CAP_RATE_PCT,
      capRateSource: 'default',
      loyerReelMensuel: null,
      loyerMarcheMensuel: null,
      rows: [],
      totalNoiGapAnnual: 0,
      totalValueImpact: 0,
      valeurRecuperable: 0,
      valeurPerdue: 0,
      basePrice: 0,
      targetOptimizedPrice: 0,
      gaugeLostPct: 50,
      gaugeRecoverPct: 50,
      topExpenseGaps: [],
      expenseVarianceTop: [],
      benchmarkSource: 'sector_ref',
      sectorFallbackActive: false,
    };
  }

  const { capRatePct, source: capRateSource } = resolveCapRatePct(calc, baseData, params.capRatePct);
  const vacancyBm = params.vacancyRate ?? OPTIMIZATION_360_RULES.DEFAULT_VACANCY_RATE;

  const portfolioCtx = params.portfolioCtx ?? buildSectorBenchmarkContext();
  const means = portfolioCtx.means;
  const counts = portfolioCtx.counts;
  const minSamples = portfolioCtx.minSamples;

  const loyerMarcheMensuel =
    safeNum(residence.loyerMoyen) ?? safeNum(residence.avgRent) ?? safeNum(financementRent(baseData));
  const prixDemande =
    safeNum(params.prixDemande) ??
    resolvePrixDemande(calc, residence, baseData) ??
    0;

  let revenueTargetAnnual: number | null = null;
  if (units > 0 && loyerMarcheMensuel != null && loyerMarcheMensuel > 0) {
    revenueTargetAnnual = units * loyerMarcheMensuel * 12 * (1 - vacancyBm);
  }

  const revenueGapAnnual =
    revenueTargetAnnual != null && rbe >= 0 ? Math.max(0, revenueTargetAnnual - rbe) : 0;

  const loyerReelMensuel = units > 0 && rbe > 0 ? rbe / (12 * units) : null;

  const salaryLine =
    rbe > 0
      ? lineSurplusVsBenchmark(['salairesAvantages'], dep, expenseAdj, means, counts, minSamples, rbe)
      : { surplus: 0, actual: 0, bench: 0, used: 0, realRatio: null, benchRatio: null };

  const opsLine =
    rbe > 0
      ? lineSurplusVsBenchmark(OPS_ENERGY_KEYS, dep, expenseAdj, means, counts, minSamples, rbe)
      : { surplus: 0, actual: 0, bench: 0, used: 0, realRatio: null, benchRatio: null };

  let sectorFallbackSurplus = 0;
  if (salaryLine.used === 0 && opsLine.used === 0 && means && sumNormalizedOperatingExpenses(dep, expenseAdj) != null) {
    const totalNorm = sumNormalizedOperatingExpenses(dep, expenseAdj)!;
    sectorFallbackSurplus = Math.max(
      0,
      totalNorm - OPTIMIZATION_360_RULES.EXPENSE_RATIO_TARGET * rbe
    );
  }

  let salarySurplus = salaryLine.used > 0 ? salaryLine.surplus : 0;
  let opsSurplus = opsLine.used > 0 ? opsLine.surplus : 0;
  let opsConstatOverrideFr: string | null = null;
  let opsConstatOverrideEn: string | null = null;
  const expenseSurplusForTable = salarySurplus + opsSurplus;
  if (expenseSurplusForTable === 0 && sectorFallbackSurplus > 0 && rbe > 0) {
    opsSurplus = sectorFallbackSurplus;
    opsConstatOverrideFr = `Dépenses totales vs cible RDE ${(OPTIMIZATION_360_RULES.EXPENSE_RATIO_TARGET * 100).toFixed(0)} % du RBE (réf. sectorielle)`;
    opsConstatOverrideEn = `Total expenses vs ${(OPTIMIZATION_360_RULES.EXPENSE_RATIO_TARGET * 100).toFixed(0)}% EGI sector target`;
  }

  const revenueValue = noiGapToMarketValue(revenueGapAnnual, capRatePct);
  const salaryValue = noiGapToMarketValue(salarySurplus, capRatePct);
  const opsValue = noiGapToMarketValue(opsSurplus, capRatePct);

  const topExpenseGaps: ExpenseVarianceRow[] = [];
  const expenseVarianceCandidates: ExpenseVarianceRow[] = [];

  if (means && rbe > 0) {
    for (const k of EXPENSE_KEYS) {
      if (k === 'taxesMunicipalesScolaire') continue;
      const mean = means[k];
      const n = counts?.[k] ?? 0;
      if (mean == null || !Number.isFinite(mean) || n < minSamples) continue;
      const bench$ = mean * rbe;
      const act = Math.max(0, normalizedOperatingAmount(k, dep, expenseAdj));
      const sur = Math.max(0, act - bench$);
      const ecartDollar = act - bench$;
      expenseVarianceCandidates.push({
        key: k,
        label: expenseLabelFr(k),
        actualNorm: act,
        benchmarkDollar: bench$,
        ecartDollar,
        valueImpact: noiGapToMarketValue(sur, capRatePct),
      });
      if (sur > 0) {
        topExpenseGaps.push({
          key: k,
          label: expenseLabelFr(k),
          actualNorm: act,
          benchmarkDollar: bench$,
          ecartDollar,
          valueImpact: noiGapToMarketValue(sur, capRatePct),
        });
      }
    }
    topExpenseGaps.sort((a, b) => b.valueImpact - a.valueImpact);
  }

  expenseVarianceCandidates.sort((a, b) => Math.abs(b.ecartDollar) - Math.abs(a.ecartDollar));
  const minVar = Math.max(250, rbe * 0.001);
  let expenseVarianceTop = expenseVarianceCandidates.filter((row) => Math.abs(row.ecartDollar) >= minVar);
  if (expenseVarianceTop.length === 0 && expenseVarianceCandidates.length > 0) {
    expenseVarianceTop = expenseVarianceCandidates.slice(0, 10);
  } else {
    expenseVarianceTop = expenseVarianceTop.slice(0, 15);
  }

  const totalNoiGapAnnual = revenueGapAnnual + salarySurplus + opsSurplus;
  const totalValueImpact = revenueValue + salaryValue + opsValue;
  const valeurRecuperable = revenueValue;
  const valeurPerdue = salaryValue + opsValue;
  const basePrice = Math.max(0, prixDemande);
  const targetOptimizedPrice = Math.max(0, basePrice + valeurRecuperable - valeurPerdue);

  const gaugeTotal = valeurPerdue + valeurRecuperable;
  const gaugeLostPct = gaugeTotal > 0 ? Math.min(100, (valeurPerdue / gaugeTotal) * 100) : 50;
  const gaugeRecoverPct = gaugeTotal > 0 ? Math.min(100, (valeurRecuperable / gaugeTotal) * 100) : 50;

  const revConstat =
    loyerReelMensuel != null && loyerMarcheMensuel != null
      ? `Loyer moyen : ${loyerReelMensuel.toFixed(0)} $ vs ${loyerMarcheMensuel.toFixed(0)} $ / unité / mois`
      : loyerMarcheMensuel == null
        ? 'Loyer marché : renseigner sur la fiche ou en financement'
        : units <= 0
          ? 'Nombre d’unités requis pour le levier revenus'
          : `Loyer implicite (RBE) : ${loyerReelMensuel != null ? `${loyerReelMensuel.toFixed(0)} $ / unité / mois` : '—'}`;

  const rows: LostProfitsLeverRow[] = [
    {
      id: 'revenue',
      leverFr: 'Revenus / loyers',
      leverEn: 'Revenue / rents',
      constatFr: revConstat,
      constatEn:
        loyerReelMensuel != null && loyerMarcheMensuel != null
          ? `Avg rent: ${loyerReelMensuel.toFixed(0)} vs ${loyerMarcheMensuel.toFixed(0)} $ / unit / mo`
          : 'Market rent or unit count needed',
      noiGapAnnual: revenueGapAnnual,
      valueImpact: revenueValue,
      direction: 'recover',
    },
    {
      id: 'salary',
      leverFr: 'Masse salariale',
      leverEn: 'Payroll',
      constatFr:
        salaryLine.used > 0
          ? `Ratio : ${pct1(salaryLine.realRatio)} vs ${pct1(salaryLine.benchRatio)} (réf. marché)`
          : 'Benchmark masse salariale indisponible',
      constatEn:
        salaryLine.used > 0
          ? `Ratio: ${pct1(salaryLine.realRatio)} vs ${pct1(salaryLine.benchRatio)} (market ref)`
          : 'Payroll benchmark unavailable',
      noiGapAnnual: salarySurplus,
      valueImpact: salaryValue,
      direction: 'loss',
    },
    {
      id: 'ops',
      leverFr: 'Opérations / énergie',
      leverEn: 'Operations / energy',
      constatFr:
        opsConstatOverrideFr ||
        (opsLine.used > 0
          ? `Opérations : ${pct1(opsLine.realRatio)} vs ${pct1(opsLine.benchRatio)} (réf. marché)`
          : 'Benchmark opérations indisponible'),
      constatEn:
        opsConstatOverrideEn ||
        (opsLine.used > 0
          ? `Operations: ${pct1(opsLine.realRatio)} vs ${pct1(opsLine.benchRatio)}`
          : 'Operations benchmark unavailable'),
      noiGapAnnual: opsSurplus,
      valueImpact: opsValue,
      direction: 'loss',
    },
  ];

  const normExp = sumNormalizedOperatingExpenses(dep, expenseAdj);
  const noiNormalized =
    rbe > 0 && normExp != null ? rbe - normExp : noiDeclared;

  return {
    hasData: true,
    insufficientReasonFr: null,
    insufficientReasonEn: null,
    rbe,
    noiDeclared,
    noiNormalized,
    units,
    capRatePct,
    capRateSource,
    loyerReelMensuel,
    loyerMarcheMensuel,
    rows,
    totalNoiGapAnnual,
    totalValueImpact,
    valeurRecuperable,
    valeurPerdue,
    basePrice,
    targetOptimizedPrice,
    gaugeLostPct,
    gaugeRecoverPct,
    topExpenseGaps: topExpenseGaps.slice(0, 5),
    expenseVarianceTop,
    benchmarkSource: portfolioCtx.source,
    sectorFallbackActive: Boolean(opsConstatOverrideFr),
  };
}

function financementRent(baseData: FinancialBaseData | null): number | null {
  const fin = (baseData?.financement ?? {}) as Record<string, unknown>;
  return safeNum(fin.loyerMoyen) ?? safeNum(fin.loyerMarche) ?? safeNum(fin.avgRent);
}

/** Point d'entrée Hub Finance — inclut métadonnées pour l'UI. */
export function computePerformanceAudit360(
  params: ComputeLostProfits360Params
): LostProfits360Result & { confidenceTier: 'high' | 'medium' | 'low' } {
  const result = computeLostProfits360(params);
  let confidenceTier: 'high' | 'medium' | 'low' = 'low';
  if (result.hasData && result.totalNoiGapAnnual > 0) confidenceTier = 'high';
  else if (result.hasData) confidenceTier = 'medium';
  return { ...result, confidenceTier };
}
