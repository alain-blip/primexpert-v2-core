/**
 * Moteur de Valorisation RPA - Module centralisé
 *
 * Ce module centralise toute la logique de calcul de rentabilité et valorisation
 * pour les Résidences pour Personnes Âgées (RPA) et immeubles à revenus.
 *
 * Trois axes de valorisation:
 * 1. Méthode du revenu (Capitalisation/TGA) - Poids par défaut: 60%
 * 2. Méthode de comparaison (MRB) - Poids par défaut: 40%
 * 3. Valeur banquable (DSCR/LTV) - Plafond automatique
 *
 * Note: Les méthodes MRN et prix/unité sont disponibles mais désactivées
 * par défaut (poids = 0) pour éviter les distorsions.
 *
 * @author Copilote IA - RPAaVendre.com
 * @version 2.1.0
 */

import {
  type ValuationProfile,
  type ValuationProfileId,
  getValuationProfile,
  suggestValuationProfile,
  VALUATION_PROFILES,
} from './valuationProfiles';

import { formatCurrency } from '@primexpert/core/utils/formatting';
import {
  computeCapitalizationRateFromNoi,
  computeCapitalizedValueFromNoi,
  formatCapitalizationRatePercent,
} from '../financial/capitalizationMetrics';

import {
  type ComparableCapRateSample,
  type MarketCapRateResult,
  selectMarketCapRate,
  mapComparablesToCapRateSamples,
  computeCapRateImpliedAtAsking,
  isAggressivePricing,
} from './marketCapRate';

import {
  type ComparableFinancialData,
  type ComparableBenchmarks,
  computeComparableBenchmarks,
  mergeWithProfileDefaults,
} from './comparableBenchmarks';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Données d'entrée pour le moteur de valorisation
 */
export interface ValuationInputs {
  /** Prix demandé par le vendeur */
  askingPrice: number;
  /** Nombre d'unités locatives */
  units: number;
  /** Superficie habitable en pieds carrés (optionnel) */
  floorAreaSqFt?: number;

  // --- Revenus ---
  /** Revenus annuels potentiels (loyers + services) */
  potentialRevenue: number;
  /** Autres revenus (stationnement, buanderie, etc.) */
  otherIncome: number;
  /** Taux de vacance (ex: 0.05 pour 5%) */
  vacancyRate: number;

  // --- Dépenses ---
  /** Détail des dépenses par poste */
  operatingExpenses: Record<string, number>;
  /** Dépenses personnalisées additionnelles */
  customExpenses: { label: string; amount: number }[];

  // --- Ajustements pour normalisation ---
  adjustments: {
    /** Dépenses non récurrentes à soustraire */
    nonRecurring: number;
    /** Ajustement salaire propriétaire (si non comptabilisé) */
    ownerCompAdjustment: number;
    /** Ajustement loyers au marché */
    marketRentAdjustment: number;
    /** Autres ajustements */
    otherAdjustments: number;
  };

  // --- Paramètres marché (cibles) ---
  /** Taux de capitalisation cible (ex: 0.08 pour 8%) */
  targetCapRate: number;
  /** Multiple du revenu brut cible (ex: 3.0) */
  targetMRB: number;
  /** Multiple du revenu net cible (ex: 12.0) */
  targetMRN: number;
  /** Prix par unité cible (ex: 130000) */
  targetPricePerUnit: number;

  /** Pondération des méthodes de valorisation */
  weights: {
    /** Poids méthode capitalisation (ex: 0.40) */
    capRate: number;
    /** Poids méthode MRB (ex: 0.30) */
    mrb: number;
    /** Poids méthode MRN (ex: 0.15) */
    mrn: number;
    /** Poids méthode prix/unité (ex: 0.15) */
    pricePerUnit: number;
  };

  // --- Paramètres banque / financement ---
  financing: {
    /** Pourcentage mise de fonds (ex: 0.35 pour 35%) */
    downPaymentPct: number;
    /** Taux d'intérêt annuel (ex: 0.06 pour 6%) */
    interestRate: number;
    /** Amortissement en années (ex: 25) */
    amortYears: number;
    /** DSCR requis par la banque (ex: 1.25) */
    requiredDscr: number;
    /** TGA utilisé par le prêteur (ex: 0.08) */
    lenderCapRate: number;
    /** LTV maximum du prêteur (ex: 0.65) */
    lenderLtvMax: number;
  };

  // --- Paramètres Net vendeur (optionnel) ---
  vendor?: {
    /** Dette actuelle sur la propriété */
    currentDebt: number;
    /** Frais de vente en % (courtage, notaire, etc.) */
    sellingCostsPct: number;
    /** Coût fiscal (ACB ou PBR) */
    taxCostBase: number;
    /** Taux d'inclusion du gain en capital (ex: 0.6667) */
    capitalGainsInclusionRate: number;
    /** Taux marginal d'imposition (ex: 0.48) */
    marginalTaxRate: number;
  };

  // --- Comparables et ajustement risque (NOUVEAU) ---
  /** Données des comparables pour calcul du TGA de marché */
  comparables?: ComparableFinancialData[];
  /** Ajustement risque en points de base (ex: 25 = +0.25%) */
  riskAdjBps?: number;

  /**
   * Mode ACM : prix suggéré, banquable et fourchette = RNE / TGA cible (source unique).
   * Évite les formules concurrentes (pondération MRB, plafond prêteur, etc.).
   */
  valuationMode?: 'standard' | 'acm_unified_cap';
}

/**
 * Résultats du moteur de valorisation
 */
export interface ValuationOutputs {
  // --- Base financière ---
  /** Revenu brut potentiel (avant vacance) */
  grossPotentialIncome: number;
  /** Montant des vacances en $ */
  vacancyAmount: number;
  /** Revenu brut effectif (après vacance) */
  effectiveGrossIncome: number;
  /** Total des dépenses d'exploitation */
  operatingExpensesTotal: number;
  /** RNE comptable (avant ajustements) */
  noiAccounting: number;
  /** RNE normalisé/stabilisé (après ajustements) */
  noiStabilized: number;

  // --- Valorisation marché ---
  /** Valeur par capitalisation (RNE / TGA cible) */
  valueByCap: number;
  /** Valeur par MRB (RBE × MRB cible) */
  valueByMRB: number;
  /** Valeur par MRN (RNE × MRN cible) */
  valueByMRN: number;
  /** Valeur par prix/unité (unités × prix/unité cible) */
  valueByPricePerUnit: number;
  /** Valeur marchande pondérée */
  weightedMarketValue: number;

  // --- Banque / financement ---
  /** Valeur par capitalisation bancaire */
  bankCapValue: number;
  /** Service de dette maximum selon DSCR */
  maxDebtServiceByDscr: number;
  /** Constante de dette annuelle */
  debtConstant: number;
  /** Prêt maximum selon DSCR */
  maxLoanByDscr: number;
  /** Prix maximum selon DSCR/LTV */
  maxPriceByDscrLtv: number;
  /** Valeur banquable (min des méthodes) */
  bankableValue: number;

  // --- Fourchette prix de vente ---
  /** Prix suggéré bas (-10%) */
  suggestedLow: number;
  /** Prix suggéré haut (+10%) */
  suggestedHigh: number;
  /** Prix suggéré médian */
  suggestedPrice: number;

  // --- Net vendeur ---
  /** Net vendeur au prix suggéré */
  vendorNetAtSuggested?: number;
  /** Net vendeur au prix demandé */
  vendorNetAtAsking?: number;

  // --- Ratios clés au prix demandé ---
  /** TGA réel au prix demandé */
  actualCapRateAtAsking: number;
  /** MRB réel au prix demandé */
  actualMrbAtAsking: number;
  /** MRN réel au prix demandé */
  actualMrnAtAsking: number;
  /** Prix par unité au prix demandé */
  actualPricePerUnit: number;
  /** Prix par pied carré au prix demandé */
  actualPricePerSqFt?: number;
  /** Ratio des dépenses d'exploitation (RDE) */
  expenseRatio: number;

  // --- Financement au prix demandé ---
  /** Mise de fonds requise */
  downPaymentRequired: number;
  /** Montant du prêt */
  loanAmount: number;
  /** Paiement hypothécaire mensuel */
  monthlyMortgagePayment: number;
  /** Paiement hypothécaire annuel */
  annualMortgagePayment: number;
  /** Cash flow annuel (avant impôts) */
  annualCashFlow: number;
  /** DSCR au prix demandé */
  dscrAtAsking: number;
  /** ROI (Cash on Cash) */
  cashOnCashReturn: number;

  // --- Indicateurs de positionnement ---
  /** Écart prix demandé vs suggéré (%) */
  priceGapPct: number;
  /** Positionnement: 'sous-évalué' | 'bien-positionné' | 'surévalué' */
  pricePositioning: 'sous-évalué' | 'bien-positionné' | 'surévalué';

  // --- Avertissements ---
  /** Dépenses manquantes ou nulles avec revenus présents */
  hasExpensesWarning: boolean;

  // --- TGA MARCHÉ VS TGA IMPLICITE (NOUVEAU) ---
  /** TGA implicite au prix demandé = NOI / askingPrice */
  capRateImpliedAtAsking?: number;
  /** TGA de marché retenu (comparables ou profil) */
  capRateMarketSelected: number;
  /** Métadonnées sur la sélection du TGA de marché */
  marketCapRateMeta: MarketCapRateResult;
  /** Valeur par capitalisation au TGA de marché = NOI / capRateMarketSelected */
  valueByIncomeMarket: number;
  /** Benchmarks comparables (ratios moyens) */
  comparableBenchmarks: ComparableBenchmarks;
  /** Avertissements détaillés */
  warnings: string[];
  /** Indicateur: TGA implicite sous le marché (prix agressif) */
  warningLowCapRate: boolean;
}

/**
 * Valeurs par défaut pour les paramètres
 *
 * Pondération simplifiée (sans prix par unité):
 * - 60% Capitalisation (TGA) - méthode principale du revenu
 * - 40% MRB - méthode de comparaison par multiple du revenu brut
 * - 0% MRN et Prix/unité - non utilisés par défaut
 */
/**
 * PARAMÈTRES BANCAIRES DE RÉFÉRENCE - NOYAU DUR RPA 2024-2025
 *
 * NOTE: Le TGA prêteur varie selon le type de RPA (voir valuationProfiles.ts)
 * Ces valeurs sont pour une RPA "standard" (40-80 unités)
 */
const BANK_DEFAULTS = {
  dscrMin: 1.50,           // DSCR minimum exigé par les banques
  ltvMax: 0.65,            // LTV maximum (65%)
  capRateLender: 0.08,     // TGA prêteur standard (8%) - RPA moyenne
  amortYearsMax: 20,       // Amortissement maximum (20 ans)
};

export const DEFAULT_VALUATION_PARAMS = {
  weights: {
    capRate: 0.60,           // 60% - Méthode du revenu (capitalisation)
    mrb: 0.40,               // 40% - Méthode de comparaison (MRB)
    mrn: 0,                  // 0% - Non utilisé par défaut
    pricePerUnit: 0,         // 0% - Non utilisé par défaut (éviter prix/porte)
  },
  targetCapRate: 0.08,       // 8% - TGA investisseur (RPA moyenne standard)
  targetMRB: 2.75,           // Multiple standard marché RPA
  targetMRN: 12.5,           // Multiple conservateur (si activé)
  targetPricePerUnit: 130000, // Prix moyen par unité RPA Québec (si activé)
  financing: {
    downPaymentPct: 0.35,
    interestRate: 0.065,
    amortYears: BANK_DEFAULTS.amortYearsMax,      // 20 ans - Standard bancaire
    requiredDscr: BANK_DEFAULTS.dscrMin,           // 1.50 - Standard bancaire
    lenderCapRate: BANK_DEFAULTS.capRateLender,    // 8% - TGA prêteur RPA standard
    lenderLtvMax: BANK_DEFAULTS.ltvMax,            // 65% - Standard bancaire
  },
  vendor: {
    currentDebt: 0,
    sellingCostsPct: 0.05,
    taxCostBase: 0,
    capitalGainsInclusionRate: 0.6667,
    marginalTaxRate: 0.48,
  },
  adjustments: {
    nonRecurring: 0,
    ownerCompAdjustment: 0,
    marketRentAdjustment: 0,
    otherAdjustments: 0,
  },
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Calcule le paiement hypothécaire mensuel
 * Formule: M = P × [r(1+r)^n] / [(1+r)^n - 1]
 */
export function calculateMonthlyMortgagePayment(
  principal: number,
  annualRate: number,
  amortYears: number
): number {
  if (principal <= 0 || annualRate <= 0 || amortYears <= 0) return 0;

  const monthlyRate = annualRate / 12;
  const numPayments = amortYears * 12;

  const payment = principal *
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  return Math.round(payment * 100) / 100;
}

/**
 * Calcule la constante de dette annuelle
 *
 * Deux formules possibles:
 * 1. Méthode simplifiée (taux annuel direct): DC = r / (1 - (1+r)^-n)
 * 2. Méthode mensuelle convertie: DC = (r_m / (1 - (1+r_m)^-n_m)) × 12
 *
 * Nous utilisons la méthode mensuelle pour plus de précision avec les prêts standards.
 */
export function calculateDebtConstant(
  annualRate: number,
  amortYears: number
): number {
  if (annualRate <= 0 || amortYears <= 0) return 0;

  const monthlyRate = annualRate / 12;
  const numPayments = amortYears * 12;

  // Constante de dette annuelle (méthode mensuelle × 12)
  const dc = (monthlyRate / (1 - Math.pow(1 + monthlyRate, -numPayments))) * 12;

  return dc;
}

/**
 * Calcule la constante de dette annuelle (méthode simplifiée)
 * Formule: DC = r / (1 - (1+r)^-n)
 *
 * Cette méthode utilise le taux annuel directement.
 * Utilisée par certains prêteurs pour calculs rapides.
 */
export function calculateDebtConstantSimple(
  annualRate: number,
  amortYears: number
): number {
  if (annualRate <= 0 || amortYears <= 0) return 0;

  const dc = annualRate / (1 - Math.pow(1 + annualRate, -amortYears));

  return dc;
}

/**
 * Calcule le prêt maximum basé sur le DSCR
 * Formule: MaxLoan = (NOI / DSCR) / DebtConstant
 */
export function calculateMaxLoanByDscr(
  noi: number,
  dscr: number,
  debtConstant: number
): number {
  if (noi <= 0 || dscr <= 0 || debtConstant <= 0) return 0;

  const maxDebtService = noi / dscr;
  const maxLoan = maxDebtService / debtConstant;

  return Math.round(maxLoan);
}

/**
 * Calcule le net vendeur après impôts et frais (signature détaillée)
 * @deprecated Utiliser computeVendorNet() avec l'objet vendor à la place
 */
export function calculateVendorNet(
  salePrice: number,
  currentDebt: number,
  sellingCostsPct: number,
  taxCostBase: number,
  capitalGainsInclusionRate: number,
  marginalTaxRate: number
): number {
  // Frais de vente
  const sellingCosts = salePrice * sellingCostsPct;

  // Gain en capital
  const capitalGain = Math.max(0, salePrice - taxCostBase);
  const taxableGain = capitalGain * capitalGainsInclusionRate;
  const taxOnGain = taxableGain * marginalTaxRate;

  // Net vendeur
  const vendorNet = salePrice - currentDebt - sellingCosts - taxOnGain;

  return Math.round(vendorNet);
}

/**
 * Calcule le net vendeur après impôts et frais (signature simplifiée)
 *
 * Cette fonction estime le montant net que le vendeur recevra après:
 * - Frais de vente (courtage, notaire, etc.)
 * - Impôt sur le gain en capital
 * - Remboursement de la dette existante
 *
 * @param price - Prix de vente
 * @param vendor - Paramètres du vendeur (peut être undefined)
 * @returns Net vendeur estimé (0 si vendor est undefined)
 *
 * @example
 * ```typescript
 * const net = computeVendorNet(5000000, {
 *   currentDebt: 2000000,
 *   sellingCostsPct: 0.05,
 *   taxCostBase: 3000000,
 *   capitalGainsInclusionRate: 0.6667,
 *   marginalTaxRate: 0.48,
 * });
 * // net = 5000000 - 250000 (frais) - 640000 (impôt) - 2000000 (dette) = 2110000
 * ```
 */
export function computeVendorNet(
  price: number,
  vendor: ValuationInputs['vendor']
): number {
  if (!vendor || price <= 0) return 0;

  // Frais de vente (courtage, notaire, etc.)
  const sellingCosts = price * (vendor.sellingCostsPct ?? 0);

  // Calcul du gain en capital imposable
  const grossGain = Math.max(price - (vendor.taxCostBase ?? 0), 0);
  const taxableGain = grossGain * (vendor.capitalGainsInclusionRate ?? 0.6667);
  const estimatedTax = taxableGain * (vendor.marginalTaxRate ?? 0.48);

  // Dette à rembourser
  const debtRepayment = vendor.currentDebt ?? 0;

  // Net vendeur = Prix - Frais - Impôts - Dette
  const vendorNet = price - sellingCosts - estimatedTax - debtRepayment;

  return Math.round(vendorNet);
}

/**
 * Arrondit un nombre au millier le plus proche
 */
export function roundToThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}

// formatCurrency importé depuis ../../utils/formatting (SOURCE UNIQUE)

/**
 * Formate un pourcentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)} %`;
}

// ============================================================================
// FONCTION PRINCIPALE DE VALORISATION
// ============================================================================

/**
 * Calcule la valorisation complète d'une RPA
 *
 * @param inputs - Données d'entrée pour la valorisation
 * @returns Résultats complets de la valorisation
 *
 * @example
 * ```typescript
 * const inputs: ValuationInputs = {
 *   askingPrice: 5000000,
 *   units: 45,
 *   potentialRevenue: 1200000,
 *   otherIncome: 50000,
 *   vacancyRate: 0.05,
 *   operatingExpenses: { salaires: 400000, energie: 80000, ... },
 *   customExpenses: [],
 *   adjustments: { nonRecurring: 0, ownerCompAdjustment: 0, ... },
 *   targetCapRate: 0.085,
 *   targetMRB: 3.0,
 *   targetMRN: 12.0,
 *   targetPricePerUnit: 130000,
 *   weights: { capRate: 0.40, mrb: 0.30, mrn: 0.15, pricePerUnit: 0.15 },
 *   financing: { ... },
 * };
 *
 * const results = calculateValuation(inputs);
 * console.log(results.suggestedPrice); // Prix suggéré
 * ```
 */
export function calculateValuation(inputs: ValuationInputs): ValuationOutputs {
  // =========================================================================
  // 1. CALCULS DE BASE - REVENUS
  // =========================================================================

  // Revenu brut potentiel
  const grossPotentialIncome = inputs.potentialRevenue + inputs.otherIncome;

  // Vacance
  const vacancyAmount = grossPotentialIncome * inputs.vacancyRate;

  // Revenu brut effectif (RBE)
  const effectiveGrossIncome = grossPotentialIncome - vacancyAmount;

  // =========================================================================
  // 2. CALCULS DE BASE - DÉPENSES
  // =========================================================================

  // Total dépenses d'exploitation
  const standardExpenses = Object.values(inputs.operatingExpenses).reduce(
    (sum, val) => sum + (val || 0),
    0
  );
  const customExpensesTotal = inputs.customExpenses.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0
  );
  const operatingExpensesTotal = standardExpenses + customExpensesTotal;

  // Avertissement: dépenses nulles avec revenus présents
  const hasExpensesWarning = operatingExpensesTotal === 0 && effectiveGrossIncome > 0;

  // Ratio des dépenses d'exploitation (RDE)
  const expenseRatio = effectiveGrossIncome > 0
    ? operatingExpensesTotal / effectiveGrossIncome
    : 0;

  // =========================================================================
  // 3. REVENU NET D'EXPLOITATION (RNE / NOI)
  // =========================================================================

  // RNE comptable (avant ajustements)
  const noiAccounting = effectiveGrossIncome - operatingExpensesTotal;

  // Ajustements de normalisation
  const totalAdjustments =
    (inputs.adjustments.nonRecurring || 0) +
    (inputs.adjustments.ownerCompAdjustment || 0) +
    (inputs.adjustments.marketRentAdjustment || 0) +
    (inputs.adjustments.otherAdjustments || 0);

  // RNE normalisé/stabilisé
  const noiStabilized = noiAccounting + totalAdjustments;

  // =========================================================================
  // 4. VALORISATION PAR MÉTHODES MULTIPLES
  // =========================================================================

  // Méthode 1: Capitalisation (RNE comptable / TGA)
  // Utilise le RNE comptable (avant ajustements) comme demandé
  const valueByCap = computeCapitalizedValueFromNoi(
    noiAccounting,
    inputs.targetCapRate
  ) ?? 0;

  // Méthode 2: Multiple du Revenu Brut (RBE × MRB)
  // Utilise le RBE (revenu brut effectif)
  const valueByMRB = inputs.targetMRB > 0
    ? effectiveGrossIncome * inputs.targetMRB
    : 0;

  // Méthode 3: Multiple du Revenu Net (RNE comptable × MRN)
  // Utilise le RNE comptable (avant ajustements) comme demandé
  const valueByMRN = inputs.targetMRN > 0
    ? noiAccounting * inputs.targetMRN
    : 0;

  // Méthode 4: Prix par unité
  const valueByPricePerUnit = inputs.units * inputs.targetPricePerUnit;

  // Normaliser les poids pour qu'ils somment à 1
  const totalWeight =
    (inputs.weights.capRate || 0) +
    (inputs.weights.mrb || 0) +
    (inputs.weights.mrn || 0) +
    (inputs.weights.pricePerUnit || 0) || 1;

  // Valeur marchande pondérée (poids normalisés)
  const weightedMarketValue =
    (valueByCap * (inputs.weights.capRate || 0) +
      valueByMRB * (inputs.weights.mrb || 0) +
      valueByMRN * (inputs.weights.mrn || 0) +
      valueByPricePerUnit * (inputs.weights.pricePerUnit || 0)) / totalWeight;

  // =========================================================================
  // 5. VALEUR BANQUABLE
  // =========================================================================

  const { financing } = inputs;

  // Valeur par capitalisation bancaire (RNE comptable / TGA prêteur)
  // Utilise le RNE comptable comme demandé
  const bankCapValue = computeCapitalizedValueFromNoi(
    noiAccounting,
    financing.lenderCapRate
  ) ?? 0;

  // Constante de dette: DC = r / (1 - (1+r)^-n)
  const debtConstant = calculateDebtConstant(
    financing.interestRate,
    financing.amortYears
  );

  // Service de dette maximum selon DSCR (RNE comptable / DSCR requis)
  // Utilise le RNE comptable comme demandé
  const maxDebtServiceByDscr = financing.requiredDscr > 0
    ? noiAccounting / financing.requiredDscr
    : 0;

  // Prêt maximum selon DSCR
  const maxLoanByDscr = debtConstant > 0
    ? maxDebtServiceByDscr / debtConstant
    : 0;

  // Prix maximum selon DSCR/LTV
  const maxPriceByDscrLtv = financing.lenderLtvMax > 0
    ? maxLoanByDscr / financing.lenderLtvMax
    : 0;

  // Valeur banquable = minimum des deux méthodes
  const bankableValue = Math.min(bankCapValue, maxPriceByDscrLtv);

  // =========================================================================
  // 6. PRIX SUGGÉRÉ ET FOURCHETTE
  // =========================================================================

  // Collecter toutes les valeurs candidates (méthodes de valorisation)
  const valuationCandidates = [
    valueByCap,
    valueByMRB,
    valueByMRN,
    valueByPricePerUnit,
  ].filter(v => v > 0);

  // Déterminer les bornes brutes basées sur les méthodes
  const rawLow = valuationCandidates.length > 0
    ? Math.min(...valuationCandidates)
    : 0;
  const rawHigh = valuationCandidates.length > 0
    ? Math.max(...valuationCandidates)
    : 0;

  const canonicalValueByCap = computeCapitalizedValueFromNoi(
    noiAccounting,
    inputs.targetCapRate
  ) ?? 0;

  let suggestedPrice: number;
  let suggestedLow: number;
  let suggestedHigh: number;
  let bankableValueOut = bankableValue;
  let weightedMarketValueOut = weightedMarketValue;

  if (inputs.valuationMode === 'acm_unified_cap') {
    const canonical = roundToThousand(canonicalValueByCap);
    suggestedPrice = canonical;
    bankableValueOut = canonical;
    weightedMarketValueOut = canonical;
    suggestedLow = roundToThousand(canonical * 0.9);
    suggestedHigh = roundToThousand(canonical * 1.1);
  } else {
    // Prix suggéré = minimum entre la valeur pondérée et la valeur banquable
    suggestedPrice =
      bankableValue > 0
        ? roundToThousand(Math.min(weightedMarketValue, bankableValue))
        : roundToThousand(weightedMarketValue);

    suggestedLow =
      bankableValue > 0
        ? roundToThousand(Math.min(rawLow, bankableValue))
        : roundToThousand(rawLow);

    suggestedHigh =
      bankableValue > 0
        ? roundToThousand(Math.min(rawHigh, bankableValue))
        : roundToThousand(rawHigh);
  }

  // =========================================================================
  // 7. RATIOS AU PRIX DEMANDÉ
  // =========================================================================

  // TGA réel au prix demandé = RNE comptable / Prix demandé
  const actualCapRateAtAsking =
    computeCapitalizationRateFromNoi(noiAccounting, inputs.askingPrice) ?? 0;

  const actualMrbAtAsking = effectiveGrossIncome > 0
    ? inputs.askingPrice / effectiveGrossIncome
    : 0;

  // MRN réel = Prix demandé / RNE comptable
  const actualMrnAtAsking = noiAccounting > 0
    ? inputs.askingPrice / noiAccounting
    : 0;

  const actualPricePerUnit = inputs.units > 0
    ? inputs.askingPrice / inputs.units
    : 0;

  const actualPricePerSqFt = inputs.floorAreaSqFt && inputs.floorAreaSqFt > 0
    ? inputs.askingPrice / inputs.floorAreaSqFt
    : undefined;

  // =========================================================================
  // 8. FINANCEMENT AU PRIX DEMANDÉ
  // =========================================================================

  const downPaymentRequired = inputs.askingPrice * financing.downPaymentPct;
  const loanAmountAtAsking = inputs.askingPrice - downPaymentRequired;

  const monthlyMortgagePayment = calculateMonthlyMortgagePayment(
    loanAmountAtAsking,
    financing.interestRate,
    financing.amortYears
  );

  // Service de dette annuel au prix demandé = Prêt × Constante de dette
  const annualDebtServiceAtAsking = loanAmountAtAsking * debtConstant;

  // DSCR au prix demandé = RNE comptable / Service de dette annuel
  const dscrAtAsking = annualDebtServiceAtAsking > 0
    ? noiAccounting / annualDebtServiceAtAsking
    : 0;

  // Cash flow annuel = RNE comptable - Service de dette annuel
  const annualCashFlow = noiAccounting - annualDebtServiceAtAsking;

  // Cash-on-Cash = Cash flow annuel / Mise de fonds
  const cashOnCashReturn = downPaymentRequired > 0
    ? annualCashFlow / downPaymentRequired
    : 0;

  // =========================================================================
  // 9. NET VENDEUR
  // =========================================================================

  const vendorNetAtSuggested = computeVendorNet(suggestedPrice, inputs.vendor);
  const vendorNetAtAsking = computeVendorNet(inputs.askingPrice, inputs.vendor);

  // =========================================================================
  // 10. POSITIONNEMENT DU PRIX
  // =========================================================================

  const priceGapPct = suggestedPrice > 0
    ? (inputs.askingPrice - suggestedPrice) / suggestedPrice
    : 0;

  let pricePositioning: 'sous-évalué' | 'bien-positionné' | 'surévalué';
  if (priceGapPct < -0.10) {
    pricePositioning = 'sous-évalué';
  } else if (priceGapPct > 0.10) {
    pricePositioning = 'surévalué';
  } else {
    pricePositioning = 'bien-positionné';
  }

  // =========================================================================
  // 11. TGA MARCHÉ VS TGA IMPLICITE (NOUVEAU)
  // =========================================================================

  // Convertir les comparables en échantillons de cap rate
  const capRateSamples: ComparableCapRateSample[] = inputs.comparables
    ? mapComparablesToCapRateSamples(inputs.comparables.map(c => ({
        id: c.id,
        salePrice: c.salePrice || 0,
        rbp: c.rbp,
        rbe: c.rbe,
        noi: c.noi,
        totalExpenses: c.totalExpenses,
      })))
    : [];

  // Sélectionner le TGA de marché
  const marketCapRateMeta = selectMarketCapRate({
    profileCapRate: inputs.targetCapRate,
    comparables: capRateSamples,
    riskAdjBps: inputs.riskAdjBps ?? 0,
  });

  const capRateMarketSelected = marketCapRateMeta.capRateMarketSelected;

  // Calculer la valeur par revenu au TGA de marché
  const valueByIncomeMarket = roundToThousand(
    computeCapitalizedValueFromNoi(noiAccounting, capRateMarketSelected) ?? 0
  );

  // Calculer le TGA implicite au prix demandé
  const capRateImpliedAtAsking = computeCapRateImpliedAtAsking(
    noiAccounting,
    inputs.askingPrice
  );

  // Calculer les benchmarks comparables
  const rawBenchmarks = computeComparableBenchmarks(inputs.comparables);
  const comparableBenchmarks = mergeWithProfileDefaults(rawBenchmarks, {
    expenseRatioTypical: expenseRatio > 0 ? expenseRatio : 0.73,
    capRateTarget: inputs.targetCapRate,
  });

  // =========================================================================
  // 12. WARNINGS ET GARDE-FOUS
  // =========================================================================

  const warnings: string[] = [];

  // Warning: TGA implicite sous le marché
  let warningLowCapRate = false;
  if (
    capRateImpliedAtAsking !== undefined &&
    marketCapRateMeta.capRateComparableMin !== undefined
  ) {
    warningLowCapRate = isAggressivePricing(
      capRateImpliedAtAsking,
      marketCapRateMeta.capRateComparableMin,
      50 // tolérance 0.5%
    );
    if (warningLowCapRate) {
      const impliedPct = formatCapitalizationRatePercent(capRateImpliedAtAsking, 2);
      const minPct = formatCapitalizationRatePercent(marketCapRateMeta.capRateComparableMin, 2);
      warnings.push(
        `Prix agressif: TGA implicite (${impliedPct}) inférieur au minimum des comparables (${minPct})`
      );
    }
  } else if (
    capRateImpliedAtAsking !== undefined &&
    capRateImpliedAtAsking < capRateMarketSelected - 0.005
  ) {
    warningLowCapRate = true;
    const impliedPct = formatCapitalizationRatePercent(capRateImpliedAtAsking, 2);
    const marketPct = formatCapitalizationRatePercent(capRateMarketSelected, 2);
    warnings.push(
      `Rendement sous le marché: TGA implicite (${impliedPct}) inférieur au TGA de marché (${marketPct})`
    );
  } else if (
    capRateImpliedAtAsking !== undefined &&
    capRateImpliedAtAsking > capRateMarketSelected + 0.0025
  ) {
    const impliedPct = formatCapitalizationRatePercent(capRateImpliedAtAsking, 2);
    const marketPct = formatCapitalizationRatePercent(capRateMarketSelected, 2);
    warnings.push(
      `Opportunité au prix demandé: TGA implicite (${impliedPct}) supérieur au TGA cible (${marketPct})`
    );
  }

  // Warning: prix demandé au-dessus de la valeur banquable
  if (inputs.askingPrice > bankableValue * 1.05) {
    const ecart = inputs.askingPrice - bankableValue;
    warnings.push(
      `Prix demandé supérieur à la valeur banquable de ${formatCurrency(ecart)}`
    );
  }

  // Warning: DSCR insuffisant
  if (dscrAtAsking < financing.requiredDscr) {
    warnings.push(
      `DSCR insuffisant au prix demandé (${dscrAtAsking.toFixed(2)} < ${financing.requiredDscr.toFixed(2)})`
    );
  }

  // =========================================================================
  // RETOUR DES RÉSULTATS
  // =========================================================================

  return {
    // Base financière
    grossPotentialIncome: roundToThousand(grossPotentialIncome),
    vacancyAmount: Math.round(vacancyAmount),
    effectiveGrossIncome: roundToThousand(effectiveGrossIncome),
    operatingExpensesTotal: roundToThousand(operatingExpensesTotal),
    noiAccounting: roundToThousand(noiAccounting),
    noiStabilized: roundToThousand(noiStabilized),

    // Valorisation marché
    valueByCap: roundToThousand(valueByCap),
    valueByMRB: roundToThousand(valueByMRB),
    valueByMRN: roundToThousand(valueByMRN),
    valueByPricePerUnit: roundToThousand(valueByPricePerUnit),
    weightedMarketValue: roundToThousand(weightedMarketValueOut),

    // Banque / financement
    bankCapValue: roundToThousand(bankCapValue),
    maxDebtServiceByDscr: Math.round(maxDebtServiceByDscr),
    debtConstant: Math.round(debtConstant * 10000) / 10000,
    maxLoanByDscr: roundToThousand(maxLoanByDscr),
    maxPriceByDscrLtv: roundToThousand(maxPriceByDscrLtv),
    bankableValue: roundToThousand(bankableValueOut),

    // Fourchette prix
    suggestedLow,
    suggestedHigh,
    suggestedPrice,

    // Net vendeur
    vendorNetAtSuggested,
    vendorNetAtAsking,

    // Ratios au prix demandé
    actualCapRateAtAsking: Math.round(actualCapRateAtAsking * 10000) / 10000,
    actualMrbAtAsking: Math.round(actualMrbAtAsking * 100) / 100,
    actualMrnAtAsking: Math.round(actualMrnAtAsking * 100) / 100,
    actualPricePerUnit: Math.round(actualPricePerUnit),
    actualPricePerSqFt,
    expenseRatio: Math.round(expenseRatio * 10000) / 10000,

    // Financement
    downPaymentRequired: Math.round(downPaymentRequired),
    loanAmount: Math.round(loanAmountAtAsking),
    monthlyMortgagePayment,
    annualMortgagePayment: Math.round(annualDebtServiceAtAsking),
    annualCashFlow: Math.round(annualCashFlow),
    dscrAtAsking: Math.round(dscrAtAsking * 100) / 100,
    cashOnCashReturn: Math.round(cashOnCashReturn * 10000) / 10000,

    // Positionnement
    priceGapPct: Math.round(priceGapPct * 10000) / 10000,
    pricePositioning,

    // Avertissements
    hasExpensesWarning,

    // TGA Marché vs TGA Implicite (NOUVEAU)
    capRateImpliedAtAsking,
    capRateMarketSelected,
    marketCapRateMeta,
    valueByIncomeMarket,
    comparableBenchmarks,
    warnings,
    warningLowCapRate,
  };
}

// ============================================================================
// FONCTIONS UTILITAIRES POUR CONVERSION DEPUIS DONNÉES EXISTANTES
// ============================================================================

/**
 * Convertit les données financières existantes (format Firestore) vers ValuationInputs
 *
 * Supporte deux formats de données:
 * 1. Format plat: financialData.salaires, financialData.energie, etc.
 * 2. Format imbriqué (FinancialDetailsTabV2): financialData.depenses.salairesAvantages, etc.
 */
export function mapFirestoreDataToValuationInputs(
  residenceData: Record<string, unknown>,
  financialData: Record<string, unknown>
): Partial<ValuationInputs> {
  // Récupérer l'objet depenses si présent (format FinancialDetailsTabV2)
  const depenses = (financialData.depenses as Record<string, unknown>) || {};

  // Helper pour récupérer une valeur numérique depuis plusieurs sources possibles
  const getNum = (...sources: unknown[]): number => {
    for (const src of sources) {
      const val = Number(src);
      if (!isNaN(val) && val !== 0) return val;
    }
    return 0;
  };

  // Mappage des dépenses standard - supporte les deux formats
  const operatingExpenses: Record<string, number> = {
    // Salaires: format imbriqué (salairesAvantages) ou plat (salaires)
    salaires: getNum(depenses.salairesAvantages, financialData.salaires),

    // Énergie: électricité + gaz/mazout
    energie: getNum(depenses.electricite, financialData.energie, financialData.electriciteGaz) +
             getNum(depenses.gazMazout),

    // Nourriture
    nourriture: getNum(depenses.nourritures, financialData.nourriture, financialData.achatsNourriture),

    // Assurances
    assurances: getNum(depenses.assurances, financialData.assurances),

    // Taxes municipales et scolaires + taxes/permis
    taxes: getNum(depenses.taxesMunicipalesScolaire, financialData.taxes) +
           getNum(depenses.taxesPermis, financialData.taxesPermis),

    // Entretien et réparation
    entretien: getNum(depenses.entretienReparation, financialData.entretien, financialData.entretienReparation),

    // Télécommunications
    telecommunications: getNum(depenses.telecommunications, financialData.telecommunications),

    // Location équipements
    locationEquipements: getNum(depenses.locationEquipements, financialData.locationEquipements),

    // Honoraires professionnels
    honorairesProfessionnels: getNum(depenses.honorairesProfessionnels, financialData.honorairesProfessionnels),

    // Comptabilité et frais légaux
    comptabilite: getNum(depenses.comptabilite, financialData.comptabilite, financialData.comptabiliteFraisLegaux) +
                  getNum(depenses.fraisLegaux),

    // Fournitures bureau
    fournituresBureau: getNum(depenses.fournituresBureau, financialData.fournituresBureau),

    // Fournitures générales (cuisine, entretien ménager, générales)
    fournituresGenerales: getNum(depenses.fournituresCuisine) +
                          getNum(depenses.fournituresEntretienMenager) +
                          getNum(depenses.fournituresGenerales),

    // Publicité
    publicite: getNum(depenses.publicite, financialData.publicite),

    // Ascenseur
    ascenseur: getNum(depenses.ascenseur, financialData.ascenseur),

    // Fournitures médicales
    fournituresMedicales: getNum(depenses.fournituresMedicales, financialData.fournituresMedicales),

    // Formation et loisirs
    formation: getNum(depenses.fraisFormation, financialData.formation, financialData.fraisFormationLoisir) +
               getNum(depenses.fraisLoisir),

    // Agence de placement
    agencePlacement: getNum(depenses.honorairesAgencePlacement, depenses.honoraireAgencePlacement,
                           financialData.agencePlacement, financialData.honorairesAgencePlacement),

    // Sous-traitance
    sousTraitance: getNum(depenses.sousTraitance, financialData.sousTraitance),

    // Divers
    divers: getNum(depenses.divers, financialData.divers),

    // Frais de déplacement
    fraisDeplacements: getNum(depenses.fraisDeplacements),

    // Frais de représentation
    fraisRepresentation: getNum(depenses.fraisRepresentation),
  };

  // Dépenses personnalisées - supporte les deux formats
  const customExpenses: { label: string; amount: number }[] = [];

  // Format imbriqué: depenses.autresDepenses avec {nom, montant}
  if (Array.isArray(depenses.autresDepenses)) {
    for (const dep of depenses.autresDepenses) {
      if (dep && typeof dep === 'object') {
        const depObj = dep as Record<string, unknown>;
        const montant = Number(depObj.montant) || 0;
        if (montant > 0) {
          customExpenses.push({
            label: String(depObj.nom || ''),
            amount: montant,
          });
        }
      }
    }
  }

  // Format plat: financialData.autresDepenses avec {label, amount}
  if (Array.isArray(financialData.autresDepenses)) {
    for (const dep of financialData.autresDepenses) {
      if (dep && typeof dep === 'object') {
        const depObj = dep as Record<string, unknown>;
        const amount = Number(depObj.amount) || 0;
        if (amount > 0) {
          customExpenses.push({
            label: String(depObj.label || ''),
            amount: amount,
          });
        }
      }
    }
  }

  // Récupérer l'objet financement si présent (format FinancialDetailsTabV2)
  const financement = (financialData.financement as Record<string, unknown>) || {};
  const parametres = (financialData.parametres as Record<string, unknown>) || {};

  // Helper pour taux en % (convertit 5.5 -> 0.055)
  const getRate = (...sources: unknown[]): number => {
    for (const src of sources) {
      const val = Number(src);
      if (!isNaN(val) && val > 0) {
        // Si la valeur est > 1, on suppose qu'elle est en pourcentage
        return val > 1 ? val / 100 : val;
      }
    }
    return 0;
  };

  return {
    askingPrice: getNum(financialData.prixDemande, residenceData.prixAnnonce, residenceData.askingPrice),
    units: getNum(financialData.nombreUnites, residenceData.nombreUnites, residenceData.unitsCount),
    floorAreaSqFt: getNum(financialData.superficieHabitable) || undefined,

    // Revenus
    potentialRevenue: getNum(financialData.revenus, financialData.revenusAnnuels),
    otherIncome: getNum(financialData.autresRevenus),
    vacancyRate: getRate(financialData.tauxVacance, financialData.tauxVacances) || 0.05,

    operatingExpenses,
    customExpenses,

    adjustments: {
      nonRecurring: getNum(financialData.ajustementNonRecurrent),
      ownerCompAdjustment: getNum(financialData.ajustementSalaireProprietaire),
      marketRentAdjustment: getNum(financialData.ajustementLoyerMarche),
      otherAdjustments: getNum(financialData.autresAjustements),
    },

    // Paramètres de marché cibles
    targetCapRate: getRate(parametres.tauxCapitalisation, financialData.tgaCible)
      || DEFAULT_VALUATION_PARAMS.targetCapRate,
    targetMRB: getNum(financialData.mrbCible) || DEFAULT_VALUATION_PARAMS.targetMRB,
    targetMRN: getNum(financialData.mrnCible) || DEFAULT_VALUATION_PARAMS.targetMRN,
    targetPricePerUnit: getNum(financialData.prixParUniteCible) || DEFAULT_VALUATION_PARAMS.targetPricePerUnit,

    weights: {
      capRate: getNum(financialData.poidsTga) || DEFAULT_VALUATION_PARAMS.weights.capRate,
      mrb: getNum(financialData.poidsMrb) || DEFAULT_VALUATION_PARAMS.weights.mrb,
      mrn: getNum(financialData.poidsMrn) || DEFAULT_VALUATION_PARAMS.weights.mrn,
      pricePerUnit: getNum(financialData.poidsPrixUnite) || DEFAULT_VALUATION_PARAMS.weights.pricePerUnit,
    },

    financing: {
      // Mise de fonds: format imbriqué (pourcentageHypotheque inverse) ou plat
      downPaymentPct: getRate(financialData.pctMiseDeFonds)
        || (financement.pourcentageHypotheque ? 1 - getRate(financement.pourcentageHypotheque) : 0)
        || DEFAULT_VALUATION_PARAMS.financing.downPaymentPct,

      // Taux d'intérêt
      interestRate: getRate(financement.tauxInteret, financialData.tauxInteret)
        || DEFAULT_VALUATION_PARAMS.financing.interestRate,

      // Amortissement
      amortYears: getNum(financement.amortissement, financement.amortissementBanque, financialData.amortissement)
        || DEFAULT_VALUATION_PARAMS.financing.amortYears,

      // DSCR exigé
      requiredDscr: getNum(financement.dscr, financialData.dscrExige, financement.ratioCouverture)
        || DEFAULT_VALUATION_PARAMS.financing.requiredDscr,

      // TGA prêteur
      lenderCapRate: getRate(financement.tgaPreteur, financialData.tgaPreteur)
        || DEFAULT_VALUATION_PARAMS.financing.lenderCapRate,

      // LTV maximum
      lenderLtvMax: getRate(financement.ltv, financialData.ltvMax)
        || DEFAULT_VALUATION_PARAMS.financing.lenderLtvMax,
    },
  };
}

/**
 * Crée des inputs de valorisation avec des valeurs par défaut
 */
export function createDefaultValuationInputs(
  overrides?: Partial<ValuationInputs>
): ValuationInputs {
  const defaults: ValuationInputs = {
    askingPrice: 0,
    units: 0,
    potentialRevenue: 0,
    otherIncome: 0,
    vacancyRate: 0.05,
    operatingExpenses: {},
    customExpenses: [],
    adjustments: DEFAULT_VALUATION_PARAMS.adjustments,
    targetCapRate: DEFAULT_VALUATION_PARAMS.targetCapRate,
    targetMRB: DEFAULT_VALUATION_PARAMS.targetMRB,
    targetMRN: DEFAULT_VALUATION_PARAMS.targetMRN,
    targetPricePerUnit: DEFAULT_VALUATION_PARAMS.targetPricePerUnit,
    weights: DEFAULT_VALUATION_PARAMS.weights,
    financing: DEFAULT_VALUATION_PARAMS.financing,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// FONCTION DE VALORISATION AVEC PROFIL
// ============================================================================

/**
 * Calcule la valorisation en utilisant un profil de marché prédéfini
 *
 * Cette fonction applique automatiquement les paramètres du profil
 * (TGA, MRB, MRN, DSCR, LTV, etc.) aux calculs de valorisation.
 *
 * @param inputs - Données d'entrée de base (revenus, dépenses, etc.)
 * @param profileId - ID du profil à utiliser
 * @returns Résultats de valorisation + informations sur le profil utilisé
 *
 * @example
 * ```typescript
 * const results = computeValuationWithProfile(inputs, 'RPA_REGION_40_80');
 * console.log(results.profile.label); // "RPA Régionale (40-80 unités)"
 * console.log(results.valuation.suggestedPrice);
 * ```
 */
export function computeValuationWithProfile(
  inputs: Partial<ValuationInputs>,
  profileId: ValuationProfileId
): {
  valuation: ValuationOutputs;
  profile: ValuationProfile;
  inputsUsed: ValuationInputs;
} {
  const profile = getValuationProfile(profileId);

  // Vérifier si un TGA personnalisé est fourni (prioritaire sur le profil)
  const hasCustomCapRate = inputs.targetCapRate !== undefined && inputs.targetCapRate > 0;

  // Construire les inputs complets en appliquant le profil
  const fullInputs = createDefaultValuationInputs({
    ...inputs,
    // Appliquer les paramètres du profil (ou personnalisé pour le TGA)
    targetCapRate: hasCustomCapRate ? inputs.targetCapRate : profile.capRateTarget,
    targetMRB: profile.mrbTarget,
    targetMRN: profile.mrnTarget,
    weights: {
      capRate: profile.weights.income,
      mrb: profile.weights.mrb,
      mrn: 0,
      pricePerUnit: 0,
    },
    financing: {
      ...DEFAULT_VALUATION_PARAMS.financing,
      ...(inputs.financing || {}),
      // Paramètres du profil pour le financement
      lenderCapRate: profile.capRateLender,
      requiredDscr: profile.dscrMin,
      lenderLtvMax: profile.ltvMax,
      // Limiter l'amortissement à 20 ans maximum
      amortYears: Math.min(
        inputs.financing?.amortYears || DEFAULT_VALUATION_PARAMS.financing.amortYears,
        20
      ),
    },
  });

  const valuation = calculateValuation(fullInputs);

  return {
    valuation,
    profile,
    inputsUsed: fullInputs,
  };
}

/**
 * Calcule la valorisation avec suggestion automatique de profil
 *
 * Cette fonction détermine automatiquement le profil approprié basé sur:
 * - Le nombre d'unités
 * - La localisation (ville)
 * - Le taux d'occupation (optionnel)
 *
 * @param inputs - Données d'entrée incluant units et optionnellement ville/occupation
 * @param ville - Ville ou région pour la suggestion
 * @param occupancyRate - Taux d'occupation (0-1) pour détecter les RPA en redressement
 * @returns Résultats de valorisation + profil suggéré
 */
export function computeValuationWithAutoProfile(
  inputs: Partial<ValuationInputs>,
  ville?: string,
  occupancyRate?: number
): {
  valuation: ValuationOutputs;
  profile: ValuationProfile;
  inputsUsed: ValuationInputs;
  profileWasSuggested: boolean;
} {
  const units = inputs.units || 0;
  const suggestedProfile = suggestValuationProfile(units, ville, occupancyRate);

  const result = computeValuationWithProfile(inputs, suggestedProfile.id);

  return {
    ...result,
    profileWasSuggested: true,
  };
}

/**
 * Applique un profil aux paramètres de valorisation par défaut
 *
 * Utile pour obtenir les valeurs du profil sans faire le calcul complet.
 *
 * @param profileId - ID du profil
 * @returns Paramètres de valorisation ajustés selon le profil
 */
export function getProfileDefaults(profileId: ValuationProfileId): typeof DEFAULT_VALUATION_PARAMS {
  const profile = getValuationProfile(profileId);

  return {
    ...DEFAULT_VALUATION_PARAMS,
    targetCapRate: profile.capRateTarget,
    targetMRB: profile.mrbTarget,
    targetMRN: profile.mrnTarget,
    weights: {
      capRate: profile.weights.income,
      mrb: profile.weights.mrb,
      mrn: 0,
      pricePerUnit: 0,
    },
    financing: {
      ...DEFAULT_VALUATION_PARAMS.financing,
      lenderCapRate: profile.capRateLender,
      requiredDscr: profile.dscrMin,
      lenderLtvMax: profile.ltvMax,
      amortYears: 20, // Maximum 20 ans
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export des types et fonctions de profils pour faciliter l'importation
export {
  type ValuationProfile,
  type ValuationProfileId,
  getValuationProfile,
  suggestValuationProfile,
  VALUATION_PROFILES,
} from './valuationProfiles';

export default calculateValuation;
