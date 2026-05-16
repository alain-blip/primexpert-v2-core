/**
 * Agrégation — IdentityViewModel (lecture seule Phase 4a).
 */

import type { IdentityViewModel } from './types';
import { IDENTITY_SECTION_DEFS, buildSectionFields } from './identitySections';
import {
  formatAddressLine,
  formatRegionPrincipal,
  formatIdentityScalar,
} from './formatIdentityDisplay';
import {
  computeCapacityAggregates,
  formatUnitsOverview,
  isCapacityDataMissing,
} from './capacityAggregates';
import { getMsssEnrichment, hasMsssEnrichment } from './msssRaphaelBadge';
import { resolveIdentityField } from './resolveIdentityField';

function formatMsssDate(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
    try {
      const d = (raw as { toDate: () => Date }).toDate();
      return d.toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return null;
    }
  }
  if (typeof raw === 'string') return raw;
  return null;
}

export function buildIdentityViewModel(
  doc: Record<string, unknown> | null,
  opts: { loading?: boolean } = {}
): IdentityViewModel {
  const loading = opts.loading ?? false;
  const hasDocument = doc != null && Object.keys(doc).length > 0;

  if (!hasDocument) {
    return {
      loading,
      hasDocument: false,
      overview: {
        name: null,
        typeCategory: null,
        unitsLabel: null,
        region: null,
        address: null,
      },
      sections: IDENTITY_SECTION_DEFS.map((s) => ({
        id: s.id,
        titleFr: s.titleFr,
        titleEn: s.titleEn,
        accent: s.accent,
        fields: [],
      })),
      capacity: {
        totalUnits: null,
        unitsByType: [],
        occupancyRate: null,
        agePyramid: [],
        totalResidents: 0,
      },
      msss: { available: false, source: null, lastEnrichedLabel: null, numeroRegistre: null },
      showMsssBanner: false,
      criticalGaps: [],
    };
  }

  const d = doc!;
  const name = formatIdentityScalar(resolveIdentityField(d, 'name'), '');
  const type = formatIdentityScalar(resolveIdentityField(d, 'residenceType'), '');
  const cat = formatIdentityScalar(resolveIdentityField(d, 'categorieRPA'), '');
  const typeCategory = [type, cat].filter((x) => x && x !== '—').join(' · ') || null;

  const msssRaw = getMsssEnrichment(d);
  const msss = {
    available: hasMsssEnrichment(d),
    source: msssRaw?.source != null ? String(msssRaw.source) : null,
    lastEnrichedLabel: formatMsssDate(msssRaw?.lastEnriched),
    numeroRegistre:
      msssRaw?.numeroRegistre != null ? String(msssRaw.numeroRegistre) : null,
  };

  const capacityMissing = isCapacityDataMissing(d);
  const criticalGaps: string[] = [];
  if (capacityMissing) criticalGaps.push('capacity');
  if (isFieldGap(d, 'neq')) criticalGaps.push('neq');
  if (isFieldGap(d, 'numeroCertification')) criticalGaps.push('certification');

  const showMsssBanner = msss.available && criticalGaps.length > 0;

  const sections = IDENTITY_SECTION_DEFS.map((section) => ({
    id: section.id,
    titleFr: section.titleFr,
    titleEn: section.titleEn,
    accent: section.accent,
    fields: buildSectionFields(d, section),
  }));

  return {
    loading,
    hasDocument: true,
    overview: {
      name: name && name !== '—' ? name : null,
      typeCategory,
      unitsLabel: formatUnitsOverview(d),
      region: formatRegionPrincipal(d),
      address: formatAddressLine(d),
    },
    sections,
    capacity: computeCapacityAggregates(d),
    msss,
    showMsssBanner,
    criticalGaps,
  };
}

function isFieldGap(doc: Record<string, unknown>, canonicalKey: string): boolean {
  const v = resolveIdentityField(doc, canonicalKey);
  return v === undefined || v === null || v === '';
}
