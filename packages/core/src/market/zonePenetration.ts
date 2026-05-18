/**
 * Taux de pénétration zone — unités RPA du secteur ÷ population 75+.
 */

import type { MarketCompetitorRow } from './types';

export function getCompetitorUnitCount(comp: MarketCompetitorRow): number {
  const n = Number(comp.nombreUnites ?? comp.capaciteTotal ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function getSubjectUnitCount(doc: Record<string, unknown> | null): number {
  if (!doc) return 0;
  for (const key of ['nombreUnites', 'capaciteTotal', 'capaciteMaxResidents', 'totalUnits']) {
    const n = Number(doc[key]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/** Somme des portes comparables + résidence sous analyse. */
export function sumSectorRpaUnits(
  competitors: MarketCompetitorRow[],
  subjectUnits: number
): number {
  const fromComparables = competitors.reduce((acc, c) => acc + getCompetitorUnitCount(c), 0);
  return fromComparables + (subjectUnits > 0 ? subjectUnits : 0);
}

export function computePenetrationRate75(
  totalSectorUnits: number,
  population75Plus: number
): number | null {
  if (!population75Plus || population75Plus <= 0 || !totalSectorUnits || totalSectorUnits <= 0) {
    return null;
  }
  return totalSectorUnits / population75Plus;
}

export function formatPenetrationPercent(rate: number | null, decimals = 1): string {
  if (rate === null || Number.isNaN(rate)) return '—';
  return `${(rate * 100).toFixed(decimals).replace('.', ',')} %`;
}

export function sortCompetitorsByUnitsDesc(
  competitors: MarketCompetitorRow[]
): MarketCompetitorRow[] {
  return [...competitors].sort(
    (a, b) => getCompetitorUnitCount(b) - getCompetitorUnitCount(a)
  );
}
