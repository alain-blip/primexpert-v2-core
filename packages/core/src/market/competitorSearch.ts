/**
 * Recherche progressive de comparables RPA (5 → 50 km).
 */

import { calculateHaversineDistanceKm } from './haversine';
import type {
  MarketCompetitorRow,
  MarketScope,
  MarketScopeLevel,
  MarketScopeSearchLogEntry,
  MarketStatsSnapshot,
} from './types';

export const RADIUS_STEPS_KM = [5, 10, 25, 50] as const;
export const MIN_COMPETITORS_TARGET = 3;

export interface ResidenceGeoCandidate {
  id: string;
  latitude?: unknown;
  longitude?: unknown;
  status?: string;
  statut?: string;
  [key: string]: unknown;
}

export function getScopeLevel(radiusKm: number, competitorsFound: number): MarketScopeLevel {
  if (competitorsFound === 0) return 'regional';
  if (radiusKm <= 5) return 'strict';
  return 'expanded';
}

export function getScopeMessageClient(
  scopeLevel: MarketScopeLevel,
  radiusKm: number,
  competitorsCount: number,
  lang: 'fr' | 'en' = 'fr'
): string {
  const n = competitorsCount;
  const pluralFr = n > 1;
  const pluralEn = n !== 1;

  if (lang === 'en') {
    switch (scopeLevel) {
      case 'strict':
        return `${n} comparable residence${pluralEn ? 's' : ''} identified within ${radiusKm} km.`;
      case 'expanded':
        return `Expanded analysis (${radiusKm} km) to reflect a relevant market. ${n} comparable residence${pluralEn ? 's' : ''}.`;
      case 'regional':
        return 'No strict comparable identified. Regional benchmark used as market reference.';
      default:
        return '';
    }
  }

  switch (scopeLevel) {
    case 'strict':
      return `${n} résidence${pluralFr ? 's' : ''} comparable${pluralFr ? 's' : ''} identifiée${pluralFr ? 's' : ''} dans un rayon de ${radiusKm} km.`;
    case 'expanded':
      return `Analyse élargie (${radiusKm} km) pour refléter un marché pertinent. ${n} résidence${pluralFr ? 's' : ''} comparable${pluralFr ? 's' : ''}.`;
    case 'regional':
      return 'Aucune comparable stricte identifiée. Analyse régionale utilisée comme repère de marché.';
    default:
      return '';
  }
}

export function getScopeMessageInterne(searchLog: MarketScopeSearchLogEntry[]): string {
  return searchLog.map((e) => `${e.count} à ${e.radius}km`).join(', ');
}

export function findCompetitorsWithinRadius(
  radiusKm: number,
  lat: number,
  lng: number,
  candidates: ResidenceGeoCandidate[],
  excludeResidenceId: string
): MarketCompetitorRow[] {
  const latDelta = (radiusKm / 6371) * (180 / Math.PI);
  const lngDelta = (radiusKm / 6371) * (180 / Math.PI) / Math.cos((lat * Math.PI) / 180);

  const latMin = lat - latDelta;
  const latMax = lat + latDelta;
  const lngMin = lng - lngDelta;
  const lngMax = lng + lngDelta;

  const competitors: MarketCompetitorRow[] = [];

  for (const data of candidates) {
    if (data.id === excludeResidenceId) continue;

    const compLat = Number(data.latitude);
    const compLng = Number(data.longitude);
    if (Number.isNaN(compLat) || Number.isNaN(compLng)) continue;

    if (compLat < latMin || compLat > latMax || compLng < lngMin || compLng > lngMax) continue;

    const distanceKm = calculateHaversineDistanceKm(lat, lng, compLat, compLng);
    if (distanceKm > radiusKm) continue;

    if (data.status === 'fermee' || data.statut === 'fermee') continue;

    competitors.push({
      ...(data as MarketCompetitorRow),
      id: data.id,
      _distanceKm: Math.round(distanceKm * 100) / 100,
    });
  }

  competitors.sort((a, b) => (a._distanceKm ?? 0) - (b._distanceKm ?? 0));
  return competitors;
}

export interface ProgressiveSearchResult {
  competitors: MarketCompetitorRow[];
  usedRadiusKm: number;
  marketScope: MarketScope;
  scopeMessageClient: string;
  scopeMessageInterne: string;
  stats: MarketStatsSnapshot;
}

export function runProgressiveCompetitorSearch(
  lat: number,
  lng: number,
  candidates: ResidenceGeoCandidate[],
  excludeResidenceId: string,
  lang: 'fr' | 'en' = 'fr'
): ProgressiveSearchResult {
  let competitors: MarketCompetitorRow[] = [];
  let usedRadius = RADIUS_STEPS_KM[RADIUS_STEPS_KM.length - 1];
  const searchLog: MarketScopeSearchLogEntry[] = [];

  for (const radius of RADIUS_STEPS_KM) {
    competitors = findCompetitorsWithinRadius(radius, lat, lng, candidates, excludeResidenceId);
    searchLog.push({ radius, count: competitors.length });
    usedRadius = radius;
    if (competitors.length >= MIN_COMPETITORS_TARGET) break;
  }

  const scopeLevel = getScopeLevel(usedRadius, competitors.length);
  const marketScope: MarketScope = {
    radiusKm: usedRadius,
    level: scopeLevel,
    minCompetitorsTarget: MIN_COMPETITORS_TARGET,
    competitorsFound: competitors.length,
    searchLog,
  };

  return {
    competitors,
    usedRadiusKm: usedRadius,
    marketScope,
    scopeMessageClient: getScopeMessageClient(scopeLevel, usedRadius, competitors.length, lang),
    scopeMessageInterne: getScopeMessageInterne(searchLog),
    stats: computeMarketStats(competitors),
  };
}

export function computeMarketStats(competitors: MarketCompetitorRow[]): MarketStatsSnapshot {
  let totalUnites = 0;
  let totalOccupation = 0;
  let totalPrixParUnite = 0;
  let totalRevenusParUnite = 0;
  let countOccupation = 0;
  let countPrix = 0;
  let countRevenus = 0;

  for (const comp of competitors) {
    const unites = Number(comp.nombreUnites ?? comp.capaciteTotal ?? 0) || 0;
    totalUnites += unites;

    if (comp.tauxOccupation != null && !Number.isNaN(Number(comp.tauxOccupation))) {
      totalOccupation += Number(comp.tauxOccupation);
      countOccupation++;
    }

    const prix = comp.prixDemande ?? comp.prixAnnonce ?? comp.askingPrice;
    if (prix != null && unites > 0) {
      totalPrixParUnite += Number(prix) / unites;
      countPrix++;
    }

    const revenus = comp.revenusAnnuelsBruts ?? comp.revenusAnnuels;
    if (revenus != null && unites > 0) {
      totalRevenusParUnite += Number(revenus) / unites;
      countRevenus++;
    }
  }

  const tauxOccupationMoyenMarche =
    countOccupation > 0 ? totalOccupation / countOccupation : 0;

  return {
    nombreResidencesConcurrentes: competitors.length,
    nombreUnitesDisponiblesMarche: Math.round(totalUnites),
    ratioUnitesParResidenceMarche:
      competitors.length > 0
        ? Math.round((totalUnites / competitors.length) * 10) / 10
        : 0,
    tauxOccupationMoyenMarche: Math.round(tauxOccupationMoyenMarche * 10) / 10,
    tauxVacanceMarche:
      tauxOccupationMoyenMarche > 0
        ? Math.round((100 - tauxOccupationMoyenMarche) * 10) / 10
        : 0,
    prixParUniteMarche: countPrix > 0 ? Math.round(totalPrixParUnite / countPrix) : 0,
    revenusParUniteMarche:
      countRevenus > 0 ? Math.round(totalRevenusParUnite / countRevenus) : 0,
  };
}

export function buildMarketAnalysisPatch(
  result: ProgressiveSearchResult
): Record<string, unknown> {
  const { stats, competitors, marketScope, scopeMessageClient, scopeMessageInterne } =
    result;

  return {
    nombreResidencesConcurrentes: stats.nombreResidencesConcurrentes,
    nombreUnitesDisponiblesMarche: stats.nombreUnitesDisponiblesMarche,
    ratioUnitesParResidenceMarche: stats.ratioUnitesParResidenceMarche,
    tauxOccupationMoyenMarche: stats.tauxOccupationMoyenMarche,
    tauxVacanceMarche: stats.tauxVacanceMarche,
    prixParUniteMarche: stats.prixParUniteMarche,
    revenusParUniteMarche: stats.revenusParUniteMarche,
    marketAnalysisUpdatedAt: new Date().toISOString(),
    competitorsList: competitors,
    marketScope,
    marketScopeMessageClient: scopeMessageClient,
    marketScopeMessageInterne: scopeMessageInterne,
  };
}

export function parseCompetitorsList(doc: Record<string, unknown> | null): MarketCompetitorRow[] {
  const raw = doc?.competitorsList;
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is MarketCompetitorRow => row != null && typeof row === 'object');
}

export function parseMarketScope(doc: Record<string, unknown> | null): MarketScope | null {
  const raw = doc?.marketScope;
  if (!raw || typeof raw !== 'object') return null;
  return raw as MarketScope;
}

export function competitorDisplayName(comp: MarketCompetitorRow): string {
  return String(comp.nom ?? comp.name ?? 'Sans nom');
}

export function competitorUnits(comp: MarketCompetitorRow): string {
  const u = comp.nombreUnites ?? comp.capaciteTotal;
  return u != null && u !== '' ? String(u) : '—';
}
