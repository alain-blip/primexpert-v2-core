/**
 * Types — Identité fusionnée (Phase 4).
 */

export type IdentitySectionId =
  | 'overview'
  | 'establishment'
  | 'legal'
  | 'building_cadastre'
  | 'building_crossval'
  | 'building_structure'
  | 'building_technical'
  | 'building_security'
  | 'services'
  | 'rent_pricing'
  | 'capacity';

export interface IdentityFieldRow {
  id: string;
  labelFr: string;
  labelEn: string;
  value: string;
  showRaphaelBadge: boolean;
  empty: boolean;
  inputType?: 'text' | 'number' | 'sprinkler' | 'currency' | 'percent';
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

export interface ServiceBadgeView {
  id: string;
  labelFr: string;
  labelEn: string;
  active: boolean;
}

export interface ServicesRecognitionView {
  fields: IdentityFieldRow[];
  badges: ServiceBadgeView[];
}

export interface RentPricingRowView {
  typeKey: string;
  labelFr: string;
  labelEn: string;
  qty: number;
  occupationPct: number | null;
  loyerMoyen: number | null;
  revenuPotentielAnnuel: number | null;
  showRaphaelBadge: boolean;
  fieldIds: {
    qty: string;
    occupation: string;
    loyer: string;
  };
}

export interface RentPricingView {
  rows: RentPricingRowView[];
  totalRevenuPotentielAnnuel: number | null;
  failSafeRbeHint: number | null;
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
  buildingAudit: IdentitySectionView[];
  services: ServicesRecognitionView;
  rentPricing: RentPricingView;
  capacity: CapacityAggregatesView;
  msss: MsssEnrichmentMeta;
  showMsssBanner: boolean;
  criticalGaps: string[];
}
