/**
 * SSOT — RNE = RBE − OPEX admissibles déclarés (jamais copier le RBE dans le RNE).
 * OPEX normalisé (761 k$) ne doit jamais réduire le RNE déclaré (529 k$).
 */

import type { FinancialBaseData, FinancialCalc } from './normalizeFinancialData';
import {
  sumDeclaredOperatingExpensesGrid,
  sumNormalizedOperatingExpenses,
} from './normalizeFinancialData';

export interface CanonicalFinancialMetrics {
  rbe: number | null;
  opex: number | null;
  rne: number | null;
  /** false si RNE ≥ RBE ou RNE manquant alors que RBE et OPEX sont connus */
  rneIntegrityOk: boolean;
  rneIntegrityIssueFr: string | null;
  rneIntegrityIssueEn: string | null;
}

function finiteNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(String(v).replace(/[^\d.-]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function sumDepensesObjectValues(depenses: Record<string, unknown>): number {
  let total = 0;
  let has = false;
  for (const [key, val] of Object.entries(depenses)) {
    if (key === 'autresDepenses' || key === 'nonOpexExcluded') continue;
    const n = finiteNum(val);
    if (n != null && n > 0) {
      total += n;
      has = true;
    }
  }
  return has ? total : 0;
}

/**
 * OPEX admissibles pour RNE = RBE − dépenses déclarées.
 * Priorité : agrégat déclaré calculatedResults → grille CPA complète → clés brutes.
 * Interdit : depensesTotalesNormalisees en premier (source du RNE fantôme 368 338 $).
 */
export function resolveAdmissibleOpex(
  calc: FinancialCalc | null,
  baseData: FinancialBaseData | null
): number | null {
  const depenses = baseData?.depenses;
  const adj = baseData?.expenseAdjustments as Record<string, unknown> | undefined;
  const declaredFromCalc = finiteNum(calc?.depensesTotales);
  const normalizedFromCalc = finiteNum(calc?.depensesTotalesNormalisees);

  if (depenses && typeof depenses === 'object') {
    const declaredGrid = sumDeclaredOperatingExpensesGrid(depenses);

    if (declaredFromCalc != null && declaredFromCalc > 0) {
      const gridIncomplete =
        declaredGrid == null || declaredGrid <= 0 || declaredGrid < declaredFromCalc * 0.9;
      if (gridIncomplete) {
        return Math.round(declaredFromCalc);
      }
      return Math.round(Math.max(declaredGrid!, declaredFromCalc));
    }

    if (declaredGrid != null && declaredGrid > 0) return Math.round(declaredGrid);

    const fromKeys = sumDepensesObjectValues(depenses as Record<string, unknown>);
    if (fromKeys > 0) return Math.round(fromKeys);

    const normalized = sumNormalizedOperatingExpenses(depenses, adj ?? {});
    if (normalized != null && normalized > 0) return Math.round(normalized);
  }

  if (declaredFromCalc != null && declaredFromCalc > 0) {
    return Math.round(declaredFromCalc);
  }

  if (normalizedFromCalc != null && normalizedFromCalc > 0) {
    return Math.round(normalizedFromCalc);
  }

  return null;
}

export function resolveCanonicalFinancialMetrics(
  calc: FinancialCalc | null,
  baseData: FinancialBaseData | null
): CanonicalFinancialMetrics {
  const rbe =
    finiteNum(calc?.revenuBrutEffectif) ??
    finiteNum(calc?.revenusAnnuels) ??
    finiteNum(baseData?.revenusAnnuels);

  const opex = resolveAdmissibleOpex(calc, baseData);

  let rne: number | null = null;
  if (rbe != null && opex != null && opex > 0) {
    rne = Math.max(0, Math.round(rbe - opex));
  } else {
    const stored = finiteNum(calc?.revenuNetExploitation);
    if (stored != null && rbe != null && stored > 0 && stored < rbe) {
      rne = Math.round(stored);
    }
  }

  let rneIntegrityOk = true;
  let rneIntegrityIssueFr: string | null = null;
  let rneIntegrityIssueEn: string | null = null;

  if (rbe != null && rbe > 0) {
    if (rne == null) {
      rneIntegrityOk = false;
      rneIntegrityIssueFr =
        'Revenu net d’exploitation (RNE) manquant — vérifiez la grille Finances (RBE − dépenses d’exploitation).';
      rneIntegrityIssueEn =
        'Net operating income (NOI) missing — check the Finance grid (EGI − operating expenses).';
    } else if (rne >= rbe) {
      rneIntegrityOk = false;
      rneIntegrityIssueFr =
        'Revenu net d’exploitation (RNE) invalide : il ne peut pas être égal ou supérieur au revenu brut effectif (RBE). Recalculez RNE = RBE − dépenses d’exploitation.';
      rneIntegrityIssueEn =
        'Invalid net operating income (NOI): it cannot equal or exceed effective gross income (EGI). Recalculate NOI = EGI − operating expenses.';
    } else if (opex != null && rne != null && Math.abs(rne - (rbe - opex)) > Math.max(5000, rbe * 0.02)) {
      rne = Math.max(0, Math.round(rbe - opex));
    }
  }

  return { rbe, opex, rne, rneIntegrityOk, rneIntegrityIssueFr, rneIntegrityIssueEn };
}

/** Applique RBE/RNE/OPEX cohérents sur un FinancialCalc (SSOT lecture). */
export function applyCanonicalMetricsToCalc(
  calc: FinancialCalc,
  baseData: FinancialBaseData | null
): FinancialCalc {
  const m = resolveCanonicalFinancialMetrics(calc, baseData);
  if (m.rbe == null) return calc;

  const next: FinancialCalc = {
    ...calc,
    revenusAnnuels: m.rbe,
    revenuBrutEffectif: m.rbe,
  };

  if (m.opex != null && m.opex > 0) {
    next.depensesTotales = m.opex;
    next.facteurDepenses = m.rbe > 0 ? m.opex / m.rbe : null;
  }

  if (m.rne != null) {
    next.revenuNetExploitation = m.rne;
  }

  return next;
}
