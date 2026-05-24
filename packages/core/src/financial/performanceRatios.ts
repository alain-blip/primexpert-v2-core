/**
 * Ratios de performance — SSOT (zéro calcul dans l'UI).
 */

import {
  computeFinancingScenario,
  resolvePrixDemande,
  type ResidenceFinancialHints,
} from './computeFinancabilite';
import {
  getAuditNormalizedNoi,
  normalizeFinancialData,
  type FinancialDataV2Doc,
} from './normalizeFinancialData';
import {
  getDefaultDscrTarget,
  INTEREST_RATE_RULES,
  resolveFinancingProgram,
  resolveSimulationAmortizationYears,
} from './financialRules';
import { safeDscrTarget, safeNum, safeRatePercent } from './safeNumbers';

export type RatioDisplayKind = 'multiplier' | 'percent' | 'currency' | 'currencyPerUnit';

export interface PerformanceRatioRow {
  id: string;
  code: string;
  labelFr: string;
  labelEn: string;
  value: number | null;
  displayKind: RatioDisplayKind;
  definitionFr?: string;
  definitionEn?: string;
}

export interface PerformanceRatiosInputs {
  prixDemande: number | null;
  rbe: number | null;
  rne: number | null;
  operatingExpenses: number | null;
  nombreUnitesTotal: number | null;
  hypotheque: number | null;
  serviceDetteAnnuel: number | null;
  miseDeFonds: number | null;
}

export interface PerformanceRatiosViewModel {
  hasFinancials: boolean;
  source: string;
  incomplete: boolean;
  inputs: PerformanceRatiosInputs;
  performanceRows: PerformanceRatioRow[];
  financingRows: PerformanceRatioRow[];
}

function finitePositive(v: unknown): number | null {
  const n = safeNum(v);
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

function resolveRbeFailSafe(
  calc: { revenuBrutEffectif?: unknown; revenusAnnuels?: unknown } | null,
  residence: ResidenceFinancialHints
): number | null {
  const fromCalc =
    finitePositive(calc?.revenuBrutEffectif) ?? finitePositive(calc?.revenusAnnuels);
  if (fromCalc != null) return fromCalc;

  const res = residence as Record<string, unknown>;
  for (const key of [
    'revenusLocatifs',
    'revenusAnnuelsBruts',
    'revenusAnnuels',
    'annualRevenue',
  ] as const) {
    const n = finitePositive(res[key]);
    if (n != null) return n;
  }
  return null;
}

function resolveUnitCount(
  calc: { nombreUnites?: unknown } | null,
  residence: ResidenceFinancialHints,
  baseData: { nombreUnites?: unknown } | null
): number | null {
  const candidates: unknown[] = [
    calc?.nombreUnites,
    (residence as Record<string, unknown>).nombreUnitesTotal,
    baseData?.nombreUnites,
    (residence as Record<string, unknown>).nombreUnites,
    (residence as Record<string, unknown>).capacite,
    (residence as Record<string, unknown>).unitsCount,
  ];
  for (const raw of candidates) {
    const n = safeNum(raw);
    if (n != null && n > 0) return Math.round(n);
  }
  return null;
}

function row(
  partial: Omit<PerformanceRatioRow, 'value'> & { value: number | null }
): PerformanceRatioRow {
  return partial;
}

/**
 * Calcule tous les ratios de performance et de financement pour la fiche.
 */
export function computePerformanceRatiosViewModel(
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints = {}
): PerformanceRatiosViewModel {
  const { calc, baseData, hasFinancials, source } = normalizeFinancialData(
    financialData,
    residence
  );

  const prixDemande = resolvePrixDemande(calc, residence, baseData);
  const rbe = resolveRbeFailSafe(calc, residence);

  const depensesNormalisees =
    calc != null ? finitePositive(calc.depensesTotalesNormalisees) : null;
  const depensesDeclarees =
    calc != null ? finitePositive(calc.depensesTotales) : null;
  const operatingExpenses = depensesNormalisees ?? depensesDeclarees;

  const noiDeclared = calc != null ? finitePositive(calc.revenuNetExploitation) : null;
  const noiAudit = calc != null ? getAuditNormalizedNoi(calc, baseData) : null;
  const rne =
    noiAudit ??
    noiDeclared ??
    (rbe != null && operatingExpenses != null ? rbe - operatingExpenses : null);

  const nombreUnitesTotal = resolveUnitCount(calc, residence, baseData);

  let hypotheque: number | null =
    calc != null ? finitePositive(calc.montantHypotheque) : null;
  let serviceDetteAnnuel: number | null =
    calc != null ? finitePositive(calc.paiementAnnuel) : null;
  let miseDeFonds: number | null =
    calc != null ? finitePositive(calc.miseDeFondsRequise) : null;

  const financement = (baseData?.financement ?? {}) as Record<string, unknown>;
  const program = resolveFinancingProgram(financement, {
    residence: residence as Record<string, unknown>,
    baseData: (baseData ?? null) as Record<string, unknown> | null,
  });

  if (
    prixDemande != null &&
    prixDemande > 0 &&
    rne != null &&
    rne > 0
  ) {
    const dscrCible = safeDscrTarget(
      financement.dscr,
      getDefaultDscrTarget(
        program.programId,
        program.aphSelectPoints,
        program.propertyCategory
      )
    );
    const scenario = computeFinancingScenario({
      prixDemande,
      noiRetenu: rne,
      dscrCible,
      tauxInteretPct: safeRatePercent(
        financement.tauxInteret,
        INTEREST_RATE_RULES.DEFAULT * 100
      ),
      tgaPreteurPct: safeRatePercent(financement.tgaPreteur, 6.5),
      financingProgramId: program.programId,
      aphSelectPoints: program.aphSelectPoints,
      isNewConstruction: program.isNewConstruction,
      amortissementAnnees:
        finitePositive(calc?.amortissementBanque) ??
        finitePositive(financement.amortissement) ??
        resolveSimulationAmortizationYears({
          programId: program.programId,
          aphSelectPoints: program.aphSelectPoints,
          explicitYears: null,
          isNewConstruction: program.isNewConstruction,
        }),
    });

    if (scenario) {
      hypotheque = scenario.empruntRetenu;
      serviceDetteAnnuel = scenario.paiementAnnuel;
      miseDeFonds = scenario.miseDeFondsRequise;
    }
  }

  const inputs: PerformanceRatiosInputs = {
    prixDemande,
    rbe,
    rne: rne != null && Number.isFinite(rne) ? rne : null,
    operatingExpenses,
    nombreUnitesTotal,
    hypotheque,
    serviceDetteAnnuel,
    miseDeFonds,
  };

  const mrb = safeDivide(prixDemande, rbe);
  const mrn = safeDivide(prixDemande, rne);
  const trn = safeDivide(rne, prixDemande);
  const prixParPorte = safeDivide(prixDemande, nombreUnitesTotal);
  const rde = safeDivide(operatingExpenses, rbe);
  const ratioEndettement = safeDivide(hypotheque, prixDemande);
  const rcd = safeDivide(rne, serviceDetteAnnuel);

  const tmoNumerator =
    operatingExpenses != null && serviceDetteAnnuel != null
      ? operatingExpenses + serviceDetteAnnuel
      : null;
  const tmo = safeDivide(tmoNumerator, rbe);

  const incomplete =
    prixDemande == null ||
    prixDemande <= 0 ||
    rbe == null ||
    rbe <= 0;

  const performanceRows: PerformanceRatioRow[] = [
    row({
      id: 'mrb',
      code: 'MRB',
      labelFr: 'MRB — Multiple revenu brut',
      labelEn: 'MRB — Gross revenue multiple',
      value: mrb,
      displayKind: 'multiplier',
      definitionFr: 'Prix demandé ÷ RBE',
      definitionEn: 'Asking price ÷ EGR',
    }),
    row({
      id: 'mrn',
      code: 'MRN',
      labelFr: 'MRN — Multiple revenu net',
      labelEn: 'MRN — Net revenue multiple',
      value: mrn,
      displayKind: 'multiplier',
      definitionFr: 'Prix demandé ÷ RNE',
      definitionEn: 'Asking price ÷ NOI',
    }),
    row({
      id: 'trn',
      code: 'TRN',
      labelFr: 'TRN — Taux de rendement net',
      labelEn: 'TRN — Net yield on price',
      value: trn,
      displayKind: 'percent',
      definitionFr: 'RNE ÷ Prix demandé',
      definitionEn: 'NOI ÷ Asking price',
    }),
    row({
      id: 'prixParPorte',
      code: 'PRIX/UNITE',
      labelFr: 'Prix par unité',
      labelEn: 'Price per unit',
      value: prixParPorte,
      displayKind: 'currency',
      definitionFr: 'Prix demandé ÷ nombre d’unités',
      definitionEn: 'Asking price ÷ unit count',
    }),
    row({
      id: 'rde',
      code: 'RDE',
      labelFr: 'RDE — Ratio dépenses / revenus',
      labelEn: 'RDE — Expense ratio',
      value: rde,
      displayKind: 'percent',
      definitionFr: 'Dépenses d’exploitation ÷ RBE',
      definitionEn: 'Operating expenses ÷ EGR',
    }),
  ];

  const financingRows: PerformanceRatioRow[] = [
    row({
      id: 'hypotheque',
      code: 'HYP',
      labelFr: 'Hypothèque retenue (simulation)',
      labelEn: 'Retained mortgage (simulation)',
      value: hypotheque,
      displayKind: 'currency',
    }),
    row({
      id: 'miseDeFonds',
      code: 'MFR',
      labelFr: 'Mise de fonds requise (MFR)',
      labelEn: 'Required equity (MFR)',
      value: miseDeFonds,
      displayKind: 'currency',
    }),
    row({
      id: 'ratioEndettement',
      code: 'ENDETT.',
      labelFr: 'Ratio d’endettement',
      labelEn: 'Leverage ratio',
      value: ratioEndettement,
      displayKind: 'percent',
      definitionFr: 'Hypothèque ÷ Prix demandé',
      definitionEn: 'Mortgage ÷ Asking price',
    }),
    row({
      id: 'rcd',
      code: 'RCD',
      labelFr: 'RCD — Ratio couverture de la dette (DSCR)',
      labelEn: 'RCD — Debt service coverage (DSCR)',
      value: rcd,
      displayKind: 'multiplier',
      definitionFr: 'RNE ÷ Service de la dette annuel',
      definitionEn: 'NOI ÷ Annual debt service',
    }),
    row({
      id: 'tmo',
      code: 'TMO',
      labelFr: 'TMO — Taux de marge opérationnelle',
      labelEn: 'TMO — Operating margin rate',
      value: tmo,
      displayKind: 'percent',
      definitionFr: '(Dépenses + Service de la dette) ÷ RBE',
      definitionEn: '(Expenses + debt service) ÷ EGR',
    }),
  ];

  return {
    hasFinancials,
    source,
    incomplete,
    inputs,
    performanceRows,
    financingRows,
  };
}
