/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/market/internalMarketFlywheel.ts
 * Régénéré : functions/scripts/sync-core-analytics-flywheel.cjs (prebuild)
 */
/**
 * Data Flywheel V3.5 — anonymisation et détection statuts transactionnels internes.
 * SSOT : alimentation provinciale `market_analytics_raw` sans PII.
 */

import { internalFlywheelFingerprint } from '../../documents/_vendored/marketDeduplication';

function computeFlywheelCapRatePct(input: {
  soldPrice: number;
  revenuBrutEffectif: number;
  depensesExploitation: number;
  netOperatingIncome: number;
}): number {
  if (!input.soldPrice || input.soldPrice <= 0) return 0;
  const rne =
    input.netOperatingIncome > 0
      ? input.netOperatingIncome
      : input.revenuBrutEffectif - input.depensesExploitation;
  if (!Number.isFinite(rne) || rne <= 0) return 0;
  return Number(((rne / input.soldPrice) * 100).toFixed(2));
}

export const INTERNAL_FLYWHEEL_DATA_SOURCE = 'internal_flywheel' as const;

export type FlywheelTransactionKind = 'promise' | 'sold';

export interface FlywheelPipelineColumn {
  kind: FlywheelTransactionKind;
  column: 'promise' | 'sold';
}

const FINALIZED_COLUMNS = new Set<FlywheelPipelineColumn['column']>(['promise', 'sold']);

const LEGACY_TO_COLUMN: Record<string, FlywheelPipelineColumn['column']> = {
  promise: 'promise',
  promesse: 'promise',
  'promesse-achat': 'promise',
  'pa-acceptee': 'promise',
  'pa_acceptee': 'promise',
  'due-diligence': 'promise',
  financement: 'promise',
  'transfert-permis': 'promise',
  sold: 'sold',
  vendu: 'sold',
  vendue: 'sold',
  cloture: 'sold',
  fermee: 'sold',
  fermée: 'sold',
  clos: 'sold',
  success: 'sold',
  succes: 'sold',
};

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeStatusToken(raw: unknown): string {
  if (raw == null) return '';
  return stripDiacritics(String(raw).trim().toLowerCase());
}

function extractStatusRaw(data: Record<string, unknown>): string {
  const raw =
    data.status ??
    data.pipelineStatus ??
    data.etat ??
    data.phase ??
    data.stage ??
    data.statut ??
    '';
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Résout la colonne pipeline canonique (promise | sold | null). */
export function resolveFlywheelPipelineColumn(
  data: Record<string, unknown> | null | undefined
): FlywheelPipelineColumn['column'] | null {
  if (!data) return null;
  const normalized = normalizeStatusToken(extractStatusRaw(data));
  if (!normalized) return null;
  if (normalized === 'promise' || normalized === 'sold') return normalized;
  if (LEGACY_TO_COLUMN[normalized]) return LEGACY_TO_COLUMN[normalized];

  const slug = normalized.replace(/[^a-z0-9]+/g, '');
  if (slug.includes('promess') || slug.includes('paaccept')) return 'promise';
  if (slug.includes('vendu') || slug.includes('vendue') || slug.includes('sold')) return 'sold';
  return null;
}

export function isFlywheelFinalizedColumn(
  column: FlywheelPipelineColumn['column'] | null | undefined
): column is FlywheelPipelineColumn['column'] {
  return column != null && FINALIZED_COLUMNS.has(column);
}

/** Transition vers PA acceptée ou vendu — autorise promise → sold comme second événement. */
export function detectFlywheelStatusTransition(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): FlywheelPipelineColumn | null {
  const prev = resolveFlywheelPipelineColumn(before ?? undefined);
  const next = resolveFlywheelPipelineColumn(after ?? undefined);
  if (next === 'promise' && prev !== 'promise' && prev !== 'sold') {
    return { kind: 'promise', column: 'promise' };
  }
  if (next === 'sold' && prev !== 'sold') {
    return { kind: 'sold', column: 'sold' };
  }
  return null;
}

/** FSALDU-3 — trois premiers caractères du code postal (ex. H2X). */
export function truncatePostalCodeToFsa3(raw: unknown): string {
  if (raw == null) return '';
  const compact = String(raw).toUpperCase().replace(/\s+/g, '').trim();
  if (!compact) return '';
  const match = compact.match(/^([A-Z]\d[A-Z])/);
  return match?.[1] ?? compact.slice(0, 3);
}

function parseNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function resolvePostalCode(data: Record<string, unknown>): string {
  const adresse = data.adresse as Record<string, unknown> | undefined;
  return truncatePostalCodeToFsa3(
    data.codePostal ??
      data.postalCode ??
      adresse?.codePostal ??
      adresse?.postalCode ??
      data.fsa
  );
}

function resolveCity(data: Record<string, unknown>): string {
  const adresse = data.adresse as Record<string, unknown> | undefined;
  const city = String(
    data.city ?? data.ville ?? data.municipalite ?? adresse?.ville ?? ''
  ).trim();
  return city || 'Quebec';
}

function resolveRegionAdministrative(data: Record<string, unknown>, city: string): string {
  const region = String(
    data.regionAdministrative ?? data.region ?? data.regionDossier ?? ''
  ).trim();
  return region || city;
}

function resolveAssetClassLabel(data: Record<string, unknown>): string {
  const niche = data.assetNiche ?? data.propertyType ?? data.residenceType ?? data.type;
  const classe = data.classeImmeuble ?? data.classe_immeuble ?? data.classeRpa;
  const label = String(classe ?? niche ?? 'rpa').trim();
  return label || 'rpa';
}

function resolveSiloType(data: Record<string, unknown>): string {
  const niche = String(data.assetNiche ?? data.propertyType ?? 'rpa_ri_chsld').trim();
  return niche || 'rpa_ri_chsld';
}

function resolveUnits(data: Record<string, unknown>): number | null {
  const units = parseNum(
    data.nombreUnitesTotal ?? data.nombreUnites ?? data.unitsCount ?? data.unitesRPA
  );
  return units > 0 ? units : null;
}

function resolveSuperficiePi2(data: Record<string, unknown>): number | null {
  const sqft = parseNum(
    data.superficieTotalePi2 ??
      data.superficiePi2 ??
      data.livingAreaSqft ??
      data.superficieTotale
  );
  return sqft > 0 ? sqft : null;
}

/** Prix de transaction pour le flywheel — PA acceptée vs clôture vendu. */
export function resolveFlywheelSoldPrice(
  data: Record<string, unknown>,
  kind: FlywheelTransactionKind
): number {
  const prixAccepte = parseNum(data.prixAccepte ?? (data.purchaseOffer as { prixAccepte?: unknown })?.prixAccepte);
  const listingPrice = parseNum(data.price ?? data.askingPrice ?? data.prixDemande);
  if (kind === 'promise') return prixAccepte > 0 ? prixAccepte : listingPrice;
  return prixAccepte > 0 ? prixAccepte : listingPrice;
}

export interface FlywheelFinancialSnapshot {
  revenuBrutEffectif: number;
  depensesExploitation: number;
  netOperatingIncome: number;
}

export function extractFlywheelFinancialSnapshot(
  financialData: Record<string, unknown> | null | undefined,
  residence: Record<string, unknown>
): FlywheelFinancialSnapshot {
  const calc = (financialData?.calculatedResults ?? {}) as Record<string, unknown>;
  const base = (financialData?.baseData ?? {}) as Record<string, unknown>;
  const depenses = (base.depenses ?? {}) as Record<string, unknown>;

  const rbe =
    parseNum(calc.revenuBrutEffectif) ||
    parseNum(residence.revenuBrutEffectif) ||
    parseNum(financialData?.revenuBrutEffectif);

  let totalDepenses = 0;
  if (depenses && typeof depenses === 'object') {
    for (const [key, val] of Object.entries(depenses)) {
      if (key === 'autresDepenses' || key === 'nonOpexExcluded') continue;
      totalDepenses += parseNum(val);
    }
  }

  const rne =
    parseNum(calc.revenuNetExploitation) ||
    parseNum(residence.revenuNetExploitation) ||
    (rbe > 0 && totalDepenses > 0 ? rbe - totalDepenses : 0);

  return {
    revenuBrutEffectif: rbe,
    depensesExploitation: totalDepenses,
    netOperatingIncome: rne,
  };
}

export interface AnonymizedFlywheelAnalyticsDoc {
  dedupeFingerprint: string;
  dataSource: typeof INTERNAL_FLYWHEEL_DATA_SOURCE;
  siloType: string;
  regionAdministrative: string;
  regionDisplayName: string;
  postalFsa3: string;
  anneeDonnees: number;
  provenance: 'internal_flywheel';
  validatedAmounts: [];
  comparableSnapshot: {
    city: string;
    units?: number;
    salePrice: number;
    capRatePct: number;
    netIncomePerUnit?: number;
    prixParPi2?: number;
    assetClassLabel: string;
  };
  marketTransactionMeta: {
    transactionKind: FlywheelTransactionKind;
    dateTransaction: string;
    typeImmeuble: string;
    nbPortes: number | null;
    prixParPi2: number | null;
  };
  injectedAtMillis: number;
}

export interface BuildAnonymizedFlywheelInput {
  residenceData: Record<string, unknown>;
  financialData?: Record<string, unknown> | null;
  transition: FlywheelPipelineColumn;
  closedAtMillis?: number;
}

/** Construit le document `market_analytics_raw` anonymisé (aucune PII). */
export function buildAnonymizedFlywheelAnalyticsDoc(
  input: BuildAnonymizedFlywheelInput
): AnonymizedFlywheelAnalyticsDoc | null {
  const { residenceData, financialData, transition } = input;
  const city = resolveCity(residenceData);
  const regionAdministrative = resolveRegionAdministrative(residenceData, city);
  const postalFsa3 = resolvePostalCode(residenceData);
  const assetClassLabel = resolveAssetClassLabel(residenceData);
  const siloType = resolveSiloType(residenceData);
  const soldPrice = resolveFlywheelSoldPrice(residenceData, transition.kind);
  if (!soldPrice || soldPrice <= 0) return null;

  const closedAtMillis = input.closedAtMillis ?? Date.now();
  const financials = extractFlywheelFinancialSnapshot(financialData, residenceData);
  const capRatePct = computeFlywheelCapRatePct({
    soldPrice,
    revenuBrutEffectif: financials.revenuBrutEffectif,
    depensesExploitation: financials.depensesExploitation,
    netOperatingIncome: financials.netOperatingIncome,
  });
  if (capRatePct <= 0) return null;

  const anneeDonnees = new Date(closedAtMillis).getUTCFullYear();
  const units = resolveUnits(residenceData);
  const superficiePi2 = resolveSuperficiePi2(residenceData);
  const prixParPi2 =
    superficiePi2 && superficiePi2 > 0 ? Number((soldPrice / superficiePi2).toFixed(2)) : null;
  const netIncomePerUnit =
    units && units > 0 && financials.netOperatingIncome > 0
      ? Number((financials.netOperatingIncome / units).toFixed(2))
      : undefined;

  const dedupeFingerprint = internalFlywheelFingerprint({
    regionAdministrative,
    postalFsa3,
    prixVente: soldPrice,
    anneeDonnees,
    assetClassLabel,
    transactionKind: transition.kind,
    siloType,
  });

  return {
    dedupeFingerprint,
    dataSource: INTERNAL_FLYWHEEL_DATA_SOURCE,
    siloType,
    regionAdministrative,
    regionDisplayName: city,
    postalFsa3,
    anneeDonnees,
    provenance: 'internal_flywheel',
    validatedAmounts: [],
    comparableSnapshot: {
      city,
      units: units ?? undefined,
      salePrice: soldPrice,
      capRatePct,
      netIncomePerUnit,
      prixParPi2: prixParPi2 ?? undefined,
      assetClassLabel,
    },
    marketTransactionMeta: {
      transactionKind: transition.kind,
      dateTransaction: new Date(closedAtMillis).toISOString().slice(0, 10),
      typeImmeuble: assetClassLabel,
      nbPortes: units,
      prixParPi2,
    },
    injectedAtMillis: closedAtMillis,
  };
}

export function buildFlywheelSnapshotRow(
  doc: AnonymizedFlywheelAnalyticsDoc
): Record<string, unknown> {
  return {
    dedupeFingerprint: doc.dedupeFingerprint,
    dataSource: doc.dataSource,
    ville: doc.regionDisplayName,
    prixVente: doc.comparableSnapshot.salePrice,
    nbPortes: doc.comparableSnapshot.units ?? doc.marketTransactionMeta.nbPortes,
    tgaPct: doc.comparableSnapshot.capRatePct,
    prixParPorte: doc.comparableSnapshot.netIncomePerUnit ?? null,
    prixParPi2: doc.comparableSnapshot.prixParPi2 ?? doc.marketTransactionMeta.prixParPi2,
    regionAdministrative: doc.regionAdministrative,
    postalFsa3: doc.postalFsa3,
    assetClassLabel: doc.comparableSnapshot.assetClassLabel,
    transactionKind: doc.marketTransactionMeta.transactionKind,
    validatedAtMillis: doc.injectedAtMillis,
  };
}
