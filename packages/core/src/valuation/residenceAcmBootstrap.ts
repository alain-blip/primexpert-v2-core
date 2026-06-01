/**
 * Bootstrap ACM résidence — SSOT financial/dataV2 + TGA médian GPS + marché territorial.
 */

import {
  normalizeFinancialData,
  type FinancialCalc,
  type FinancialDataV2Doc,
  type ResidenceFinancialHints,
} from '../financial/normalizeFinancialData';
import {
  capitalizeNoiAtCapRatePct,
  normalizeCapRateToDecimal,
  normalizeCapRateToPct,
} from '../financial/capitalization';
import { applyCanonicalMetricsToCalc, resolveCanonicalFinancialMetrics } from '../financial/resolveCanonicalRne';
import type { MarketGpsTransaction } from '../market/marketGpsViewModel';
import {
  selectGpsCapRateMedian,
  resolveResidenceRpaBuildingClass,
  type GpsCapRateSource,
} from '../market/gpsCapRateByRegionClass';
import { parseMarketScope } from '../market/competitorSearch';
import {
  computePenetrationRate75,
  parseCompetitorsList,
  resolveMarcheDemographics,
  sumSectorRpaUnits,
  getSubjectUnitCount,
} from '../market';
import {
  calculateValuation,
  createDefaultValuationInputs,
  mapFirestoreDataToValuationInputs,
  type ValuationInputs,
} from './valuationEngine';

export interface ResidenceAcmIdentity {
  id?: string;
  address?: string;
  city?: string;
  region?: string;
  price?: number | null;
  residenceName?: string;
  nomCommercial?: string;
  name?: string;
  nombreUnites?: number | null;
  unitsCount?: number | null;
  unitesRPA?: number | null;
  nicheMetadata?: { nombreUnites?: number; rpaFields?: { careLevel?: string } };
}

export interface AcmMarketContext {
  sectorUnits: number;
  subjectUnits: number;
  competitorCount: number;
  population75Plus: number | null;
  radiusKm: number | null;
}

export interface ResidenceAcmBootstrap {
  residenceLabel: string;
  regionLabel: string | null;
  assetClassLabel: string | null;
  units: number;
  revenuBrutEffectif: number;
  revenuNetExploitation: number;
  /** true uniquement si RNE ≥ RBE — bloque la valorisation ACM */
  rneBlocksValuation: boolean;
  /** Avertissement affiché (RNE manquant, etc.) sans bloquer la valorisation */
  rneIntegrityOk: boolean;
  rneIntegrityIssueFr: string | null;
  rneIntegrityIssueEn: string | null;
  askingPrice: number;
  suggestedCapRatePct: number;
  targetCapRatePct: number;
  capRateSource: GpsCapRateSource;
  capRateSampleCount: number;
  capRateRationaleFr: string;
  capRateRationaleEn: string;
  penetrationRatePct: number;
  marketContext: AcmMarketContext;
  valuationAngles: {
    marketValue: number;
    regionalCapRatePerformanceValue: number;
    maxPotentialValue: number;
  };
  valuationInputs: ValuationInputs;
}

function finiteNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function roundToNearestThousand(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value / 1000) * 1000;
}

function buildMergedResidenceRecord(
  residence: ResidenceAcmIdentity,
  residenceDoc?: Record<string, unknown> | null
): Record<string, unknown> {
  return {
    ...(residenceDoc ?? {}),
    prixAnnonce: residence.price,
    askingPrice: residence.price,
    prixDemande: residence.price,
    nombreUnites:
      residence.nombreUnites ??
      residence.unitsCount ??
      residence.unitesRPA ??
      residence.nicheMetadata?.nombreUnites,
    nombreUnitesTotal: residence.nicheMetadata?.nombreUnites,
  };
}

function residenceFinancialHints(residence: ResidenceAcmIdentity): ResidenceFinancialHints {
  return {
    prixDemande: residence.price,
    askingPrice: residence.price,
    nombreUnites:
      residence.nombreUnites ??
      residence.unitsCount ??
      residence.nicheMetadata?.nombreUnites,
    nombreUnitesTotal: residence.nicheMetadata?.nombreUnites,
  };
}

function resolveResidenceLabel(
  residence: ResidenceAcmIdentity,
  residenceDoc?: Record<string, unknown> | null
): string {
  const candidates = [
    residence.residenceName,
    residence.nomCommercial,
    residence.name,
    residenceDoc?.nomCommercial,
    residenceDoc?.residenceName,
    residence.address,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return residence.city?.trim() || 'Résidence';
}

function resolveRegionLabel(
  residence: ResidenceAcmIdentity,
  residenceDoc?: Record<string, unknown> | null
): string | null {
  const candidates = [
    residence.region,
    residenceDoc?.regionAdministrative,
    residenceDoc?.region,
    residence.city,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

function resolveMarketContext(
  residence: ResidenceAcmIdentity,
  residenceDoc?: Record<string, unknown> | null
): AcmMarketContext {
  const merged = buildMergedResidenceRecord(residence, residenceDoc);
  const competitors = parseCompetitorsList(merged);
  const demographics = resolveMarcheDemographics(merged);
  const subjectUnits = getSubjectUnitCount(merged);
  const sectorUnits = sumSectorRpaUnits(competitors, subjectUnits);
  const population75Plus = demographics.population75_plus;
  const scope = parseMarketScope(residenceDoc ?? null);
  const radiusKm =
    scope?.radiusKm != null && Number.isFinite(Number(scope.radiusKm))
      ? Number(scope.radiusKm)
      : null;

  return {
    sectorUnits,
    subjectUnits,
    competitorCount: competitors.length,
    population75Plus,
    radiusKm,
  };
}

function resolvePenetrationPct(
  residence: ResidenceAcmIdentity,
  residenceDoc?: Record<string, unknown> | null,
  marketContext?: AcmMarketContext
): number {
  const docPct =
    finiteNum(residenceDoc?.tauxPenetrationRPA) ?? finiteNum(residenceDoc?.penetrationRpa75);
  if (docPct != null) return docPct > 1 ? docPct : docPct * 100;

  const ctx = marketContext ?? resolveMarketContext(residence, residenceDoc);
  const pop75 = ctx.population75Plus;
  if (pop75 == null || ctx.sectorUnits <= 0) return 0;
  const rate = computePenetrationRate75(ctx.sectorUnits, pop75);
  return rate != null ? rate * 100 : 0;
}

/** Ancre le moteur de valorisation sur calculatedResults (RBE / RNE immuables). */
function applySsotToValuationInputs(
  inputs: ValuationInputs,
  calc: FinancialCalc,
  residence: ResidenceAcmIdentity,
  mergedRecord: Record<string, unknown>
): ValuationInputs {
  const rbe = finiteNum(calc.revenuBrutEffectif) ?? finiteNum(calc.revenusAnnuels) ?? 0;
  const rne = finiteNum(calc.revenuNetExploitation) ?? 0;
  const autresRevenus = finiteNum(calc.autresRevenus) ?? inputs.otherIncome ?? 0;

  const asking =
    finiteNum(calc.prixDemande) ??
    finiteNum(residence.price) ??
    finiteNum(mergedRecord.prixDemande) ??
    inputs.askingPrice;

  const units =
    finiteNum(calc.nombreUnites) ??
    getSubjectUnitCount(mergedRecord) ??
    inputs.units;

  const next: ValuationInputs = {
    ...inputs,
    askingPrice: asking > 0 ? asking : inputs.askingPrice,
    units: units > 0 ? units : Math.max(1, inputs.units || 1),
    otherIncome: autresRevenus,
  };

  if (rbe > 0) {
    next.potentialRevenue = Math.max(0, rbe - autresRevenus);
    next.vacancyRate = 0;
  }

  if (rbe > 0 && rne >= 0) {
    const opex = Math.max(0, rbe - rne);
    next.operatingExpenses = {};
    next.customExpenses = [
      {
        label: 'Dépenses d’exploitation (SSOT — revenu net d’exploitation)',
        amount: opex,
      },
    ];
  }

  return next;
}

export function hasValidatedFinancialData(
  financialData: FinancialDataV2Doc | Record<string, unknown> | null | undefined,
  residence: ResidenceFinancialHints = {}
): boolean {
  const normalized = normalizeFinancialData(
    financialData as FinancialDataV2Doc | null | undefined,
    residence
  );
  if (!normalized.hasFinancials || !normalized.calc) return false;
  const calc = normalized.calc;
  const rne = finiteNum(calc.revenuNetExploitation);
  const rbe = finiteNum(calc.revenuBrutEffectif) ?? finiteNum(calc.revenusAnnuels);
  return (rne != null && rne !== 0) || (rbe != null && rbe !== 0);
}

export function bootstrapResidenceAcm(
  residence: ResidenceAcmIdentity,
  residenceDoc: Record<string, unknown> | null | undefined,
  financialData: FinancialDataV2Doc | Record<string, unknown> | null | undefined,
  options?: { marketTransactions?: MarketGpsTransaction[] }
): ResidenceAcmBootstrap | null {
  const hints = residenceFinancialHints(residence);
  const normalized = normalizeFinancialData(
    financialData as FinancialDataV2Doc | null | undefined,
    hints
  );
  if (!normalized.calc || !hasValidatedFinancialData(financialData, hints)) return null;

  const calc = normalized.calc;
  const metrics = resolveCanonicalFinancialMetrics(calc, normalized.baseData);
  const canonicalCalc = applyCanonicalMetricsToCalc(calc, normalized.baseData);
  const rbe = metrics.rbe ?? 0;
  const rne =
    metrics.rne ??
    finiteNum(canonicalCalc.revenuNetExploitation) ??
    finiteNum(calc.revenuNetExploitation) ??
    0;

  const mergedRecord = buildMergedResidenceRecord(residence, residenceDoc);
  const partial = mapFirestoreDataToValuationInputs(
    mergedRecord,
    (financialData ?? {}) as Record<string, unknown>
  );
  let valuationInputs = createDefaultValuationInputs(partial);
  valuationInputs = applySsotToValuationInputs(
    valuationInputs,
    canonicalCalc,
    residence,
    mergedRecord
  );

  const regionLabel = resolveRegionLabel(residence, residenceDoc);
  const assetClassLabel = resolveResidenceRpaBuildingClass(residenceDoc, residence);
  const marketContext = resolveMarketContext(residence, residenceDoc);

  const calcTgaPct =
    normalizeCapRateToPct(
      finiteNum(calc.tauxCapitalisation),
      normalizeCapRateToPct(valuationInputs.targetCapRate, 8.5)
    ) ?? 8.5;

  const gpsSelection = selectGpsCapRateMedian({
    transactions: options?.marketTransactions ?? [],
    region: regionLabel ?? residence.city ?? 'Québec',
    city: residence.city,
    buildingClass: assetClassLabel,
    fallbackPct: calcTgaPct,
  });

  const suggestedCapRatePct = gpsSelection.capRatePct;
  valuationInputs.targetCapRate =
    normalizeCapRateToDecimal(suggestedCapRatePct, valuationInputs.targetCapRate) ??
    valuationInputs.targetCapRate;

  const askingPrice =
    finiteNum(calc.prixDemande) ??
    finiteNum(residence.price) ??
    valuationInputs.askingPrice;

  const valuationOutputs = calculateValuation({
    ...valuationInputs,
    valuationMode: 'acm_unified_cap',
  });
  const regionalCapRatePerformanceValue =
    rne > 0 && suggestedCapRatePct > 0
      ? roundToNearestThousand(capitalizeNoiAtCapRatePct(rne, suggestedCapRatePct) ?? 0)
      : 0;

  return {
    residenceLabel: resolveResidenceLabel(residence, residenceDoc),
    regionLabel,
    assetClassLabel,
    units: valuationInputs.units,
    revenuBrutEffectif: rbe,
    revenuNetExploitation: rne,
    rneBlocksValuation: rbe > 0 && rne > 0 && rne >= rbe,
    rneIntegrityOk: metrics.rneIntegrityOk,
    rneIntegrityIssueFr: metrics.rneIntegrityIssueFr,
    rneIntegrityIssueEn: metrics.rneIntegrityIssueEn,
    askingPrice: askingPrice > 0 ? askingPrice : valuationInputs.askingPrice,
    suggestedCapRatePct,
    targetCapRatePct: suggestedCapRatePct,
    capRateSource: gpsSelection.source,
    capRateSampleCount: gpsSelection.sampleCount,
    capRateRationaleFr: gpsSelection.rationaleFr,
    capRateRationaleEn: gpsSelection.rationaleEn,
    penetrationRatePct: resolvePenetrationPct(residence, residenceDoc, marketContext),
    marketContext,
    valuationAngles: {
      marketValue: valuationOutputs.valueByIncomeMarket,
      regionalCapRatePerformanceValue,
      maxPotentialValue: valuationOutputs.suggestedHigh,
    },
    valuationInputs,
  };
}

export function buildValuationInputsFromAcmBootstrap(
  bootstrap: ResidenceAcmBootstrap,
  overrides?: { targetCapRate?: number; penetrationRatePct?: number }
): ValuationInputs {
  let targetCapRate = bootstrap.valuationInputs.targetCapRate;
  if (overrides?.targetCapRate !== undefined) {
    targetCapRate = overrides.targetCapRate;
  }
  return {
    ...bootstrap.valuationInputs,
    targetCapRate,
    valuationMode: 'acm_unified_cap',
    weights: { capRate: 1, mrb: 0, mrn: 0, pricePerUnit: 0 },
  };
}
