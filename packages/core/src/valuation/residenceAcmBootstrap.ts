/**
 * Bootstrap ACM résidence — SSOT financial/dataV2 + TGA médian GPS + marché territorial.
 */

import {
  normalizeFinancialData,
  type FinancialCalc,
  type FinancialDataV2Doc,
  type ResidenceFinancialHints,
} from '../financial/normalizeFinancialData';
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
import type { PropertyContext } from '../canonical/propertyContext';

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
      ? roundToNearestThousand(rne / (suggestedCapRatePct / 100))
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

// ============================================================================
// TRIPLE MOTEUR ACM — aiguillage hermétique par contexte de propriété
// ----------------------------------------------------------------------------
// RESIDENTIAL                  → méthode des PARITÉS (comparables physiques).
// COMMERCIAL_PLEX | RPA | CPE  → méthode du REVENU (revenu net d'exploitation
//                                (RNE) / taux de capitalisation global (TGA)),
//                                réutilise `bootstrapResidenceAcm` (SSOT financier).
//                                CPE est le miroir de RPA.
// ============================================================================

/** Caractéristiques physiques d'une propriété résidentielle (sujet ou comparable). */
export interface ResidentialPropertyFeatures {
  /** Superficie habitable (pi²). */
  livingAreaSqft?: number | null;
  /** Superficie du terrain (pi²). */
  lotSizeSqft?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  garageSpaces?: number | null;
  /** Année de construction. */
  yearBuilt?: number | null;
}

/** Comparable vendu — fiche Centris extraite par l'analyse IA. */
export interface ResidentialComparable extends ResidentialPropertyFeatures {
  id?: string;
  address?: string;
  /** Prix de vente confirmé ($). */
  salePrice: number;
  /** Date de vente (ISO). */
  saleDate?: string | null;
}

/** Propriété sujet à évaluer (méthode des parités). */
export interface ResidentialSubject extends ResidentialPropertyFeatures {
  id?: string;
  address?: string;
  askingPrice?: number | null;
}

/**
 * Grille d'ajustements résidentiels québécois — paramètres INJECTABLES.
 * Chaque taux exprime la valeur marchande d'une unité de différence entre le
 * sujet et un comparable (méthode des parités).
 */
export interface ResidentialAdjustmentGrid {
  /** $ / pi² habitable. */
  pricePerLivingSqft: number;
  /** $ / pi² de terrain. */
  pricePerLotSqft: number;
  /** $ par chambre. */
  pricePerBedroom: number;
  /** $ par salle de bain. */
  pricePerBathroom: number;
  /** $ par espace de garage. */
  pricePerGarageSpace: number;
  /** $ par année de construction plus récente. */
  pricePerYearNewer: number;
  /** Plafond d'ajustement net (% du prix de vente du comparable) — garde-fou. */
  maxNetAdjustmentPct: number;
}

/**
 * Grille de DÉMARRAGE — valeurs indicatives à CALIBRER par le courtier / PO
 * selon le secteur (norme OACIQ : aucune valeur figée comme vérité absolue).
 */
export const DEFAULT_RESIDENTIAL_ADJUSTMENT_GRID: ResidentialAdjustmentGrid = {
  pricePerLivingSqft: 150,
  pricePerLotSqft: 8,
  pricePerBedroom: 7000,
  pricePerBathroom: 9000,
  pricePerGarageSpace: 12000,
  pricePerYearNewer: 1200,
  maxNetAdjustmentPct: 25,
};

/** Comparable après application de la grille de parités. */
export interface AdjustedResidentialComparable extends ResidentialComparable {
  /** Ajustement net appliqué au prix de vente ($). */
  netAdjustment: number;
  /** Valeur indiquée par ce comparable (prix de vente + ajustement net). */
  adjustedValue: number;
  /** Ajustement net en % du prix de vente. */
  netAdjustmentPct: number;
  /** Ajustement plafonné par le garde-fou `maxNetAdjustmentPct`. */
  capped: boolean;
}

/** Résultat de la méthode des parités (ACM résidentiel physique). */
export interface PhysicalAcmResult {
  method: 'physical_parity';
  /** Valeur indiquée (médiane des comparables ajustés), arrondie au millier. */
  indicatedValue: number;
  valueLow: number;
  valueHigh: number;
  comparableCount: number;
  adjustedComparables: AdjustedResidentialComparable[];
  rationaleFr: string;
  rationaleEn: string;
}

function featureDelta(subject?: number | null, comparable?: number | null): number {
  const s = finiteNum(subject);
  const c = finiteNum(comparable);
  if (s == null || c == null) return 0;
  return s - c;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Méthode des PARITÉS — ACM résidentiel par comparables physiques.
 * Chaque comparable est ajusté vers le sujet ; la valeur indiquée est la médiane
 * des valeurs ajustées (robuste aux comparables aberrants).
 */
export function executePhysicalAcmMatch(
  subject: ResidentialSubject,
  comparables: ResidentialComparable[],
  grid: ResidentialAdjustmentGrid = DEFAULT_RESIDENTIAL_ADJUSTMENT_GRID
): PhysicalAcmResult {
  const adjustedComparables: AdjustedResidentialComparable[] = comparables
    .filter((c) => finiteNum(c.salePrice) != null && (finiteNum(c.salePrice) ?? 0) > 0)
    .map((c) => {
      const rawAdjustment =
        featureDelta(subject.livingAreaSqft, c.livingAreaSqft) * grid.pricePerLivingSqft +
        featureDelta(subject.lotSizeSqft, c.lotSizeSqft) * grid.pricePerLotSqft +
        featureDelta(subject.bedrooms, c.bedrooms) * grid.pricePerBedroom +
        featureDelta(subject.bathrooms, c.bathrooms) * grid.pricePerBathroom +
        featureDelta(subject.garageSpaces, c.garageSpaces) * grid.pricePerGarageSpace +
        featureDelta(subject.yearBuilt, c.yearBuilt) * grid.pricePerYearNewer;

      const cap = (Math.abs(grid.maxNetAdjustmentPct) / 100) * c.salePrice;
      const capped = Math.abs(rawAdjustment) > cap;
      const netAdjustment = capped ? Math.sign(rawAdjustment) * cap : rawAdjustment;
      const adjustedValue = c.salePrice + netAdjustment;

      return {
        ...c,
        netAdjustment,
        adjustedValue,
        netAdjustmentPct: c.salePrice > 0 ? (netAdjustment / c.salePrice) * 100 : 0,
        capped,
      };
    });

  const adjustedValues = adjustedComparables.map((c) => c.adjustedValue);
  const indicatedValue = roundToNearestThousand(median(adjustedValues));
  const valueLow = adjustedValues.length
    ? roundToNearestThousand(Math.min(...adjustedValues))
    : 0;
  const valueHigh = adjustedValues.length
    ? roundToNearestThousand(Math.max(...adjustedValues))
    : 0;

  const n = adjustedComparables.length;
  return {
    method: 'physical_parity',
    indicatedValue,
    valueLow,
    valueHigh,
    comparableCount: n,
    adjustedComparables,
    rationaleFr:
      n > 0
        ? `Analyse comparative de marché (ACM) résidentielle par la méthode des parités sur ${n} comparable(s) vendu(s) ajusté(s).`
        : 'Aucun comparable vendu exploitable pour la méthode des parités.',
    rationaleEn:
      n > 0
        ? `Residential comparative market analysis (CMA) using the parity method on ${n} adjusted sold comparable(s).`
        : 'No usable sold comparable for the parity method.',
  };
}

/** Entrée unifiée de l'aiguilleur ACM quad-contexte. */
export interface ResolveResidenceAcmInput {
  /** Contexte de propriété (SSOT `@primexpert/core/canonical`). */
  context: PropertyContext;
  // --- Voie financière (COMMERCIAL_PLEX | RPA | CPE) ---
  residence?: ResidenceAcmIdentity;
  residenceDoc?: Record<string, unknown> | null;
  financialData?: FinancialDataV2Doc | Record<string, unknown> | null;
  financialOptions?: { marketTransactions?: MarketGpsTransaction[] };
  // --- Voie physique (RESIDENTIAL) ---
  subject?: ResidentialSubject;
  comparables?: ResidentialComparable[];
  adjustmentGrid?: ResidentialAdjustmentGrid;
}

export type AcmEngineResult = PhysicalAcmResult | ResidenceAcmBootstrap | null;

/** Méthode du revenu (RNE / TGA) — réutilise le SSOT financier existant. */
export function executeFinancialAcmMatch(
  input: ResolveResidenceAcmInput
): ResidenceAcmBootstrap | null {
  if (!input.residence) return null;
  return bootstrapResidenceAcm(
    input.residence,
    input.residenceDoc,
    input.financialData,
    input.financialOptions
  );
}

/**
 * Aiguilleur hermétique du triple moteur ACM par contexte de propriété.
 * RESIDENTIAL → parités physiques ; COMMERCIAL_PLEX / RPA / CPE → revenu.
 */
export function resolveResidenceAcm(input: ResolveResidenceAcmInput): AcmEngineResult {
  switch (input.context) {
    case 'RESIDENTIAL':
      return executePhysicalAcmMatch(
        input.subject ?? {},
        input.comparables ?? [],
        input.adjustmentGrid
      );
    case 'COMMERCIAL_PLEX':
    case 'RPA':
    case 'CPE':
      return executeFinancialAcmMatch(input);
  }
}
