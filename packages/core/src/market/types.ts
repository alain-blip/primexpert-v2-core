/**
 * Marché & concurrence — types partagés (SSOT Copilote → PrimeXpert V2).
 */

export type MarketScopeLevel = 'strict' | 'expanded' | 'regional';

export interface MarketScopeSearchLogEntry {
  radius: number;
  count: number;
}

export interface MarketScope {
  radiusKm: number;
  level: MarketScopeLevel;
  minCompetitorsTarget: number;
  competitorsFound: number;
  searchLog: MarketScopeSearchLogEntry[];
}

export interface MarketCompetitorRow {
  id: string;
  nom?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  _distanceKm?: number;
  nombreUnites?: number;
  capaciteTotal?: number;
  tauxOccupation?: number;
  prixDemande?: number;
  prixAnnonce?: number;
  askingPrice?: number;
  revenusAnnuelsBruts?: number;
  revenusAnnuels?: number;
  city?: string;
  address?: string;
  adresse?: string;
}

export interface MarketStatsSnapshot {
  nombreResidencesConcurrentes: number;
  nombreUnitesDisponiblesMarche: number;
  ratioUnitesParResidenceMarche: number;
  tauxOccupationMoyenMarche: number;
  tauxVacanceMarche: number;
  prixParUniteMarche: number;
  revenusParUniteMarche: number;
}

export interface VisitorEntranceCoords {
  lat: number;
  lng: number;
  label?: string;
  source?: string;
  placeId?: string;
  updatedAt?: string;
}

export type VisitorVisitChannel =
  | 'walk_in'
  | 'referral'
  | 'web'
  | 'broker'
  | 'family'
  | 'other';

export interface VisitorVisitEntry {
  id: string;
  visitedAt: string;
  visitorName?: string;
  visitorRole?: string;
  channel?: VisitorVisitChannel;
  notes?: string;
  recordedAt?: string;
}

export interface VisitorTractionStats {
  totalVisits: number;
  visitsLast30Days: number;
  visitsLast90Days: number;
  lastVisitAt: string | null;
  byChannel: Record<string, number>;
}

export const MARKET_DIAGNOSTIC_FIELDS = [
  'avantagesConcurrentiels',
  'pointsAmeliorer',
  'positionnementMarche',
] as const;

export type MarketDiagnosticFieldId = (typeof MARKET_DIAGNOSTIC_FIELDS)[number];
