/**
 * Dashboard GPS — Archiviste (péremption) + Statisticien (médianes régionales).
 */

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
  source: string;
}

export interface MarketGpsRatioSample {
  region: string;
  labelKey: string;
  labelDisplay: string;
  ratioPct?: number;
  montantParPorte?: number;
  sortMillis: number;
}

export interface MarketGpsRegionalSummary {
  id: string;
  region: string;
  sampleCount: number;
  sortMillis: number;
  rdeMedianPct?: number;
  energieMedianPerDoor?: number;
  salairesMedianPerDoor?: number;
  entretienMedianPerDoor?: number;
  macroHint?: string;
}

export function parseMarketDateToMillis(
  date: string | null | undefined,
  anneeDonnees?: number,
  injectedAtMillis?: number
): number {
  if (typeof injectedAtMillis === 'number' && injectedAtMillis > 0) return injectedAtMillis;
  if (date) {
    const s = String(date).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return t;
    if (/^\d{4}$/.test(s)) return new Date(Number(s), 0, 1).getTime();
  }
  if (typeof anneeDonnees === 'number' && anneeDonnees > 1900) {
    return new Date(anneeDonnees, 0, 1).getTime();
  }
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
  const effective = sortMillis > 0 ? sortMillis : now;
  return effective >= cutoff;
}

export function median(values: number[]): number | undefined {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Clé de regroupement ratio (RDE, énergie, salaires…). */
export function normalizeRatioLabelKey(label: string): string {
  const l = label.toLowerCase();
  if (/rde|ratio des d[eé]penses|operating expense/.test(l)) return 'rde';
  if (/[eé]nergie|energy/.test(l)) return 'energie';
  if (/salaire|salary|main d'[oœ]uvre/.test(l)) return 'salaires';
  if (/entretien|maintenance/.test(l)) return 'entretien';
  if (/nourriture|food/.test(l)) return 'nourriture';
  if (/administration|admin/.test(l)) return 'administration';
  return 'autre';
}

export function computeRegionalSummaries(
  samples: MarketGpsRatioSample[],
  macroByRegion: Map<string, string>
): MarketGpsRegionalSummary[] {
  const byRegion = new Map<string, MarketGpsRatioSample[]>();
  for (const s of samples) {
    if (!s.region || s.region === '—') continue;
    const list = byRegion.get(s.region) ?? [];
    list.push(s);
    byRegion.set(s.region, list);
  }

  const out: MarketGpsRegionalSummary[] = [];
  for (const [region, rows] of byRegion) {
    const rde = median(
      rows.filter((r) => r.labelKey === 'rde' && r.ratioPct != null).map((r) => r.ratioPct!)
    );
    const energie = median(
      rows
        .filter((r) => r.labelKey === 'energie' && r.montantParPorte != null)
        .map((r) => r.montantParPorte!)
    );
    const salaires = median(
      rows
        .filter((r) => r.labelKey === 'salaires' && r.montantParPorte != null)
        .map((r) => r.montantParPorte!)
    );
    const entretien = median(
      rows
        .filter((r) => r.labelKey === 'entretien' && r.montantParPorte != null)
        .map((r) => r.montantParPorte!)
    );
    const sortMillis = Math.max(...rows.map((r) => r.sortMillis), 0);

    out.push({
      id: `region-${region}`,
      region,
      sampleCount: rows.length,
      sortMillis,
      rdeMedianPct: rde,
      energieMedianPerDoor: energie,
      salairesMedianPerDoor: salaires,
      entretienMedianPerDoor: entretien,
      macroHint: macroByRegion.get(region),
    });
  }

  return out.sort((a, b) => b.sortMillis - a.sortMillis);
}

export function sortTransactionsDesc(rows: MarketGpsTransaction[]): MarketGpsTransaction[] {
  return [...rows].sort((a, b) => b.sortMillis - a.sortMillis);
}

/** Fenêtre fraîche par défaut — 24 mois (Pilier 5). */
export const DEFAULT_TEMPORAL_WINDOW: MarketTemporalWindow = '24m';

export const TRANSACTIONS_PAGE_SIZE = 25;
