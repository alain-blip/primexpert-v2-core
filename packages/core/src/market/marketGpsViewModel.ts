/**
 * Dashboard GPS — Archiviste (péremption) + Statisticien (médianes régionales).
 */

import { normalizeAdministrativeRegion } from './marketRegionNormalize';
import {
  classifyExpenseGroup,
  compareExpenseLineKeys,
  normalizeRatioLabelKey,
  resolveExpenseLineMeta,
  canonicalExpenseKey,
} from './marketPlExpenseDictionary';

export { normalizeRatioLabelKey, classifyExpenseGroup } from './marketPlExpenseDictionary';

export type MarketTemporalWindow = '12m' | '24m' | 'all';

export interface MarketGpsTransaction {
  id: string;
  region: string;
  city: string;
  address: string;
  date: string | null;
  sortMillis: number;
  prixVente?: number;
  nbPortes?: number;
  prixParPorte?: number;
  tgaPct?: number;
  prixParPi2?: number;
  anneeConstruction?: number;
  vendeur?: string;
  acheteur?: string;
  typeImmeuble?: string;
  source: string;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
}

export interface MarketGpsRatioSample {
  region: string;
  labelKey: string;
  labelDisplay: string;
  ratioPct?: number;
  montantParPorte?: number;
  sortMillis: number;
}

export interface ValueRange {
  min?: number;
  max?: number;
  median?: number;
  count: number;
}

export interface MarketGpsRegionalSummary {
  id: string;
  region: string;
  sampleCount: number;
  sortMillis: number;
  rdeRange?: ValueRange;
  energieRange?: ValueRange;
  salairesRange?: ValueRange;
  entretienRange?: ValueRange;
  macroHint?: string;
}

export type PlSection = 'revenu' | 'depense' | 'profit';
export type PlExpenseGroup = 'fixes' | 'operationnelles' | 'gestion';

export interface MarketGpsPlLine {
  id: string;
  section: PlSection | 'group-header';
  group?: PlExpenseGroup;
  labelFr: string;
  labelEn: string;
  perUnit?: ValueRange;
  pctRbe?: ValueRange;
  isSubtotal?: boolean;
  indent?: boolean;
}

export interface MarketGpsRegionalPl {
  id: string;
  region: string;
  sampleCount: number;
  sortMillis: number;
  rbePerUnit?: ValueRange;
  rnePerUnit?: ValueRange;
  rdePct?: ValueRange;
  lines: MarketGpsPlLine[];
  macroHint?: string;
}

export function parseMarketDateToMillis(
  date: string | null | undefined,
  anneeDonnees?: number,
  archiveFallbackMillis?: number
): number {
  const fromDate = parseEventDateStringToMillis(date);
  if (fromDate > 0) return fromDate;

  if (typeof anneeDonnees === 'number' && anneeDonnees > 1900 && anneeDonnees < 2100) {
    return new Date(anneeDonnees, 0, 1).getTime();
  }

  /** Dernier recours — date d'archivage / injection (pas prioritaire sur la date métier). */
  if (typeof archiveFallbackMillis === 'number' && archiveFallbackMillis > 0) {
    return archiveFallbackMillis;
  }
  return 0;
}

/** Parse une date métier (transaction, vente, rapport) — jamais la date d'injection Firestore. */
export function parseEventDateStringToMillis(date: string | null | undefined): number {
  if (!date) return 0;
  const s = String(date).trim();
  if (!s) return 0;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();

  if (/^\d{4}$/.test(s)) return new Date(Number(s), 0, 1).getTime();

  const t = Date.parse(s);
  if (!Number.isNaN(t)) return t;

  return 0;
}

export function temporalCutoff(window: MarketTemporalWindow, now = Date.now()): number | null {
  if (window === 'all') return null;
  const months = window === '12m' ? 12 : 24;
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d.getTime();
}

export function passesTemporalFilter(
  sortMillis: number,
  window: MarketTemporalWindow,
  now = Date.now()
): boolean {
  if (window === 'all') return true;
  const cutoff = temporalCutoff(window, now);
  if (cutoff == null) return true;
  /** Date métier inconnue — exclue des fenêtres glissantes (pas de placebo « aujourd'hui »). */
  if (sortMillis <= 0) return false;
  return sortMillis >= cutoff;
}

export function median(values: number[]): number | undefined {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function computeValueRange(values: number[]): ValueRange {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { count: 0 };
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: median(sorted),
    count: sorted.length,
  };
}

function pctOfRbeRange(amountRange: ValueRange, rbePerUnit?: number): ValueRange | undefined {
  if (!rbePerUnit || rbePerUnit <= 0 || amountRange.count === 0) return undefined;
  const toPct = (v?: number) =>
    v != null && Number.isFinite(v) ? (v / rbePerUnit) * 100 : undefined;
  return {
    min: toPct(amountRange.min),
    max: toPct(amountRange.max),
    median: toPct(amountRange.median),
    count: amountRange.count,
  };
}

function estimateRbePerUnit(
  expenseRanges: Map<string, ValueRange>,
  rdePct?: number
): number | undefined {
  if (rdePct != null && rdePct > 0 && rdePct < 100) {
    let total = 0;
    for (const [, r] of expenseRanges) {
      if (r.median != null) total += r.median;
    }
    if (total > 0) return total / (rdePct / 100);
  }
  return undefined;
}

function buildPlLinesForRegion(
  samples: MarketGpsRatioSample[],
  rdeRange: ValueRange
): { lines: MarketGpsPlLine[]; rbePerUnit?: ValueRange; rnePerUnit?: ValueRange } {
  const rbeSamples = samples.filter((s) => s.labelKey === 'rbe' && s.montantParPorte != null);
  const rneSamples = samples.filter((s) => s.labelKey === 'rne' && s.montantParPorte != null);

  const expenseKeys = new Set<string>();
  for (const s of samples) {
    if (s.labelKey !== 'rde' && s.labelKey !== 'rbe' && s.labelKey !== 'rne' && s.montantParPorte != null) {
      expenseKeys.add(s.labelKey);
    }
  }

  const expenseRanges = new Map<string, ValueRange>();
  for (const key of expenseKeys) {
    const vals = samples
      .filter((s) => s.labelKey === key && s.montantParPorte != null)
      .map((s) => s.montantParPorte!);
    expenseRanges.set(key, computeValueRange(vals));
  }

  let rbePerUnit: ValueRange | undefined;
  if (rbeSamples.length) {
    rbePerUnit = computeValueRange(rbeSamples.map((s) => s.montantParPorte!));
  } else {
    const est = estimateRbePerUnit(expenseRanges, rdeRange.median);
    if (est != null) rbePerUnit = { min: est, max: est, median: est, count: 1 };
  }

  let rnePerUnit: ValueRange | undefined;
  if (rneSamples.length) {
    rnePerUnit = computeValueRange(rneSamples.map((s) => s.montantParPorte!));
  } else if (rbePerUnit?.median != null && rdeRange.median != null) {
    const rne = rbePerUnit.median * (1 - rdeRange.median / 100);
    rnePerUnit = { min: rne, max: rne, median: rne, count: 1 };
  }

  const lines: MarketGpsPlLine[] = [];

  lines.push({
    id: 'sec-revenu',
    section: 'group-header',
    labelFr: '1 · Revenus',
    labelEn: '1 · Revenue',
  });
  lines.push({
    id: 'rbe',
    section: 'revenu',
    labelFr: 'Revenu brut effectif (RBE)',
    labelEn: 'Effective gross income (EGI)',
    perUnit: rbePerUnit,
    pctRbe: rbePerUnit ? { min: 100, max: 100, median: 100, count: 1 } : undefined,
    isSubtotal: true,
  });

  const groups: PlExpenseGroup[] = ['fixes', 'operationnelles', 'gestion'];
  const groupLabels: Record<PlExpenseGroup, { fr: string; en: string }> = {
    fixes: { fr: 'Dépenses fixes', en: 'Fixed expenses' },
    operationnelles: { fr: 'Dépenses opérationnelles', en: 'Operating expenses' },
    gestion: { fr: 'Frais de gestion', en: 'Management expenses' },
  };

  lines.push({
    id: 'sec-depense',
    section: 'group-header',
    labelFr: '2 · Dépenses',
    labelEn: '2 · Expenses',
  });

  for (const group of groups) {
    const keysInGroup = [...expenseKeys].filter(
      (k) => classifyExpenseGroup(k) === group
    );
    if (!keysInGroup.length) continue;

    lines.push({
      id: `grp-${group}`,
      section: 'group-header',
      group,
      labelFr: groupLabels[group].fr,
      labelEn: groupLabels[group].en,
      indent: true,
    });

    for (const key of keysInGroup.sort(compareExpenseLineKeys)) {
      const meta = resolveExpenseLineMeta(key);
      const perUnit = expenseRanges.get(key)!;
      lines.push({
        id: `exp-${key}`,
        section: 'depense',
        group,
        labelFr: meta.labelFr,
        labelEn: meta.labelEn,
        perUnit,
        pctRbe: pctOfRbeRange(perUnit, rbePerUnit?.median),
        indent: true,
      });
    }
  }

  lines.push({
    id: 'rde-total',
    section: 'depense',
    labelFr: 'Total des dépenses — ratio des dépenses d\'exploitation (RDE)',
    labelEn: 'Total expenses — operating expense ratio (OER)',
    pctRbe: rdeRange,
    isSubtotal: true,
  });

  lines.push({
    id: 'sec-profit',
    section: 'group-header',
    labelFr: '3 · Profit',
    labelEn: '3 · Profit',
  });
  lines.push({
    id: 'rne',
    section: 'profit',
    labelFr: 'Revenu net d\'exploitation (RNE)',
    labelEn: 'Net operating income (NOI)',
    perUnit: rnePerUnit,
    pctRbe:
      rbePerUnit?.median && rnePerUnit?.median
        ? computeValueRange([
            (rnePerUnit.min ?? rnePerUnit.median) / rbePerUnit.median * 100,
            (rnePerUnit.max ?? rnePerUnit.median) / rbePerUnit.median * 100,
            (rnePerUnit.median / rbePerUnit.median) * 100,
          ])
        : undefined,
    isSubtotal: true,
  });

  return { lines, rbePerUnit, rnePerUnit };
}

export function cleanseMarketRegion(rawRegion: string, city?: string): string {
  return normalizeAdministrativeRegion(rawRegion, city);
}

export function computeRegionalSummaries(
  samples: MarketGpsRatioSample[],
  macroByRegion: Map<string, string>
): MarketGpsRegionalSummary[] {
  const byRegion = new Map<string, MarketGpsRatioSample[]>();
  for (const s of samples) {
    const region = cleanseMarketRegion(s.region);
    if (!region || region === '—') continue;
    const list = byRegion.get(region) ?? [];
    list.push({ ...s, region });
    byRegion.set(region, list);
  }

  const out: MarketGpsRegionalSummary[] = [];
  for (const [region, rows] of byRegion) {
    const rdeRange = computeValueRange(
      rows.filter((r) => r.labelKey === 'rde' && r.ratioPct != null).map((r) => r.ratioPct!)
    );
    const energieRange = computeValueRange(
      rows
        .filter((r) => canonicalExpenseKey(r.labelKey) === 'energie' && r.montantParPorte != null)
        .map((r) => r.montantParPorte!)
    );
    const salairesRange = computeValueRange(
      rows
        .filter(
          (r) =>
            canonicalExpenseKey(r.labelKey) === 'salairesAvantages' && r.montantParPorte != null
        )
        .map((r) => r.montantParPorte!)
    );
    const entretienRange = computeValueRange(
      rows
        .filter(
          (r) =>
            canonicalExpenseKey(r.labelKey) === 'entretienReparation' && r.montantParPorte != null
        )
        .map((r) => r.montantParPorte!)
    );
    const sortMillis = Math.max(...rows.map((r) => r.sortMillis), 0);

    out.push({
      id: `region-${region}`,
      region,
      sampleCount: rows.length,
      sortMillis,
      rdeRange,
      energieRange,
      salairesRange,
      entretienRange,
      macroHint: macroByRegion.get(region),
    });
  }

  return out.sort((a, b) => b.sortMillis - a.sortMillis);
}

export function computeRegionalPlStatements(
  samples: MarketGpsRatioSample[],
  macroByRegion: Map<string, string>
): MarketGpsRegionalPl[] {
  const byRegion = new Map<string, MarketGpsRatioSample[]>();
  for (const s of samples) {
    const region = cleanseMarketRegion(s.region);
    if (!region || region === '—') continue;
    const list = byRegion.get(region) ?? [];
    list.push({ ...s, region });
    byRegion.set(region, list);
  }

  const out: MarketGpsRegionalPl[] = [];
  for (const [region, rows] of byRegion) {
    const rdeRange = computeValueRange(
      rows.filter((r) => r.labelKey === 'rde' && r.ratioPct != null).map((r) => r.ratioPct!)
    );
    const { lines, rbePerUnit, rnePerUnit } = buildPlLinesForRegion(rows, rdeRange);
    const sortMillis = Math.max(...rows.map((r) => r.sortMillis), 0);

    out.push({
      id: `pl-${region}`,
      region,
      sampleCount: rows.length,
      sortMillis,
      rbePerUnit,
      rnePerUnit,
      rdePct: rdeRange,
      lines,
      macroHint: macroByRegion.get(region),
    });
  }

  return out.sort((a, b) => b.sortMillis - a.sortMillis);
}

export function sortTransactionsDesc(rows: MarketGpsTransaction[]): MarketGpsTransaction[] {
  return [...rows].sort((a, b) => b.sortMillis - a.sortMillis);
}

export function cleanseTransactionRow(row: MarketGpsTransaction): MarketGpsTransaction {
  return {
    ...row,
    region: cleanseMarketRegion(row.region, row.city),
  };
}

/** Fenêtre fraîche par défaut — 24 mois (Pilier 5). */
export const DEFAULT_TEMPORAL_WINDOW: MarketTemporalWindow = '24m';

export const TRANSACTIONS_PAGE_SIZE = 25;
