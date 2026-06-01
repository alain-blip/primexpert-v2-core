import {
  buildValuationInputsFromAcmBootstrap,
  calculatePriceRecommendation,
  calculateValuation,
  capRateRangeFromMedian,
  classifyAssetSize,
  computeTgaAdjustment,
  createDefaultValuationInputs,
  inferMarketType,
  runStressTests,
  selectBaselineStressTest,
  type ResidenceAcmBootstrap,
  type TgaAdjustmentResult,
  type ValuationOutputs,
} from '../valuation';

export interface AcmStressSummary {
  occ85: number;
  occ90: number;
  occ100: number;
}

export interface AcmValuationPresentationResult {
  result: ValuationOutputs;
  tgaAdjustment: TgaAdjustmentResult | null;
  effectiveCapRate: number;
  stressSummary: AcmStressSummary;
  recommendedPrice: number;
}

export interface ComputeSimpleAcmValuationPresentationInput {
  askingPrice: number;
  units: number;
  potentialRevenue: number;
  otherIncome: number;
  vacancyRatePct: number;
  operatingExpensesTotal: number;
  targetCapRatePct: number;
  penetrationRatePct: number;
  marketLabel?: string;
}

function resolveAdjustedCapRate(
  baseCapRate: number,
  penetrationRatePct: number,
  units: number
): { effectiveCapRate: number; tgaAdjustment: TgaAdjustmentResult | null } {
  if (penetrationRatePct <= 0) {
    return { effectiveCapRate: baseCapRate, tgaAdjustment: null };
  }

  const tgaAdjustment = computeTgaAdjustment({
    baseTga: baseCapRate,
    tauxPenetrationRPA: penetrationRatePct / 100,
    nombreUnites: units,
  });

  return {
    effectiveCapRate: tgaAdjustment.finalTga,
    tgaAdjustment,
  };
}

function buildStressSummary(
  result: ValuationOutputs,
  occupancy: number,
  effectiveCapRate: number,
  marketLabel = '',
  rbp?: number,
  operatingExpenses?: number
): { stressSummary: AcmStressSummary; recommendedPrice: number } {
  const capRange = capRateRangeFromMedian(effectiveCapRate);
  const stress =
    rbp != null && operatingExpenses != null
      ? runStressTests(result.noiAccounting, occupancy, effectiveCapRate, {
          rbp,
          operatingExpenses,
        })
      : runStressTests(result.noiAccounting, occupancy, capRange);
  const baseline = selectBaselineStressTest(occupancy, stress);
  const priceRecommendation = calculatePriceRecommendation(
    baseline,
    inferMarketType(marketLabel),
    classifyAssetSize(result.units),
    occupancy
  );

  return {
    stressSummary: {
      occ85: stress.occ85.valueRange.min,
      occ90: stress.occ90.valueRange.min,
      occ100: stress.occ100.valueRange.min,
    },
    recommendedPrice: priceRecommendation.recommendedListPrice,
  };
}

export function computeSimpleAcmValuationPresentation(
  input: ComputeSimpleAcmValuationPresentationInput
): AcmValuationPresentationResult {
  const { effectiveCapRate, tgaAdjustment } = resolveAdjustedCapRate(
    input.targetCapRatePct / 100,
    input.penetrationRatePct,
    input.units
  );

  const result = calculateValuation(
    createDefaultValuationInputs({
      askingPrice: input.askingPrice,
      units: input.units,
      potentialRevenue: input.potentialRevenue,
      otherIncome: input.otherIncome,
      vacancyRate: input.vacancyRatePct / 100,
      operatingExpenses: { total: input.operatingExpensesTotal },
      customExpenses: [],
      targetCapRate: effectiveCapRate,
      valuationMode: 'acm_unified_cap',
      weights: { capRate: 1, mrb: 0, mrn: 0, pricePerUnit: 0 },
    })
  );

  const occupancy = Math.max(0.01, 1 - input.vacancyRatePct / 100);
  const { stressSummary, recommendedPrice } = buildStressSummary(
    result,
    occupancy,
    effectiveCapRate,
    input.marketLabel ?? ''
  );

  return {
    result,
    tgaAdjustment,
    effectiveCapRate,
    stressSummary,
    recommendedPrice,
  };
}

export function computeResidenceAcmValuationPresentation(params: {
  bootstrap: ResidenceAcmBootstrap;
  targetCapRatePct: number;
  penetrationRatePct: number;
}): AcmValuationPresentationResult {
  const { bootstrap, targetCapRatePct, penetrationRatePct } = params;
  const { effectiveCapRate, tgaAdjustment } = resolveAdjustedCapRate(
    targetCapRatePct / 100,
    penetrationRatePct,
    bootstrap.units
  );

  const result = calculateValuation(
    buildValuationInputsFromAcmBootstrap(bootstrap, {
      targetCapRate: effectiveCapRate,
      penetrationRatePct,
    })
  );
  const vacancyRate = bootstrap.valuationInputs.vacancyRate;
  const occupancy = Math.max(0.01, 1 - vacancyRate);
  const { stressSummary } = buildStressSummary(
    result,
    occupancy,
    effectiveCapRate,
    bootstrap.regionLabel ?? '',
    result.grossPotentialIncome,
    result.operatingExpensesTotal
  );

  return {
    result,
    tgaAdjustment,
    effectiveCapRate,
    stressSummary,
    recommendedPrice: result.suggestedPrice,
  };
}
