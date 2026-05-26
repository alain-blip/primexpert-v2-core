/**
 * Détection conflit SSOT — injection états financiers vs données existantes.
 */

import type { FinancialDataV2Doc } from './normalizeFinancialData';

export type FinancialYearRelation = 'newer' | 'same' | 'older' | 'unknown';

export interface FinancialOverwriteAssessment {
  hasExistingData: boolean;
  incomingYear: number;
  existingYear: number | null;
  yearRelation: FinancialYearRelation;
}

function finiteNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** True si la fiche contient déjà un socle financier exploitable (SSOT). */
export function residenceHasExistingFinancialSsot(
  financial: FinancialDataV2Doc | null | undefined
): boolean {
  if (!financial) return false;

  const calc = financial.calculatedResults;
  const base = financial.baseData;

  const rbe =
    finiteNum(calc?.revenuBrutEffectif) ??
    finiteNum(calc?.revenusAnnuels) ??
    finiteNum(base?.revenusAnnuels);
  const rne = finiteNum(calc?.revenuNetExploitation);
  const depenses = base?.depenses;

  if (rbe != null && rbe > 0) return true;
  if (rne != null && rne > 0) return true;

  if (depenses && typeof depenses === 'object') {
    for (const [key, val] of Object.entries(depenses)) {
      if (key === 'autresDepenses' || key === 'nonOpexExcluded') continue;
      const n = finiteNum(val);
      if (n != null && n > 0) return true;
    }
  }

  if (financial.lastInjection?.atMillis) return true;

  return false;
}

export function inferExistingFinancialYear(
  financial: FinancialDataV2Doc | null | undefined
): number | null {
  if (!financial) return null;

  const fromAnnee = finiteNum(
    (financial.baseData as Record<string, unknown> | undefined)?.anneeFiscale
  );
  if (fromAnnee != null && fromAnnee > 1990 && fromAnnee < 2100) return Math.round(fromAnnee);

  const inj = financial.lastInjection?.atMillis;
  if (inj && Number.isFinite(inj)) {
    return new Date(inj).getFullYear();
  }

  return null;
}

export function compareFinancialYears(
  incomingYear: number,
  existingYear: number | null
): FinancialYearRelation {
  if (existingYear == null || !Number.isFinite(existingYear)) return 'unknown';
  if (incomingYear > existingYear) return 'newer';
  if (incomingYear < existingYear) return 'older';
  return 'same';
}

export function assessFinancialDataOverwrite(
  existing: FinancialDataV2Doc | null | undefined,
  incomingYear: number
): FinancialOverwriteAssessment | null {
  const hasExistingData = residenceHasExistingFinancialSsot(existing);
  if (!hasExistingData) return null;

  const existingYear = inferExistingFinancialYear(existing);
  const yearRelation = compareFinancialYears(incomingYear, existingYear);

  return {
    hasExistingData: true,
    incomingYear,
    existingYear,
    yearRelation,
  };
}
