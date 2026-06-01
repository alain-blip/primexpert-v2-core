/**
 * Vue CFO — Bilan exécutif (performance inscription + bancabilité).
 * SSOT : aucun calcul dans l'UI React.
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

function finiteNum(v: unknown): number | null {
  const n = safeNum(v);
  return n != null && Number.isFinite(n) ? n : null;
}

function resolveRbeFailSafe(
  calc: { revenuBrutEffectif?: unknown; revenusAnnuels?: unknown } | null,
  residence: ResidenceFinancialHints
): number | null {
  const fromCalc =
    finiteNum(calc?.revenuBrutEffectif) ?? finiteNum(calc?.revenusAnnuels);
  if (fromCalc != null && fromCalc > 0) return fromCalc;

  const res = residence as Record<string, unknown>;
  const fallbacks: unknown[] = [
    res.revenusLocatifs,
    res.revenusAnnuelsBruts,
    res.revenusAnnuels,
    res.annualRevenue,
  ];
  for (const raw of fallbacks) {
    const n = finiteNum(raw);
    if (n != null && n > 0) return n;
  }
  return fromCalc;
}

export interface BilanCfoViewModel {
  hasFinancials: boolean;
  source: string;
  incompleteSimulation: boolean;
  performance: {
    prixDemande: number | null;
    rbe: number | null;
    operatingExpenses: number | null;
    usesNormalizedExpenses: boolean;
    noiDeclared: number | null;
    noiAudit: number | null;
    noiRetenu: number | null;
  };
  bankability: {
    canSimulate: boolean;
    dscrTarget: number | null;
    empruntMax: number | null;
    miseDeFonds: number | null;
    programLabelFr: string;
    programLabelEn: string;
    amortYears: number | null;
    ratioCouverture: number | null;
  };
}

export function computeBilanCfoViewModel(
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints = {}
): BilanCfoViewModel {
  const { calc, baseData, hasFinancials, source } = normalizeFinancialData(
    financialData,
    residence
  );

  const prixDemande = resolvePrixDemande(calc, residence, baseData);
  const rbe = resolveRbeFailSafe(calc, residence);

  const depensesNormalisees =
    calc != null ? finiteNum(calc.depensesTotalesNormalisees) : null;
  const depensesDeclarees =
    calc != null ? finiteNum(calc.depensesTotales) : null;
  const usesNormalizedExpenses =
    depensesNormalisees != null && depensesNormalisees >= 0;
  const operatingExpenses = usesNormalizedExpenses
    ? depensesNormalisees
    : depensesDeclarees;

  const noiDeclared = calc != null ? finiteNum(calc.revenuNetExploitation) : null;
  const noiAudit = calc != null ? getAuditNormalizedNoi(calc, baseData) : null;
  const noiRetenu =
    noiAudit != null && noiAudit > 0
      ? noiAudit
      : noiDeclared != null && noiDeclared > 0
        ? noiDeclared
        : rbe != null &&
            operatingExpenses != null &&
            rbe > 0 &&
            operatingExpenses >= 0
          ? rbe - operatingExpenses
          : null;

  const incompleteSimulation =
    prixDemande == null ||
    prixDemande <= 0 ||
    rbe == null ||
    rbe <= 0;

  const financement = (baseData?.financement ?? {}) as Record<string, unknown>;
  const program = resolveFinancingProgram(financement, {
    residence: residence as Record<string, unknown>,
    baseData: (baseData ?? null) as Record<string, unknown> | null,
  });

  const dscrCible = safeDscrTarget(
    financement.dscr,
    getDefaultDscrTarget(
      program.programId,
      program.aphSelectPoints,
      program.propertyCategory
    )
  );
  const tauxInteretPct = safeRatePercent(
    financement.tauxInteret,
    INTEREST_RATE_RULES.DEFAULT * 100
  );
  const explicitAmort =
    (calc != null ? finiteNum(calc.amortissementBanque) : null) ??
    finiteNum(financement.amortissement);

  let bankability: BilanCfoViewModel['bankability'] = {
    canSimulate: false,
    dscrTarget: dscrCible,
    empruntMax: null,
    miseDeFonds: null,
    programLabelFr: program.labelFr,
    programLabelEn: program.labelEn,
    amortYears: null,
    ratioCouverture: null,
  };

  if (
    prixDemande != null &&
    prixDemande > 0 &&
    noiRetenu != null &&
    noiRetenu > 0 &&
    dscrCible > 0
  ) {
    const scenario = computeFinancingScenario({
      prixDemande,
      noiRetenu,
      dscrCible,
      tauxInteretPct,
      tgaPreteurPct: safeRatePercent(financement.tgaPreteur, 6.5),
      financingProgramId: program.programId,
      aphSelectPoints: program.aphSelectPoints,
      isNewConstruction: program.isNewConstruction,
      amortissementAnnees: explicitAmort ?? undefined,
    });

    if (scenario) {
      const amortYears =
        explicitAmort ??
        resolveSimulationAmortizationYears({
          programId: program.programId,
          aphSelectPoints: program.aphSelectPoints,
          explicitYears: null,
          isNewConstruction: program.isNewConstruction,
        });
      bankability = {
        canSimulate: true,
        dscrTarget: dscrCible,
        empruntMax: scenario.empruntRetenu,
        miseDeFonds: scenario.miseDeFondsRequise,
        programLabelFr: program.labelFr,
        programLabelEn: program.labelEn,
        amortYears,
        ratioCouverture: scenario.ratioCouverture,
      };
    }
  }

  return {
    hasFinancials,
    source,
    incompleteSimulation,
    performance: {
      prixDemande,
      rbe,
      operatingExpenses,
      usesNormalizedExpenses,
      noiDeclared,
      noiAudit,
      noiRetenu,
    },
    bankability,
  };
}
