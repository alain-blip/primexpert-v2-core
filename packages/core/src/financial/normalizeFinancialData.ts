/**
 * normalizeFinancialData — SSOT financier (port Copilote → TypeScript pur).
 * Zéro calcul dans l'UI : consommer uniquement les sorties de ce module.
 */

import { EXPENSE_KEYS } from './expenseKeys';
import { deriveRevenusAnnuelsFromTarification } from '../identity/rentPricingGrid';

const LEGACY_TAX_KEY = 'taxesMunicipalesScolaire';
const CANONICAL_TAX_KEY = 'taxesPermis';
const LEGACY_ENERGY_KEYS = ['electricite', 'gazMazout', 'chauffage'] as const;

export type FinancialDataSource = 'calculatedResults' | 'derivedData' | 'none';

export interface FinancialCalc {
  revenusAnnuels?: number | null;
  revenuBrutEffectif?: number | null;
  autresRevenus?: number | null;
  vacances?: number | null;
  depensesTotales?: number | null;
  depensesTotalesNormalisees?: number | null;
  revenuNetExploitation?: number | null;
  tauxCapitalisation?: number | null;
  facteurRevenuBrut?: number | null;
  facteurRevenuNet?: number | null;
  facteurDepenses?: number | null;
  prixDemande?: number | null;
  ratioCouvertureDette?: number | null;
  empruntMaxDSCR?: number | null;
  empruntMaxTransaction?: number | null;
  hypothequeMaxRecommandee?: number | null;
  surplusTresorerie?: number | null;
  cashFlow?: number | null;
  valeurBanquable?: number | null;
  valeurBanquableTransaction?: number | null;
  valeurCapitalisation?: number | null;
  valeurDSCRLTV?: number | null;
  paiementAnnuel?: number | null;
  paiementMensuel?: number | null;
  montantHypotheque?: number | null;
  miseDeFondsRequise?: number | null;
  amortissementBanque?: number | null;
  DC?: number | null;
  nombreUnites?: number | null;
  prixParUnite?: number | null;
  _source?: string;
  _confidence?: string | null;
  [key: string]: unknown;
}

export interface AutreDepenseRow {
  nom?: string;
  montant?: number | string | null;
}

export interface DepensesGrid {
  [key: string]: number | string | null | undefined | AutreDepenseRow[];
  autresDepenses?: AutreDepenseRow[];
}

export interface FinancialBaseData {
  revenusAnnuels?: number | string | null;
  nombreUnites?: number | null;
  depenses?: DepensesGrid | null;
  expenseAdjustments?: Record<string, unknown> | null;
  financement?: Record<string, unknown> | null;
  /** Revenus annexes RPA (import RPA / saisie courtier — chaînes acceptées). */
  revenusRepas?: number | string | null;
  revenusAutresServices?: number | string | null;
  revenusSubventions?: number | string | null;
  revenusLocauxCommerciaux?: number | string | null;
  revenusBuanderie?: number | string | null;
  revenusCoiffure?: number | string | null;
  revenusPodologie?: number | string | null;
  revenusAutres?: number | string | null;
  /** Stationnement payant — barème mensuel × nb places × 12. */
  tarifStationnement?: number | string | null;
  nbStationnementsPayants?: number | string | null;
  [key: string]: unknown;
}

export interface FinancialDataV2Doc {
  calculatedResults?: FinancialCalc | null;
  baseData?: FinancialBaseData | null;
  derivedData?: Record<string, unknown> | null;
}

export interface ResidenceFinancialHints {
  prixDemande?: number | null;
  askingPrice?: number | null;
  nombreUnitesTotal?: number | null;
  nombreUnites?: number | null;
  [key: string]: unknown;
}

export interface NormalizeFinancialResult {
  calc: FinancialCalc | null;
  baseData: FinancialBaseData | null;
  hasFinancials: boolean;
  source: FinancialDataSource;
}

export interface ReconciliationAudit {
  rbe: number | null;
  lineA: number | null;
  adjSum: number | null;
  lineC: number | null;
}

function safeNumExpense(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n =
    typeof val === 'string' ? parseFloat(String(val).replace(/[^\d.-]/g, '')) : Number(val);
  return Number.isFinite(n) ? n : null;
}

function legacyEnergyBrutTotal(depenses: DepensesGrid): number {
  return LEGACY_ENERGY_KEYS.reduce((sum, k) => sum + (safeNumExpense(depenses[k]) ?? 0), 0);
}

function legacyEnergyAdjTotal(expenseAdjustments: Record<string, unknown>): number {
  return LEGACY_ENERGY_KEYS.reduce(
    (sum, k) => sum + (safeNumExpense(expenseAdjustments[k]) ?? 0),
    0
  );
}

function declaredOperatingLineAmount(key: string, depenses: DepensesGrid): number {
  if (key === LEGACY_TAX_KEY) return 0;
  if (key === 'energie') {
    const e = safeNumExpense(depenses.energie);
    const hasExplicit = depenses.energie != null && String(depenses.energie).trim() !== '';
    if (hasExplicit) return e ?? 0;
    return legacyEnergyBrutTotal(depenses);
  }
  const brut = safeNumExpense(depenses[key]) ?? 0;
  if (key === CANONICAL_TAX_KEY) {
    return brut + (safeNumExpense(depenses[LEGACY_TAX_KEY]) ?? 0);
  }
  return brut;
}

export function normalizedOperatingAmount(
  key: string,
  depenses: DepensesGrid,
  expenseAdjustments: Record<string, unknown> = {}
): number {
  if (key === LEGACY_TAX_KEY) return 0;
  if (key === 'energie') {
    const eBrut = safeNumExpense(depenses.energie);
    const eAdj = safeNumExpense(expenseAdjustments.energie) ?? 0;
    const hasExplicit = depenses.energie != null && String(depenses.energie).trim() !== '';
    if (hasExplicit) return (eBrut ?? 0) + eAdj;
    return legacyEnergyBrutTotal(depenses) + legacyEnergyAdjTotal(expenseAdjustments);
  }
  const brut = safeNumExpense(depenses[key]) ?? 0;
  const adj = safeNumExpense(expenseAdjustments[key]) ?? 0;
  if (key === CANONICAL_TAX_KEY) {
    return (
      brut +
      adj +
      (safeNumExpense(depenses[LEGACY_TAX_KEY]) ?? 0) +
      (safeNumExpense(expenseAdjustments[LEGACY_TAX_KEY]) ?? 0)
    );
  }
  return brut + adj;
}

export function sumNormalizedOperatingExpenses(
  depenses: DepensesGrid | null | undefined,
  expenseAdjustments?: Record<string, unknown> | null
): number | null {
  if (!depenses || typeof depenses !== 'object') return null;
  const adj = expenseAdjustments ?? {};
  let total = 0;
  let hasAny = false;
  for (const k of EXPENSE_KEYS) {
    if (k === LEGACY_TAX_KEY) continue;
    const line = normalizedOperatingAmount(k, depenses, adj);
    total += line;
    if (line !== 0) hasAny = true;
  }
  const autres = depenses.autresDepenses ?? [];
  autres.forEach((dep, i) => {
    const brut = safeNumExpense(dep?.montant) ?? 0;
    const autresAdj = adj.autresDepenses;
    const adjVal = Array.isArray(autresAdj)
      ? safeNumExpense(autresAdj[i]) ?? 0
      : 0;
    total += brut + adjVal;
    if (brut !== 0 || adjVal !== 0) hasAny = true;
  });
  return hasAny ? total : null;
}

export function sumDeclaredOperatingExpensesGrid(depenses: DepensesGrid | null | undefined): number | null {
  if (!depenses || typeof depenses !== 'object') return null;
  let total = 0;
  let hasAny = false;
  for (const k of EXPENSE_KEYS) {
    if (k === LEGACY_TAX_KEY) continue;
    const brut = declaredOperatingLineAmount(k, depenses);
    total += brut;
    if (brut !== 0) hasAny = true;
  }
  const autres = depenses.autresDepenses ?? [];
  for (const dep of autres) {
    const brut = safeNumExpense(dep?.montant) ?? 0;
    total += brut;
    if (brut !== 0) hasAny = true;
  }
  return hasAny ? total : null;
}

export function sumExpenseAdjustmentsAlgebraic(
  expenseAdjustments: Record<string, unknown> | null | undefined
): number | null {
  if (!expenseAdjustments || typeof expenseAdjustments !== 'object') return null;
  let total = 0;
  let hasAny = false;
  for (const k of EXPENSE_KEYS) {
    if (k === LEGACY_TAX_KEY) continue;
    let adj = safeNumExpense(expenseAdjustments[k]) ?? 0;
    if (k === 'energie') {
      const hasExplicit =
        expenseAdjustments.energie != null && String(expenseAdjustments.energie).trim() !== '';
      if (!hasExplicit) adj = legacyEnergyAdjTotal(expenseAdjustments);
    }
    if (k === CANONICAL_TAX_KEY) {
      const legAdj = safeNumExpense(expenseAdjustments[LEGACY_TAX_KEY]) ?? 0;
      total += adj + legAdj;
      if (adj !== 0 || legAdj !== 0) hasAny = true;
    } else {
      total += adj;
      if (adj !== 0) hasAny = true;
    }
  }
  const autresAdj = expenseAdjustments.autresDepenses;
  if (Array.isArray(autresAdj)) {
    for (const v of autresAdj) {
      const adj = safeNumExpense(v) ?? 0;
      total += adj;
      if (adj !== 0) hasAny = true;
    }
  }
  return hasAny ? total : null;
}

function finiteNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(String(v).replace(/[^\d.-]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function getAuditNormalizedNoi(
  calc: FinancialCalc | null,
  baseData: FinancialBaseData | null
): number | null {
  if (!calc) return null;
  const fallback = finiteNum(calc.revenuNetExploitation);
  const rbe = finiteNum(calc.revenuBrutEffectif) ?? finiteNum(calc.revenusAnnuels);
  const depenses = baseData?.depenses;
  if (rbe == null || !depenses || typeof depenses !== 'object') return fallback;
  const norm = sumNormalizedOperatingExpenses(depenses, baseData?.expenseAdjustments ?? undefined);
  if (norm == null) return fallback;
  const lineC = rbe - norm;
  return Number.isFinite(lineC) ? lineC : fallback;
}

export function computeReconciliationAudit(
  calc: FinancialCalc | null,
  baseData: FinancialBaseData | null
): ReconciliationAudit {
  if (!calc) return { rbe: null, lineA: null, adjSum: null, lineC: null };
  const rbe = finiteNum(calc.revenuBrutEffectif) ?? finiteNum(calc.revenusAnnuels);
  const declExp =
    baseData?.depenses && typeof baseData.depenses === 'object'
      ? sumDeclaredOperatingExpensesGrid(baseData.depenses)
      : null;
  const adjSum = baseData?.expenseAdjustments
    ? sumExpenseAdjustmentsAlgebraic(baseData.expenseAdjustments as Record<string, unknown>)
    : null;
  const lineA = rbe != null && declExp != null ? rbe - declExp : null;
  const lineC =
    rbe != null && baseData?.depenses
      ? (() => {
          const norm = sumNormalizedOperatingExpenses(
            baseData.depenses,
            baseData.expenseAdjustments as Record<string, unknown> | undefined
          );
          return norm != null ? rbe - norm : null;
        })()
      : null;
  return { rbe, lineA, adjSum, lineC };
}

function safeNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parser tolérant pour montants financiers d'origine hétérogène
 * (RPA legacy, saisie courtier, imports CSV/PDF).
 * Toujours numérique, jamais NaN : `''`, `null`, `undefined`, mauvais types → 0.
 */
function parseSafeNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const raw = typeof val === 'string' ? val.replace(/[^\d.-]/g, '') : val;
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Clés RPA des revenus annexes (résidentiel + commercial + soins/services). */
const RPA_ANCILLARY_REVENUE_KEYS = [
  'revenusSubventions',
  'revenusRepas',
  'revenusAutresServices',
  'revenusLocauxCommerciaux',
  'revenusBuanderie',
  'revenusCoiffure',
  'revenusPodologie',
  'revenusAutres',
] as const;

function pickFromSources(
  sources: ReadonlyArray<Record<string, unknown> | null | undefined>,
  key: string
): number {
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    if (!(key in src)) continue;
    const value = (src as Record<string, unknown>)[key];
    if (value === null || value === undefined || value === '') continue;
    return parseSafeNumber(value);
  }
  return 0;
}

/**
 * Agrège les revenus annexes RPA en se promenant dans une chaîne de sources
 * (baseData, calculatedResults, residence). Retourne 0 si aucune donnée.
 */
export function sumRpaAncillaryRevenues(
  sources: ReadonlyArray<Record<string, unknown> | null | undefined>
): number {
  let total = 0;
  for (const key of RPA_ANCILLARY_REVENUE_KEYS) {
    total += pickFromSources(sources, key);
  }
  const tarif = pickFromSources(sources, 'tarifStationnement');
  const places = pickFromSources(sources, 'nbStationnementsPayants');
  if (tarif > 0 && places > 0) {
    total += tarif * places * 12;
  }
  return total;
}

/**
 * Enrichit le RBE pour intégrer les revenus annexes RPA quand ils existent
 * mais n'ont pas été agrégés en amont. Idempotent : ne régresse jamais un
 * RBE existant et n'altère pas le `calc` si aucun montant annexe RPA n'est
 * détecté. Le NOI, l'EM, le DSCR et la MFR cascadent automatiquement via
 * `computeBilanCfoViewModel` puisqu'ils reposent tous sur `revenuBrutEffectif`.
 */
function enrichCalcWithRpaAncillary(
  calc: FinancialCalc,
  baseData: FinancialBaseData | null,
  residence: ResidenceFinancialHints
): FinancialCalc {
  const sources: Array<Record<string, unknown> | null | undefined> = [
    baseData as Record<string, unknown> | null,
    calc as Record<string, unknown>,
    residence as Record<string, unknown>,
  ];
  const ancillaryRpa = sumRpaAncillaryRevenues(sources);
  if (ancillaryRpa <= 0) return calc;

  const baseLoyers =
    finiteNum(calc.revenusAnnuels) ??
    safeNum(baseData?.revenusAnnuels) ??
    deriveRevenusAnnuelsFromTarification(residence as Record<string, unknown>);
  if (baseLoyers == null || baseLoyers <= 0) return calc;

  const currentRbe = finiteNum(calc.revenuBrutEffectif) ?? baseLoyers;
  const rbeRpa = baseLoyers + ancillaryRpa;
  if (rbeRpa <= currentRbe + 1) return calc;

  const currentAutres = finiteNum(calc.autresRevenus) ?? 0;
  return {
    ...calc,
    revenuBrutEffectif: rbeRpa,
    autresRevenus: Math.max(currentAutres, ancillaryRpa),
  };
}

function sumDepenses(depenses: DepensesGrid | null | undefined): number | null {
  if (!depenses || typeof depenses !== 'object') return null;
  let total = 0;
  let hasAny = false;
  for (const [key, val] of Object.entries(depenses)) {
    if (key === 'autresDepenses' && Array.isArray(val)) {
      for (const dep of val) {
        const n = safeNum(dep?.montant);
        if (n !== null) {
          total += n;
          hasAny = true;
        }
      }
    } else {
      const n = safeNum(val);
      if (n !== null) {
        total += n;
        hasAny = true;
      }
    }
  }
  return hasAny ? total : null;
}

/** @deprecated Alias grille déclarée — préférer sumDeclaredOperatingExpensesGrid */
export function sumDeclaredOperatingExpenses(depenses: DepensesGrid | null | undefined): number | null {
  return sumDepenses(depenses);
}

export function normalizeFinancialData(
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints = {}
): NormalizeFinancialResult {
  if (!financialData) {
    return { calc: null, baseData: null, hasFinancials: false, source: 'none' };
  }

  const baseData = financialData.baseData ?? null;

  if (financialData.calculatedResults) {
    const enrichedCalc = enrichCalcWithRpaAncillary(
      financialData.calculatedResults,
      baseData,
      residence
    );
    return {
      calc: enrichedCalc,
      baseData,
      hasFinancials: true,
      source: 'calculatedResults',
    };
  }

  const derived = financialData.derivedData ?? null;
  if (derived || baseData) {
    const finalUnitCount =
      safeNum(residence.nombreUnitesTotal) ??
      safeNum(baseData?.nombreUnites) ??
      safeNum(residence.nombreUnites) ??
      1;
    let revenusAnnuels = safeNum(baseData?.revenusAnnuels);
    if (revenusAnnuels == null) {
      revenusAnnuels = deriveRevenusAnnuelsFromTarification(
        residence as Record<string, unknown>
      );
    }
    const depensesTotales = sumDepenses(baseData?.depenses ?? undefined);
    const noi =
      safeNum(derived?.noiOperationnel) ??
      safeNum(derived?.noi) ??
      (revenusAnnuels != null && depensesTotales != null ? revenusAnnuels - depensesTotales : null);
    const prixDemande =
      safeNum((residence as { price?: unknown }).price) ??
      safeNum(residence.prixDemande) ??
      safeNum(residence.askingPrice) ??
      null;
    const tauxCap = noi != null && prixDemande ? noi / prixDemande : null;

    const calc: FinancialCalc = {
      revenusAnnuels,
      revenuBrutEffectif: revenusAnnuels,
      autresRevenus: null,
      vacances: null,
      depensesTotales,
      revenuNetExploitation: noi,
      tauxCapitalisation: tauxCap,
      facteurRevenuBrut:
        prixDemande && revenusAnnuels ? prixDemande / revenusAnnuels : null,
      facteurRevenuNet: prixDemande && noi ? prixDemande / noi : null,
      facteurDepenses:
        revenusAnnuels && depensesTotales ? depensesTotales / revenusAnnuels : null,
      prixDemande,
      ratioCouvertureDette: null,
      empruntMaxDSCR: null,
      empruntMaxTransaction: null,
      hypothequeMaxRecommandee: null,
      surplusTresorerie: null,
      cashFlow: null,
      valeurBanquable: null,
      valeurBanquableTransaction: null,
      valeurCapitalisation: tauxCap && noi ? noi / tauxCap : null,
      valeurDSCRLTV: null,
      paiementAnnuel: null,
      paiementMensuel: null,
      montantHypotheque: null,
      miseDeFondsRequise: null,
      amortissementBanque: null,
      DC: null,
      nombreUnites: finalUnitCount,
      prixParUnite: prixDemande && finalUnitCount > 0 ? prixDemande / finalUnitCount : null,
      _source: 'derivedData',
      _confidence: (derived?.confidence as string) ?? null,
    };

    const enrichedCalc = enrichCalcWithRpaAncillary(calc, baseData, residence);
    return { calc: enrichedCalc, baseData, hasFinancials: true, source: 'derivedData' };
  }

  return { calc: null, baseData: null, hasFinancials: false, source: 'none' };
}

/** KPIs pré-calculés pour le Bilan exécutif (aucun calcul dans l'UI). */
export interface BilanExecutifKpis {
  rbe: number | null;
  noi: number | null;
  noiAudit: number | null;
  depensesNormalisees: number | null;
  depensesDeclarees: number | null;
  source: FinancialDataSource;
  hasFinancials: boolean;
}

export function computeBilanExecutifKpis(
  financialData: FinancialDataV2Doc | null | undefined,
  residence: ResidenceFinancialHints = {}
): BilanExecutifKpis {
  const { calc, baseData, hasFinancials, source } = normalizeFinancialData(financialData, residence);
  if (!calc) {
    return {
      rbe: null,
      noi: null,
      noiAudit: null,
      depensesNormalisees: null,
      depensesDeclarees: null,
      source,
      hasFinancials,
    };
  }

  const rbe = finiteNum(calc.revenuBrutEffectif) ?? finiteNum(calc.revenusAnnuels);
  const depensesNormalisees =
    finiteNum(calc.depensesTotalesNormalisees) ??
    (baseData?.depenses
      ? sumNormalizedOperatingExpenses(
          baseData.depenses,
          (baseData.expenseAdjustments as Record<string, unknown>) ?? undefined
        )
      : null);
  const depensesDeclarees =
    baseData?.depenses && typeof baseData.depenses === 'object'
      ? sumDeclaredOperatingExpensesGrid(baseData.depenses)
      : finiteNum(calc.depensesTotales);
  const noi = finiteNum(calc.revenuNetExploitation);
  const noiAudit = getAuditNormalizedNoi(calc, baseData);

  return {
    rbe,
    noi,
    noiAudit,
    depensesNormalisees,
    depensesDeclarees,
    source,
    hasFinancials,
  };
}
