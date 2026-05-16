/**
 * Agrégats capacité — unités, occupation, pyramide des âges.
 */

import { resolveIdentityField, isFieldEmpty } from './resolveIdentityField';
import { formatIdentityScalar, formatPercentDisplay } from './formatIdentityDisplay';
import type { CapacityAggregatesView, CapacityPyramidRow } from './types';

function parseCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function computeCapacityAggregates(
  doc: Record<string, unknown>
): CapacityAggregatesView {
  const unitDefs: { key: string; labelFr: string; labelEn: string }[] = [
    { key: 'nombreStudios', labelFr: 'Studios', labelEn: 'Studios' },
    { key: 'nombreChambresSimples', labelFr: 'Chambres simples', labelEn: 'Single rooms' },
    { key: 'nombreChambresDoubles', labelFr: 'Chambres doubles', labelEn: 'Double rooms' },
    { key: 'nombre2demie', labelFr: '2½', labelEn: '2½' },
    { key: 'nombre3demie', labelFr: '3½', labelEn: '3½' },
    { key: 'nombre4demie', labelFr: '4½', labelEn: '4½' },
    { key: 'nombreUnitesSoins', labelFr: 'Unités soins', labelEn: 'Care units' },
  ];

  const unitsByType = unitDefs
    .map(({ key, labelFr, labelEn }) => ({
      labelFr,
      labelEn,
      count: parseCount(resolveIdentityField(doc, key)),
    }))
    .filter((row) => row.count > 0);

  const sumParts = unitsByType.reduce((acc, r) => acc + r.count, 0);
  const declaredTotal = parseCount(
    resolveIdentityField(doc, 'nombreUnitesTotal') ??
      doc.nombreUnites ??
      doc.capacite
  );
  const totalUnits = declaredTotal > 0 ? declaredTotal : sumParts > 0 ? sumParts : null;

  const occupancyRate = formatPercentDisplay(
    resolveIdentityField(doc, 'tauxOccupation')
  );

  const clientele = doc.clientele;
  const ageDist =
    clientele &&
    typeof clientele === 'object' &&
    !Array.isArray(clientele) &&
    (clientele as Record<string, unknown>).ageDistribution
      ? ((clientele as Record<string, unknown>).ageDistribution as Record<string, unknown>)
      : null;

  const agePyramid: CapacityPyramidRow[] = [];
  let totalResidents = 0;

  if (ageDist && typeof ageDist === 'object') {
    for (const [label, raw] of Object.entries(ageDist)) {
      const count = parseCount(raw);
      if (count > 0) {
        agePyramid.push({ label, count, pct: 0 });
        totalResidents += count;
      }
    }
    if (totalResidents > 0) {
      for (const row of agePyramid) {
        row.pct = (row.count / totalResidents) * 100;
      }
    }
  }

  return {
    totalUnits,
    unitsByType,
    occupancyRate,
    agePyramid,
    totalResidents,
  };
}

export function isCapacityDataMissing(doc: Record<string, unknown>): boolean {
  const cap = computeCapacityAggregates(doc);
  if (cap.totalUnits != null && cap.totalUnits > 0) return false;
  if (cap.unitsByType.length > 0) return false;
  if (cap.agePyramid.length > 0) return false;
  return true;
}

export function formatUnitsOverview(doc: Record<string, unknown>): string | null {
  const cap = computeCapacityAggregates(doc);
  if (cap.totalUnits != null && cap.totalUnits > 0) {
    return `${cap.totalUnits} unités`;
  }
  return null;
}
