/**
 * Module de Valorisation RPA
 *
 * Exports centralisés pour le moteur de valorisation et les profils de marché
 */

export {
  // Fonction principale
  calculateValuation,
  // Interfaces
  type ValuationInputs,
  type ValuationOutputs,
  // Constantes
  DEFAULT_VALUATION_PARAMS,
  // Fonctions utilitaires
  calculateMonthlyMortgagePayment,
  calculateDebtConstant,
  calculateDebtConstantSimple,
  calculateMaxLoanByDscr,
  computeVendorNet,
  roundToThousand,
  // Fonctions de conversion
  mapFirestoreDataToValuationInputs,
  createDefaultValuationInputs,
  // Fonctions avec profils
  computeValuationWithProfile,
  computeValuationWithAutoProfile,
  getProfileDefaults,
} from './valuationEngine';

// Formatage: utiliser directement import depuis '../../utils/formatting'
// Réexports supprimés (causaient bug de bundling Vite)

// Profils de valorisation
export {
  type ValuationProfile,
  type ValuationProfileId,
  VALUATION_PROFILES,
  BANK_REFERENCE_PARAMS,  // Paramètres bancaires de référence 2024-2025
  getValuationProfile,
  suggestValuationProfile,
  getAllValuationProfiles,
  isValidProfileId,
} from './valuationProfiles';

// Module Market Cap Rate (TGA de marché)
export {
  type ComparableCapRateSample,
  type MarketCapRateResult,
  type SelectMarketCapRateParams,
  selectMarketCapRate,
  mapComparablesToCapRateSamples,
  computeCapRateImpliedAtAsking,
  isAggressivePricing,
  computeStats,
} from './marketCapRate';

// Module Comparable Benchmarks (ratios moyens comparables)
export {
  type ComparableFinancialData,
  type ComparableBenchmarks,
  type ProfileBenchmarkDefaults,
  DEFAULT_MARKET_BENCHMARKS,
  computeComparableBenchmarks,
  mergeWithProfileDefaults,
  compareRatioToBenchmark,
  compareCapRateToBenchmark,
} from './comparableBenchmarks';

// Module TGA Prêteur Ajusté (calcul bancaire dynamique)
export {
  type LenderCapRateInput,
  type LenderCapRateResult,
  BASE_LENDER_CAP_RATES,
  PERFORMANCE_ADJUSTMENTS,
  RISK_ADJUSTMENTS,
  getBaseCapRateBySize,
  calculatePerformanceAdjustment,
  calculateRiskAdjustment,
  calculateAdjustedLenderCapRate,
  calculateBankValueWithAdjustedCapRate,
  compareSellerVsBankValue,
} from './lenderCapRate';

// Hook React (à importer séparément si besoin)
export { useValuation } from './useValuation';
