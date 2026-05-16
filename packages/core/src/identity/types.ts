/**
 * Types — Identité fusionnée (Phase 4a).
 */

export type IdentitySectionId =
  | 'overview'
  | 'establishment'
  | 'legal'
  | 'building'
  | 'capacity';

export interface IdentityFieldRow {
  id: string;
  labelFr: string;
  labelEn: string;
  value: string;
  showRaphaelBadge: boolean;
  empty: boolean;
}

export interface IdentitySectionView {
  id: IdentitySectionId;
  titleFr: string;
  titleEn: string;
  accent: string;
  fields: IdentityFieldRow[];
}

export interface CapacityPyramidRow {
  label: string;
  count: number;
  pct: number;
}

export interface CapacityAggregatesView {
  totalUnits: number | null;
  unitsByType: { labelFr: string; labelEn: string; count: number }[];
  occupancyRate: string | null;
  agePyramid: CapacityPyramidRow[];
  totalResidents: number;
}

export interface MsssEnrichmentMeta {
  available: boolean;
  source: string | null;
  lastEnrichedLabel: string | null;
  numeroRegistre: string | null;
}

export interface IdentityViewModel {
  loading: boolean;
  hasDocument: boolean;
  overview: {
    name: string | null;
    typeCategory: string | null;
    unitsLabel: string | null;
    region: string | null;
    address: string | null;
  };
  sections: IdentitySectionView[];
  capacity: CapacityAggregatesView;
  msss: MsssEnrichmentMeta;
  showMsssBanner: boolean;
  criticalGaps: string[];
}
