/**
 * Finançabilité commerciale — SSOT (formules bancaires auditées).
 *
 * Chaîne MFR (ordre strict) :
 *   1. Service dette max annuel = RNE ÷ DSCR cible
 *   2. Constante dette annuelle (DC) = PMT mensuel × 12 pour 1 $ de capital
 *   3. Emprunt max DSCR = service dette max ÷ DC  (= RNE ÷ DSCR ÷ DC)
 *   4. Plafond LTV = prix demandé × LTV (défaut 65 %)
 *   5. Emprunt retenu = min(emprunt max DSCR, plafond LTV)
 *   6. MFR = prix demandé − emprunt retenu
 *   7. Paiement mensuel = PMT(emprunt retenu) ; annuel = mensuel × 12
 *   8. DSCR résultant = RNE ÷ paiement annuel (≈ DSCR cible si emprunt = max DSCR)
 *
 * Amortissement :
 *   - Commercial pur : 15 ans
 *   - SCHL (hors APH Select) : 20 ans
 *   - APH Select : 40 / 45 / 50 ans selon paliers 50 / 70 / 100 points
 */

import {
  getAuditNormalizedNoi,
  normalizeFinancialData,
  type FinancialCalc,
  type FinancialBaseData,
  type FinancialDataV2Doc,
  type ResidenceFinancialHints,
} from './normalizeFinancialData';
import {
  buildAphSelectEligibilityInput,
  DSCR_RULES,
  evaluateAphSelectEligibility,
  getAmortizationVerdict,
  getDefaultDscrTarget,
  getDSCRVerdict,
  getMaxAmortizationYears,
  getMinimumDscrForProgram,
  getSimulationLtvMax,
  type PropertyAssetCategory,
  INTEREST_RATE_RULES,
  LTV_RULES,
  resolveFinancingProgram,
  resolveSimulationAmortizationYears,
  SCHL_APH_SELECT_RULES,
  type AmortizationVerdict,
  type AphSelectEligibilitySummary,
  type AphSelectTier,
  type DscrVerdict,
  type FinancingProgramContext,
  type FinancingProgramId,
} from './financialRules';
import { safeDscrTarget, safeNum, safeRatePercent, safeRatioDecimal } from './safeNumbers';
import { computeCapitalizedValueFromNoi } from './capitalizationMetrics';

export type FinancingVerdict = 'financable' | 'financable_conditions' | 'insufficient_data';

export interface FinancabiliteScenarioRow {
  labelFr: string;
  labelEn: string;
  value: string;
  highlight?: boolean;
}

export interface MortgagePaymentBreakdown {
  /** Taux mensuel effectif (ex. 0.065/12). */
  monthlyRate: number;
  /** Nombre de paiements mensuels (amortissement × 12). */
  paymentCount: number;
  /** PMT = principal × r / (1 − (1+r)^−n). */
  monthlyPayment: number;
  /** Paiement annuel = monthlyPayment × 12. */
  annualPayment: number;
  /**
   * Constante de dette annuelle (DC) pour 1 $ emprunté :
   * annualPayment / principal quand principal = 1.
   */
  annualDebtConstantPerDollar: number;
}

export interface FinancabiliteResult {
  hasFinancials: boolean;
  hasValidInputs: boolean;
  source: string;
  prixDemande: number | null;
  noiRetenu: number | null;
  noiDeclare: number | null;
  noiAudit: number | null;
  dscrCible: number;
  tauxInteretPct: number;
  amortissementAnnees: number;
  isSchlApplicable: boolean;
  propertyAssetCategory: PropertyAssetCategory;
  isNewConstruction: boolean | null;
  financingProgramId: FinancingProgramId;
  financingProgramLabelFr: string;
  financingProgramLabelEn: string;
  amortissementVerdict: AmortizationVerdict;
  aphSelectPoints: number | null;
  aphSelectTier: AphSelectTier | null;
  aphSelectEligibility: AphSelectEligibilitySummary | null;
  ltvRatio: number;
  tgaPreteurPct: number;
  debtServiceMaxAnnual: number | null;
  debtConstantAnnual: number | null;
  empruntMaxDscr: number | null;
  plafondLtv: number | null;
  empruntMaxTransaction: number | null;
  miseDeFondsRequise: number | null;
  paiementAnnuel: number | null;
  paiementMensuel: number | null;
  ratioCouverture: number | null;
  dynamicLtvRatio: number | null;
  valeurBanquable: number | null;
  dscrVerdict: DscrVerdict;
  financingVerdict: FinancingVerdict;
  financingLabelFr: string;
  financingLabelEn: string;
  financingDescriptionFr: string;
  financingDescriptionEn: string;
  scenarioRows: FinancabiliteScenarioRow[];
  provenance: {
    lastUpdated: unknown;
    source: string;
    confidenceTier: 'high' | 'medium' | 'low' | 'validation_required';
  };
}

/**
 * PMT standard : [Principal × r] / [1 − (1+r)^−n]
 * r = taux annuel / 12, n = amortissement (années) × 12.
 */
export function computeMortgagePayments(
  principal: number,
  annualRatePct: number,
  amortYears: number
): MortgagePaymentBreakdown | null {
  if (!Number.isFinite(principal) || principal <= 0) return null;
  if (!Number.isFinite(annualRatePct) || annualRatePct <= 0) return null;
  if (!Number.isFinite(amortYears) || amortYears <= 0) return null;

  const monthlyRate = annualRatePct / 100 / 12;
  const paymentCount = Math.round(amortYears * 12);
  if (paymentCount <= 0) return null;

  const monthlyPayment =
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -paymentCount));

  if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) return null;

  const annualPayment = monthlyPayment * 12;
  const annualDebtConstantPerDollar = annualPayment / principal;

  return {
    monthlyRate,
    paymentCount,
    monthlyPayment,
    annualPayment,
    annualDebtConstantPerDollar,
  };
}

/**
 * DC pour 1 $ de capital emprunté (même formule que ci-dessus avec principal = 1).
 */
export function computeDebtConstantAnnual(
  annualRatePct: number,
  amortYears: number
): number | null {
  const row = computeMortgagePayments(1, annualRatePct, amortYears);
  return row?.annualDebtConstantPerDollar ?? null;
}

/**
 * Prix demandé — priorité fiche inscription V2 (`price`), puis financial/dataV2.
 * Évite un `calc.prixDemande` erroné (TGA, ratio, etc.) qui écraserait le prix affiché.
 */
export function resolvePrixDemande(
  calc: FinancialCalc | null,
  residence: ResidenceFinancialHints,
  baseData: FinancialBaseData | null
): number | null {
  const bd = baseData as { prixDemande?: unknown; askingPrice?: unknown } | null;
  const candidates: unknown[] = [
    (residence as { price?: unknown }).price,
    residence.prixDemande,
    residence.askingPrice,
    calc?.prixDemande,
    bd?.prixDemande,
    bd?.askingPrice,
  ];

  for (const raw of candidates) {
    const n = safeNum(raw);
    if (n != null && n > 0) return n;
  }
  return null;
}

export interface FinancingScenarioInputs {
  prixDemande: number;
  noiRetenu: number;
  dscrCible: number;
  tauxInteretPct: number;
  tgaPreteurPct: number;
  financingProgramId: FinancingProgramId;
  aphSelectPoints?: number | null;
  isNewConstruction?: boolean | null;
  /** LTV explicite fiche ; sinon plafond programme (65 % commercial, 85–95 % APH Select). */
  ltvRatio?: number;
  /** Amortissement explicite (fiche). Sinon selon programme / palier APH. */
  amortissementAnnees?: number;
}

export interface FinancingScenarioResult {
  debtServiceMaxAnnual: number;
  debtConstantAnnual: number;
  empruntMaxDscr: number;
  plafondLtv: number;
  empruntRetenu: number;
  miseDeFondsRequise: number;
  paiementMensuel: number;
  paiementAnnuel: number;
  ratioCouverture: number;
  dynamicLtvRatio: number;
  mortgageOnRetainedLoan: MortgagePaymentBreakdown;
}

/**
 * Cœur du calcul bancaire — étapes commentées, sans lecture Firestore des agrégats dérivés.
 */
export function computeFinancingScenario(
  input: FinancingScenarioInputs
): FinancingScenarioResult | null {
  const {
    prixDemande,
    noiRetenu,
    dscrCible,
    tauxInteretPct,
    financingProgramId,
    aphSelectPoints,
    isNewConstruction,
    amortissementAnnees: amortInput,
  } = input;

  const ltvRatio = getSimulationLtvMax(
    financingProgramId,
    aphSelectPoints,
    input.ltvRatio
  );

  const amortissementAnnees = resolveSimulationAmortizationYears({
    programId: financingProgramId,
    aphSelectPoints,
    explicitYears: amortInput,
    isNewConstruction,
  });

  if (prixDemande <= 0 || noiRetenu <= 0 || dscrCible <= 0) return null;

  // Étape 1 — Capacité de remboursement annuelle exigée par le prêteur
  const debtServiceMaxAnnual = noiRetenu / dscrCible;

  // Étape 2 — Constante de dette annuelle (DC) sur 1 $ emprunté
  const dcRow = computeMortgagePayments(1, tauxInteretPct, amortissementAnnees);
  if (!dcRow) return null;
  const debtConstantAnnual = dcRow.annualDebtConstantPerDollar;

  // Étape 3 — Emprunt maximum imposé par le DSCR
  const empruntMaxDscr = debtServiceMaxAnnual / debtConstantAnnual;

  // Étape 4 — Plafond LTV strict sur le prix demandé
  const plafondLtv = prixDemande * ltvRatio;

  // Étape 5 — Emprunt retenu (règle du plus restrictif)
  const empruntRetenu = Math.min(empruntMaxDscr, plafondLtv);

  // Étape 6 — Mise de fonds requise (MFR)
  const miseDeFondsRequise = Math.max(0, prixDemande - empruntRetenu);

  // Étape 7 — Paiements réels sur l'emprunt retenu (vérifie DSCR ≈ cible)
  const mortgageOnRetainedLoan = computeMortgagePayments(
    empruntRetenu,
    tauxInteretPct,
    amortissementAnnees
  )!;
  const paiementMensuel = mortgageOnRetainedLoan.monthlyPayment;
  const paiementAnnuel = mortgageOnRetainedLoan.annualPayment;

  // Étape 8 — DSCR résultant = RNE / service de la dette annuel
  const ratioCouverture = paiementAnnuel > 0 ? noiRetenu / paiementAnnuel : 0;

  const dynamicLtvRatio = empruntRetenu / prixDemande;

  return {
    debtServiceMaxAnnual,
    debtConstantAnnual,
    empruntMaxDscr,
    plafondLtv,
    empruntRetenu,
    miseDeFondsRequise,
    paiementMensuel,
    paiementAnnuel,
    ratioCouverture,
    dynamicLtvRatio,
    mortgageOnRetainedLoan,
  };
}

function programToResultFields(program: FinancingProgramContext, amortVerdict: AmortizationVerdict) {
  return {
    isSchlApplicable: program.isSchlApplicable,
    propertyAssetCategory: program.propertyCategory,
    isNewConstruction: program.isNewConstruction,
    financingProgramId: program.programId,
    financingProgramLabelFr: program.labelFr,
    financingProgramLabelEn: program.labelEn,
    aphSelectPoints: program.aphSelectPoints,
    aphSelectTier: program.aphSelectTier,
    amortissementVerdict: amortVerdict,
  };
}

function computeCore(
  calc: FinancialCalc,
  baseData: FinancialBaseData | null,
  residence: ResidenceFinancialHints,
  useAuditNoi: boolean,
  options: {
    isSchlApplicable?: boolean;
    useAphSelect?: boolean;
    aphSelectPoints?: number | null;
  } = {}
): Omit<FinancabiliteResult, 'hasFinancials' | 'source' | 'provenance' | 'scenarioRows'> {
  const financement = (baseData?.financement ?? {}) as Record<string, unknown>;
  const program = resolveFinancingProgram(financement, {
    residence: residence as Record<string, unknown>,
    baseData: (baseData ?? null) as Record<string, unknown> | null,
    ...options,
  });
  const eligibilityInput = buildAphSelectEligibilityInput(
    residence as Record<string, unknown>,
    (baseData ?? null) as Record<string, unknown> | null,
    financement
  );
  const aphSelectEligibility =
    program.programId === 'aph_select' || program.programId === 'schl_standard'
      ? evaluateAphSelectEligibility(eligibilityInput, {
          requireAphPoints: program.programId === 'aph_select',
        })
      : null;

  const prixDemande = resolvePrixDemande(calc, residence, baseData);

  const declaredNoi = safeNum(calc.revenuNetExploitation) ?? 0;
  const auditNoi = getAuditNormalizedNoi(calc, baseData);
  const noiRetenu =
    useAuditNoi && auditNoi != null && auditNoi > 0 ? auditNoi : declaredNoi > 0 ? declaredNoi : null;

  const hasValidInputs = prixDemande != null && prixDemande > 0 && noiRetenu != null && noiRetenu > 0;

  const explicitLtv = safeRatioDecimal(financement.ltv, 0) || null;
  const ltvRatio = getSimulationLtvMax(
    program.programId,
    program.aphSelectPoints,
    explicitLtv && explicitLtv > 0 ? explicitLtv : null
  );
  const tauxInteretPct = safeRatePercent(
    financement.tauxInteret,
    INTEREST_RATE_RULES.DEFAULT * 100
  );
  const explicitAmortYears =
    safeNum(calc.amortissementBanque) ?? safeNum(financement.amortissement);
  const amortissementAnnees = resolveSimulationAmortizationYears({
    programId: program.programId,
    aphSelectPoints: program.aphSelectPoints,
    explicitYears: explicitAmortYears,
    isNewConstruction: program.isNewConstruction,
  });
  const amortissementVerdict = getAmortizationVerdict(
    explicitAmortYears ?? amortissementAnnees,
    program
  );
  const programFields = programToResultFields(program, amortissementVerdict);
  const dscrCible = safeDscrTarget(
    financement.dscr,
    getDefaultDscrTarget(program.programId, program.aphSelectPoints, program.propertyCategory)
  );
  const tgaPreteurPct = safeRatePercent(financement.tgaPreteur, 6.5);

  if (!hasValidInputs || prixDemande == null || noiRetenu == null) {
    return {
      hasValidInputs: false,
      prixDemande,
      noiRetenu,
      noiDeclare: declaredNoi > 0 ? declaredNoi : null,
      noiAudit: auditNoi,
      dscrCible,
      tauxInteretPct,
      amortissementAnnees,
      ...programFields,
      aphSelectEligibility,
      ltvRatio,
      tgaPreteurPct,
      debtServiceMaxAnnual: null,
      debtConstantAnnual: null,
      empruntMaxDscr: null,
      plafondLtv: null,
      empruntMaxTransaction: null,
      miseDeFondsRequise: null,
      paiementAnnuel: null,
      paiementMensuel: null,
      ratioCouverture: null,
      dynamicLtvRatio: null,
      valeurBanquable: null,
      dscrVerdict: getDSCRVerdict(null),
      financingVerdict: 'insufficient_data',
      financingLabelFr: 'Données insuffisantes',
      financingLabelEn: 'Insufficient data',
      financingDescriptionFr: 'Complétez le prix demandé et le RNE pour une analyse bancaire défendable.',
      financingDescriptionEn: 'Complete asking price and NOI for a bank-grade analysis.',
    };
  }

  const scenario = computeFinancingScenario({
    prixDemande,
    noiRetenu,
    dscrCible,
    tauxInteretPct,
    financingProgramId: program.programId,
    aphSelectPoints: program.aphSelectPoints,
    isNewConstruction: program.isNewConstruction,
    amortissementAnnees: explicitAmortYears ?? undefined,
    ltvRatio: explicitLtv && explicitLtv > 0 ? explicitLtv : undefined,
    tgaPreteurPct,
  });

  if (!scenario) {
    return {
      hasValidInputs: false,
      prixDemande,
      noiRetenu,
      noiDeclare: declaredNoi,
      noiAudit: auditNoi,
      dscrCible,
      tauxInteretPct,
      amortissementAnnees,
      ...programFields,
      aphSelectEligibility,
      ltvRatio,
      tgaPreteurPct,
      debtServiceMaxAnnual: null,
      debtConstantAnnual: null,
      empruntMaxDscr: null,
      plafondLtv: null,
      empruntMaxTransaction: null,
      miseDeFondsRequise: null,
      paiementAnnuel: null,
      paiementMensuel: null,
      ratioCouverture: null,
      dynamicLtvRatio: null,
      valeurBanquable: null,
      dscrVerdict: getDSCRVerdict(null),
      financingVerdict: 'insufficient_data',
      financingLabelFr: 'Paramètres bancaires invalides',
      financingLabelEn: 'Invalid bank parameters',
      financingDescriptionFr: 'Vérifiez le taux, l’amortissement et le DSCR cible.',
      financingDescriptionEn: 'Check rate, amortization and target DSCR.',
    };
  }

  const valeurBanquable = computeCapitalizedValueFromNoi(noiRetenu, tgaPreteurPct);

  const ratioCouverture = scenario.ratioCouverture;
  const dscrVerdict = getDSCRVerdict(ratioCouverture, {
    programId: program.programId,
    propertyCategory: program.propertyCategory,
  });
  const dynamicLtvRatio = scenario.dynamicLtvRatio;

  const ltvThreshold = ltvRatio;
  const financingVerdict: FinancingVerdict =
    dynamicLtvRatio >= ltvThreshold ? 'financable' : 'financable_conditions';

  const ltvPct = (dynamicLtvRatio * 100).toFixed(0);
  const typicalPct = (ltvThreshold * 100).toFixed(0);

  const baseResult = {
    hasValidInputs: true,
    prixDemande,
    noiRetenu,
    noiDeclare: declaredNoi > 0 ? declaredNoi : null,
    noiAudit: auditNoi,
    dscrCible,
    tauxInteretPct,
    amortissementAnnees,
    ...programFields,
    aphSelectEligibility,
    ltvRatio,
    tgaPreteurPct,
    debtServiceMaxAnnual: scenario.debtServiceMaxAnnual,
    debtConstantAnnual: scenario.debtConstantAnnual,
    empruntMaxDscr: scenario.empruntMaxDscr,
    plafondLtv: scenario.plafondLtv,
    empruntMaxTransaction: scenario.empruntRetenu,
    miseDeFondsRequise: scenario.miseDeFondsRequise,
    paiementAnnuel: scenario.paiementAnnuel,
    paiementMensuel: scenario.paiementMensuel,
    ratioCouverture,
    dynamicLtvRatio,
    valeurBanquable,
    dscrVerdict,
    financingVerdict,
  };

  if (financingVerdict === 'financable') {
    return {
      ...baseResult,
      financingLabelFr: 'Finançable',
      financingLabelEn: 'Financeable',
      financingDescriptionFr: `Financement institutionnel jusqu'à ${ltvPct} % du prix demandé (seuil ${typicalPct} %).`,
      financingDescriptionEn: `Institutional financing up to ${ltvPct}% of asking price (threshold ${typicalPct}%).`,
    };
  }

  return {
    ...baseResult,
    financingLabelFr: 'Finançable sous conditions',
    financingLabelEn: 'Financeable with conditions',
    financingDescriptionFr: `Couverture estimée ${ltvPct} % du prix — mise de fonds ou balance de vente requise (seuil ${typicalPct} %).`,
    financingDescriptionEn: `Estimated coverage ${ltvPct}% of price — higher down payment or vendor take-back (threshold ${typicalPct}%).`,
  };
}

function buildScenarioRows(
  r: Pick<
    FinancabiliteResult,
    | 'prixDemande'
    | 'noiRetenu'
    | 'dscrCible'
    | 'tauxInteretPct'
    | 'amortissementAnnees'
    | 'financingProgramId'
    | 'financingProgramLabelFr'
    | 'financingProgramLabelEn'
    | 'aphSelectPoints'
    | 'aphSelectTier'
    | 'amortissementVerdict'
    | 'ltvRatio'
    | 'debtServiceMaxAnnual'
    | 'debtConstantAnnual'
    | 'empruntMaxDscr'
    | 'plafondLtv'
    | 'empruntMaxTransaction'
    | 'miseDeFondsRequise'
    | 'paiementMensuel'
    | 'ratioCouverture'
  >,
  fmt: (n: number | null) => string
): FinancabiliteScenarioRow[] {
  const ltvPct = `${(r.ltvRatio * 100).toFixed(0)} %`;
  const maxAmort = getMaxAmortizationYears(
    r.financingProgramId,
    r.aphSelectPoints,
    r.isNewConstruction
  );
  const rows: FinancabiliteScenarioRow[] = [
    { labelFr: 'Prix demandé', labelEn: 'Asking price', value: fmt(r.prixDemande) },
    {
      labelFr: 'Programme de financement',
      labelEn: 'Financing program',
      value: r.financingProgramLabelFr,
    },
    {
      labelFr: 'Revenu net d’exploitation retenu (RNE) — banque',
      labelEn: 'Net operating income retained (NOI) — lender',
      value: fmt(r.noiRetenu),
      highlight: true,
    },
  ];

  if (r.financingProgramId === 'aph_select') {
    rows.push({
      labelFr: 'Points APH Select',
      labelEn: 'MLI Select points',
      value:
        r.aphSelectPoints != null
          ? `${r.aphSelectPoints} pts${r.aphSelectTier ? ` — ${r.aphSelectTier.labelFr}` : ''}`
          : '— (palier 50 pts supposé en simulation)',
    });
  }

  rows.push(
    { labelFr: 'DSCR cible', labelEn: 'Target DSCR', value: `${r.dscrCible.toFixed(2)}×` },
    { labelFr: 'Taux d\'intérêt', labelEn: 'Interest rate', value: `${r.tauxInteretPct.toFixed(2)} %` },
    {
      labelFr: 'Amortissement (simulation)',
      labelEn: 'Amortization (scenario)',
      value: `${r.amortissementAnnees} ans (max ${maxAmort} ans)`,
    },
    {
      labelFr: 'Avis amortissement',
      labelEn: 'Amortization compliance',
      value: r.amortissementVerdict.labelFr,
      highlight: r.amortissementVerdict.level === 'hors_normes',
    },
    {
      labelFr: 'Constante de dette annuelle (DC)',
      labelEn: 'Annual debt constant (DC)',
      value: r.debtConstantAnnual != null ? `${(r.debtConstantAnnual * 100).toFixed(2)} % / an` : '—',
    },
    {
      labelFr: 'Service de la dette maximal (RNE ÷ ratio de couverture (DSCR))',
      labelEn: 'Maximum debt service (NOI ÷ debt service coverage ratio (DSCR))',
      value: fmt(r.debtServiceMaxAnnual),
    },
    {
      labelFr: 'Critère ratio de couverture (DSCR) — capacité d’emprunt',
      labelEn: 'Debt service coverage ratio (DSCR) criterion — loan capacity',
      value: fmt(r.empruntMaxDscr),
    },
    {
      labelFr: `Critère ratio prêt-valeur (RPV) — plafond ${ltvPct} du prix`,
      labelEn: `Loan-to-value (LTV) criterion — ${ltvPct} of price ceiling`,
      value: fmt(r.plafondLtv),
    },
    {
      labelFr: 'Emprunt maximum autorisé (le plus bas des critères)',
      labelEn: 'Maximum authorized loan (lowest of criteria)',
      value: fmt(r.empruntMaxTransaction),
      highlight: true,
    },
    {
      labelFr: 'Mise de fonds requise (MFR)',
      labelEn: 'Required down payment (MFR)',
      value: fmt(r.miseDeFondsRequise),
      highlight: true,
    },
    {
      labelFr: 'Paiement mensuel (PMT)',
      labelEn: 'Monthly payment (PMT)',
      value: fmt(r.paiementMensuel),
    },
    {
      labelFr: 'Ratio de couverture du service de la dette (DSCR) résultant',
      labelEn: 'Resulting debt service coverage ratio (DSCR)',
      value: r.ratioCouverture != null ? `${r.ratioCouverture.toFixed(2)}×` : '—',
      highlight: true,
    }
  );

  return rows;
}

export interface ComputeFinancabiliteOptions {
  useAuditNoi?: boolean;
  /** Force ou désactive la prime SCHL (sinon détection depuis baseData.financement). */
  isSchlApplicable?: boolean;
  /** Force le scénario APH Select (immeubles collectifs / RPA). */
  useAphSelect?: boolean;
  /** Pointage APH Select (abordabilité + énergie + accessibilité). */
  aphSelectPoints?: number | null;
  formatCurrency?: (n: number | null) => string;
}

export function computeFinancabilite(
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints = {},
  options: ComputeFinancabiliteOptions = {}
): FinancabiliteResult {
  const {
    useAuditNoi = false,
    isSchlApplicable: isSchlOverride,
    useAphSelect,
    aphSelectPoints,
  } = options;
  const fmt =
    options.formatCurrency ??
    ((n: number | null) =>
      n != null && Number.isFinite(n)
        ? new Intl.NumberFormat('fr-CA', {
            style: 'currency',
            currency: 'CAD',
            maximumFractionDigits: 0,
          }).format(n)
        : '—');

  const { calc, baseData, hasFinancials, source } = normalizeFinancialData(financialData, residence);

  if (!calc || !hasFinancials) {
    const empty = computeCore(
      { prixDemande: null, revenuNetExploitation: null } as FinancialCalc,
      baseData,
      residence,
      false,
      { isSchlApplicable: isSchlOverride, useAphSelect, aphSelectPoints }
    );
    const fd = financialData as Record<string, unknown> | null;
    return {
      ...empty,
      hasFinancials: false,
      source,
      scenarioRows: [],
      provenance: {
        lastUpdated: fd?.lastUpdated ?? fd?.updatedAt ?? null,
        source,
        confidenceTier: 'validation_required',
      },
    };
  }

  const core = computeCore(calc, baseData, residence, useAuditNoi, {
    isSchlApplicable: isSchlOverride,
    useAphSelect,
    aphSelectPoints,
  });
  const fd = financialData as Record<string, unknown> | null;

  let confidenceTier: FinancabiliteResult['provenance']['confidenceTier'] = 'validation_required';
  if (core.hasValidInputs && core.ratioCouverture != null) confidenceTier = 'high';
  else if (core.hasValidInputs) confidenceTier = 'medium';
  else if (hasFinancials) confidenceTier = 'low';

  return {
    ...core,
    hasFinancials,
    source,
    scenarioRows: buildScenarioRows(core, fmt),
    provenance: {
      lastUpdated: fd?.lastUpdated ?? fd?.updatedAt ?? null,
      source,
      confidenceTier,
    },
  };
}
