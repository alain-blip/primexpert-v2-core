/**
 * Bootstrap ACM résidence — SSOT financial/dataV2 + TGA médian GPS.
 */

import type { FinancialCalc } from '../financial/normalizeFinancialData';
import type { MarketGpsTransaction } from '../market/marketGpsViewModel';
import {
  selectGpsCapRateMedian,
  resolveResidenceRpaBuildingClass,
  type GpsCapRateSource,
} from '../market/gpsCapRateByRegionClass';
import {
  computePenetrationRate75,
  parseCompetitorsList,
  resolveMarcheDemographics,
  sumSectorRpaUnits,
  getSubjectUnitCount,
} from '../market';
import {
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
  nicheMetadata?: { rpaFields?: { careLevel?: string }; nombreUnites?: number };
}

export interface ResidenceAcmBootstrap {
  residenceLabel: string;
  regionLabel: string | null;
  assetClassLabel: string | null;
  units: number;
  revenuBrutEffectif: number;
  revenuNetExploitation: number;
  askingPrice: number;
  suggestedCapRatePct: number;
  targetCapRatePct: number;
  capRateSource: GpsCapRateSource;
  capRateSampleCount: number;
  capRateRationaleFr: string;
  capRateRationaleEn: string;
  penetrationRatePct: number;
  valuationInputs: ValuationInputs;
}

function finiteNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

function resolvePenetrationPct(
  residence: ResidenceAcmIdentity,
  residenceDoc?: Record<string, unknown> | null
): number {
  const docPct =
    finiteNum(residenceDoc?.tauxPenetrationRPA) ?? finiteNum(residenceDoc?.penetrationRpa75);
  if (docPct != null) return docPct > 1 ? docPct : docPct * 100;

  const merged = { ...residence, ...(residenceDoc ?? {}) } as Record<string, unknown>;
  try {
    const competitors = parseCompetitorsList(merged);
    const demographics = resolveMarcheDemographics(merged);
    const subjectUnits = getSubjectUnitCount(merged);
    const sectorUnits = sumSectorRpaUnits(competitors, subjectUnits);
    const pop75 = demographics.population75_plus;
    if (pop75 == null) return 0;
    const rate = computePenetrationRate75(sectorUnits, pop75);
    return rate != null ? rate * 100 : 0;
  } catch {
    return 0;
  }
}

export function hasValidatedFinancialData(
  financialData: Record<string, unknown> | null | undefined
): boolean {
  const calc = financialData?.calculatedResults as FinancialCalc | null | undefined;
  if (!calc || typeof calc !== 'object') return false;
  const rne = finiteNum(calc.revenuNetExploitation);
  const rbe = finiteNum(calc.revenuBrutEffectif) ?? finiteNum(calc.revenusAnnuels);
  return (rne !== null && rne !== 0) || (rbe !== null && rbe !== 0);
}

export function bootstrapResidenceAcm(
  residence: ResidenceAcmIdentity,
  residenceDoc: Record<string, unknown> | null | undefined,
  financialData: Record<string, unknown> | null | undefined,
  options?: { marketTransactions?: MarketGpsTransaction[] }
): ResidenceAcmBootstrap | null {
  if (!hasValidatedFinancialData(financialData)) return null;

  const calc = financialData!.calculatedResults as FinancialCalc;
  const rbe = finiteNum(calc.revenuBrutEffectif) ?? finiteNum(calc.revenusAnnuels) ?? 0;
  const rne = finiteNum(calc.revenuNetExploitation) ?? 0;

  const residenceRecord: Record<string, unknown> = {
    ...(residenceDoc ?? {}),
    prixAnnonce: residence.price,
    askingPrice: residence.price,
    nombreUnites:
      residence.nombreUnites ?? residence.unitsCount ?? residence.unitesRPA,
  };

  const partial = mapFirestoreDataToValuationInputs(residenceRecord, financialData!);
  const valuationInputs = createDefaultValuationInputs(partial);

  const regionLabel = resolveRegionLabel(residence, residenceDoc);
  const assetClassLabel = resolveResidenceRpaBuildingClass(residenceDoc, residence);

  const calcTgaPct =
    finiteNum(calc.tauxCapitalisation) != null
      ? finiteNum(calc.tauxCapitalisation)! > 1
        ? finiteNum(calc.tauxCapitalisation)!
        : finiteNum(calc.tauxCapitalisation)! * 100
      : valuationInputs.targetCapRate > 0
        ? valuationInputs.targetCapRate * 100
        : 8.5;

  const gpsSelection = selectGpsCapRateMedian({
    transactions: options?.marketTransactions ?? [],
    region: regionLabel ?? residence.city ?? 'Québec',
    city: residence.city,
    buildingClass: assetClassLabel,
    fallbackPct: calcTgaPct,
  });

  const suggestedCapRatePct = gpsSelection.capRatePct;
  valuationInputs.targetCapRate = suggestedCapRatePct / 100;

  return {
    residenceLabel: resolveResidenceLabel(residence, residenceDoc),
    regionLabel,
    assetClassLabel,
    units: valuationInputs.units,
    revenuBrutEffectif: rbe,
    revenuNetExploitation: rne,
    askingPrice: valuationInputs.askingPrice,
    suggestedCapRatePct,
    targetCapRatePct: suggestedCapRatePct,
    capRateSource: gpsSelection.source,
    capRateSampleCount: gpsSelection.sampleCount,
    capRateRationaleFr: gpsSelection.rationaleFr,
    capRateRationaleEn: gpsSelection.rationaleEn,
    penetrationRatePct: resolvePenetrationPct(residence, residenceDoc),
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
  };
}
