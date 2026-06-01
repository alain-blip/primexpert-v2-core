/**
 * SSOT — RNE = RBE − OPEX admissibles (jamais copier le RBE dans le RNE).
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

/** Résout OPEX admissibles (priorité grille normalisée, puis totaux extraits). */
export function resolveAdmissibleOpex(
  calc: FinancialCalc | null,
  baseData: FinancialBaseData | null
): number | null {
  const depenses = baseData?.depenses;
  const adj = baseData?.expenseAdjustments as Record<string, unknown> | undefined;

  if (depenses && typeof depenses === 'object') {
    const normalized = sumNormalizedOperatingExpenses(depenses, adj ?? {});
    if (normalized != null && normalized > 0) return Math.round(normalized);

    const declared = sumDeclaredOperatingExpensesGrid(depenses);
    if (declared != null && declared > 0) return Math.round(declared);

    const fromKeys = sumDepensesObjectValues(depenses as Record<string, unknown>);
    if (fromKeys > 0) return Math.round(fromKeys);
  }

  const fromCalc =
    finiteNum(calc?.depensesTotalesNormalisees) ?? finiteNum(calc?.depensesTotales);
  if (fromCalc != null && fromCalc > 0) return Math.round(fromCalc);

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

/** Calcule le TGA canonique depuis le RNE et le prix, sous forme décimale (0.08 = 8 %). */
export function calculateCapitalizationRateFromNoi(
  revenuNetExploitation: unknown,
  prixDemande: unknown
): number | null {
  const rne = finiteNum(revenuNetExploitation);
  const price = finiteNum(prixDemande);
  if (rne == null || rne <= 0 || price == null || price <= 0) return null;
  return rne / price;
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
    next.depensesTotalesNormalisees = m.opex;
    next.facteurDepenses = m.rbe > 0 ? m.opex / m.rbe : null;
  }

  if (m.rne != null) {
    next.revenuNetExploitation = m.rne;
  }

  return next;
}
