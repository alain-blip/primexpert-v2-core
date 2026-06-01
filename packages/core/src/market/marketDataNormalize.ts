/**
 * Normalisation comptable — échantillons ratio/P&L (Dashboard GPS).
 * $/unité, RDE borné, exclusion revenus, fusion doublons IA.
 */

import { mergeMarketLabelKey, normalizeRatioLabelKey } from './marketPlExpenseDictionary';
import type { MarketGpsRatioSample } from './marketGpsViewModel';
import { coerceOperatingRatioPct } from './operatingRatio';

export { mergeMarketLabelKey } from './marketPlExpenseDictionary';
export { coerceOperatingRatioPct } from './operatingRatio';

const REVENUE_LINE_KEYS = new Set(['rbe', 'rne', 'rde', 'valeurEvaluee', 'rbPotentiel']);

/** Libellés revenus / valorisation — exclus de la section Dépenses. */
const NON_EXPENSE_LABEL =
  /valeur [eé]valu[eé]e|revenu brut potentiel|revenu net effectif|\brevenu net\b|\brevenu brut effectif\b|\brevenu brut\b|potential gross|evaluated value|taux de capitalisation|\btga\b|\bcap rate\b|\bnoi\b|\begi\b/i;

function stripMeasurementSuffix(label: string): string {
  return label
    .replace(/\s*[—–-]\s*(par unit[eé]|par porte|\/\s*unit[eé]|annuel|total|ratio\s*\(?%?\)?|ratio).*$/i, '')
    .trim();
}

export function coerceNbUnites(...sources: unknown[]): number | undefined {
  for (const raw of sources) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return Math.round(raw);
    }
  }
  return undefined;
}

export type AmountLabelKind = 'ratio' | 'per_unit' | 'annual_total' | 'unknown';

export function amountLabelKind(label: string): AmountLabelKind {
  const l = label.toLowerCase();
  if (/ratio|\(%\)|\bpourcent|\b%/.test(l)) return 'ratio';
  if (/par unit|par porte|\/\s*unit|per unit|per door|\$\/\s*unit|\/u\b/.test(l)) return 'per_unit';
  if (/annuel|total\b|global|bâtisse|batisse|immeuble entier/.test(l)) return 'annual_total';
  return 'unknown';
}

/**
 * Convertit un montant en $/unité avant agrégation régionale.
 * Formule : montant annuel / nb unités lorsque le dénominateur est connu.
 */
export function toMontantParUnite(
  value: number,
  label: string,
  nbUnites?: number
): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const kind = amountLabelKind(label);

  if (kind === 'ratio') return undefined;

  if (kind === 'per_unit') {
    return Math.round(value * 100) / 100;
  }

  if (nbUnites != null && nbUnites > 0) {
    return Math.round((value / nbUnites) * 100) / 100;
  }

  /** Total immeuble sans nb d'unités — exclure plutôt qu'afficher 482 000 $/unité. */
  if (kind === 'annual_total' || value >= 25_000) return undefined;

  return Math.round(value * 100) / 100;
}

export function isRevenueStatementLine(labelKey: string, labelDisplay: string): boolean {
  if (REVENUE_LINE_KEYS.has(labelKey)) return true;
  const display = stripMeasurementSuffix(labelDisplay);
  return NON_EXPENSE_LABEL.test(display);
}

/** Poste admissible dans la section Dépenses (coûts uniquement). */
export function isPnLExpenseCandidate(labelKey: string, labelDisplay: string): boolean {
  if (REVENUE_LINE_KEYS.has(labelKey)) return false;
  if (isRevenueStatementLine(labelKey, labelDisplay)) return false;
  if (/^poste:(revenu|valeur|tga|cap_|noi|egi|rbe|rne)/.test(labelKey)) return false;
  return true;
}

export interface ValidatedAmountRow {
  label: string;
  value: number;
}

export function buildRatioSamplesFromBenchmarkRecord(input: {
  region: string;
  sortMillis: number;
  amounts: ValidatedAmountRow[];
  baseLabel?: string;
  nbUnites?: number;
}): MarketGpsRatioSample[] {
  const { region, sortMillis, amounts, nbUnites } = input;
  const baseLabel = input.baseLabel?.trim() || 'Ratio';
  const samples: MarketGpsRatioSample[] = [];

  for (const a of amounts) {
    if (!Number.isFinite(a.value)) continue;
    const rawLabel = a.label?.trim() || baseLabel;
    const display = stripMeasurementSuffix(rawLabel) || baseLabel;
    const rawKey = normalizeRatioLabelKey(display);
    const labelKey = mergeMarketLabelKey(rawKey, display);
    const kind = amountLabelKind(rawLabel);

    if (kind === 'ratio' || /ratio/i.test(rawLabel)) {
      const ratioPct = coerceOperatingRatioPct(a.value);
      if (ratioPct == null) continue;
      samples.push({
        region,
        labelKey,
        labelDisplay: display,
        ratioPct,
        sortMillis,
        nbUnites,
      });
      continue;
    }

    const montantParPorte = toMontantParUnite(a.value, rawLabel, nbUnites);
    if (montantParPorte == null) continue;

    samples.push({
      region,
      labelKey,
      labelDisplay: display,
      montantParPorte,
      sortMillis,
      nbUnites,
    });
  }

  return dedupePreferPerUnit(samples);
}

/** Si par unité et annuel coexistent pour un poste, garder $/unité. */
function dedupePreferPerUnit(samples: MarketGpsRatioSample[]): MarketGpsRatioSample[] {
  const byKey = new Map<string, MarketGpsRatioSample>();
  for (const s of samples) {
    const k = `${s.labelKey}|${s.ratioPct != null ? 'r' : 'm'}`;
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, s);
      continue;
    }
    if (s.montantParPorte != null && prev.montantParPorte != null) {
      if (s.montantParPorte < prev.montantParPorte) byKey.set(k, s);
    }
  }
  return [...byKey.values()];
}

/** Assainit un échantillon avant agrégation P&L. */
export function sanitizeRatioSampleForPnL(
  sample: MarketGpsRatioSample
): MarketGpsRatioSample | null {
  const labelKey = mergeMarketLabelKey(sample.labelKey, sample.labelDisplay);

  if (sample.ratioPct != null) {
    const ratioPct = coerceOperatingRatioPct(sample.ratioPct);
    if (ratioPct == null) return null;
    return {
      ...sample,
      labelKey,
      ratioPct,
      montantParPorte: undefined,
    };
  }

  if (sample.montantParPorte != null) {
    const montantParPorte = toMontantParUnite(
      sample.montantParPorte,
      sample.labelDisplay,
      sample.nbUnites
    );
    if (montantParPorte == null) return null;
    if (!isPnLExpenseCandidate(labelKey, sample.labelDisplay) && labelKey !== 'rbe' && labelKey !== 'rne') {
      return null;
    }
    return { ...sample, labelKey, montantParPorte };
  }

  return null;
}

export function sanitizeRatioSamplesForPnL(
  samples: MarketGpsRatioSample[]
): MarketGpsRatioSample[] {
  const out: MarketGpsRatioSample[] = [];
  for (const s of samples) {
    const clean = sanitizeRatioSampleForPnL(s);
    if (clean) out.push(clean);
  }
  return out;
}
