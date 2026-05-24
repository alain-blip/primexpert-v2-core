/**
 * Normalisation des régions administratives QC — Dashboard GPS.
 * Fusionne alias (Quebec/Québec) et rattache les municipalités à leur région officielle.
 */

import { REGIONS_QUEBEC } from '../financial/regionsQuebec';
import { QUEBEC_REGIONS } from '../residence/quebecRegions';

export function normalizeRegionToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const REGION_NAME_ALIASES: Record<string, string> = {
  quebec: 'Capitale-Nationale',
  'ville de quebec': 'Capitale-Nationale',
  mauricie: 'Mauricie et Centre-du-Québec',
  'centre-du-quebec': 'Mauricie et Centre-du-Québec',
  'saguenay-lac-saint-jean': 'Saguenay-Lac-Saint-Jean',
  'saguenay–lac-saint-jean': 'Saguenay-Lac-Saint-Jean',
  'gaspesie–iles-de-la-madeleine': 'Gaspésie-Îles-de-la-Madeleine',
  'gaspésie–îles-de-la-madeleine': 'Gaspésie-Îles-de-la-Madeleine',
  'gaspesie-iles-de-la-madeleine': 'Gaspésie-Îles-de-la-Madeleine',
  'chaudiere-appalaches': 'Chaudière-Appalaches',
  montreal: 'Montréal',
  'grand montreal': 'Montréal',
  monteregie: 'Montérégie',
};

/** Municipalités → région sociosanitaire (complète REGIONS_QUEBEC). */
const MUNICIPALITY_TO_REGION: Record<string, string> = {
  'cap-saint-ignace': 'Chaudière-Appalaches',
  lotbiniere: 'Chaudière-Appalaches',
  'saint-henri-de-levis': 'Chaudière-Appalaches',
  'thetford mines': 'Chaudière-Appalaches',
  beauceville: 'Chaudière-Appalaches',
  'saint-georges': 'Chaudière-Appalaches',
  'saint-jean-sur-richelieu': 'Montérégie',
  brossard: 'Montérégie',
  longueuil: 'Montérégie',
  granby: 'Montérégie',
  'saint-hyacinthe': 'Montérégie',
  laval: 'Laval',
  gatineau: 'Outaouais',
  hull: 'Outaouais',
  sherbrooke: 'Estrie',
  'trois-rivieres': 'Mauricie et Centre-du-Québec',
  drummondville: 'Mauricie et Centre-du-Québec',
  'saint-jerome': 'Laurentides',
  blainville: 'Laurentides',
  terrebonne: 'Lanaudière',
  repentigny: 'Lanaudière',
  joliette: 'Lanaudière',
  rimouski: 'Bas-Saint-Laurent',
  saguenay: 'Saguenay-Lac-Saint-Jean',
  chicoutimi: 'Saguenay-Lac-Saint-Jean',
  'rouyn-noranda': 'Abitibi-Témiscamingue',
  "val-d'or": 'Abitibi-Témiscamingue',
  'sept-iles': 'Côte-Nord',
  'baie-comeau': 'Côte-Nord',
  'baie-saint-paul': 'Capitale-Nationale',
  charlevoix: 'Capitale-Nationale',
};

for (const row of Object.values(REGIONS_QUEBEC)) {
  const canonical = resolveOfficialRegionName(row.name) ?? row.name;
  MUNICIPALITY_TO_REGION[normalizeRegionToken(row.dominantCity)] = canonical;
  for (const alias of row.aliases) {
    MUNICIPALITY_TO_REGION[normalizeRegionToken(alias)] = canonical;
  }
  MUNICIPALITY_TO_REGION[normalizeRegionToken(row.name)] = canonical;
}

function isOfficialRegion(name: string): boolean {
  return (QUEBEC_REGIONS as readonly string[]).includes(name);
}

/** Résout un libellé vers le nom canonique QUEBEC_REGIONS. */
export function resolveOfficialRegionName(raw: string): string | null {
  const trimmed = raw.trim().replace(/^\d{1,2}\s*[-–—]\s*/, '');
  if (!trimmed || trimmed === '—') return null;
  if (isOfficialRegion(trimmed)) return trimmed;

  const alias = REGION_NAME_ALIASES[normalizeRegionToken(trimmed)];
  if (alias) return alias;

  const token = normalizeRegionToken(trimmed);
  for (const region of QUEBEC_REGIONS) {
    if (normalizeRegionToken(region) === token) return region;
  }

  for (const row of Object.values(REGIONS_QUEBEC)) {
    if (normalizeRegionToken(row.name) === token) {
      const mapped = QUEBEC_REGIONS.find(
        (r) =>
          normalizeRegionToken(r) === normalizeRegionToken(row.name) ||
          normalizeRegionToken(r).includes(normalizeRegionToken(row.name).slice(0, 10))
      );
      return mapped ?? row.name;
    }
  }

  return null;
}

/**
 * Normalise région + ville : élimine les libellés municipaux isolés
 * (ex. Cap-Saint-Ignace → Chaudière-Appalaches, Quebec → Capitale-Nationale).
 */
export function normalizeAdministrativeRegion(rawRegion: string, city?: string): string {
  const region = String(rawRegion ?? '').trim();
  const cityStr = String(city ?? '').trim();

  const fromRegionOfficial = region ? resolveOfficialRegionName(region) : null;
  if (fromRegionOfficial) return fromRegionOfficial;

  const regionToken = normalizeRegionToken(region);
  const fromMunicipality = regionToken ? MUNICIPALITY_TO_REGION[regionToken] : undefined;
  if (fromMunicipality) return fromMunicipality;

  if (cityStr) {
    const fromCity = resolveOfficialRegionName(cityStr);
    if (fromCity) return fromCity;
    const cityMapped = MUNICIPALITY_TO_REGION[normalizeRegionToken(cityStr)];
    if (cityMapped) return cityMapped;
  }

  if (region && region !== '—') return region;
  return cityStr || '—';
}

/** Régions hors canon QC affichées dans le filtre GPS si des données existent. */
export const GPS_FILTER_EXTRA_REGIONS = ['Hors Québec', 'Canada', 'Non spécifié'] as const;

/**
 * Ramène tout libellé (ville, alias, préfixe numérique) vers une région filtrable GPS.
 * Ne retourne jamais une municipalité isolée.
 */
export function coerceToGpsFilterRegion(rawRegion: string, city?: string): string {
  const officialFromRaw = resolveOfficialRegionName(rawRegion);
  if (officialFromRaw) return officialFromRaw;

  const normalized = normalizeAdministrativeRegion(rawRegion, city);
  const officialFromNormalized = resolveOfficialRegionName(normalized);
  if (officialFromNormalized) return officialFromNormalized;

  if ((QUEBEC_REGIONS as readonly string[]).includes(normalized)) return normalized;

  const token = normalizeRegionToken(normalized);
  const fromMunicipality = MUNICIPALITY_TO_REGION[token];
  if (fromMunicipality) return fromMunicipality;

  if (city) {
    const fromCityOfficial = resolveOfficialRegionName(city);
    if (fromCityOfficial) return fromCityOfficial;
    const cityMapped = MUNICIPALITY_TO_REGION[normalizeRegionToken(city)];
    if (cityMapped) return cityMapped;
  }

  const combined = `${rawRegion} ${city ?? ''}`.toLowerCase();
  if (
    /ontario|alberta|colombie|british columbia|terre-neuve|nouveau-brunswick|nouvelle-écosse|nouvelle-ecosse|manitoba|saskatchewan|île-du-prince-édouard|ile-du-prince-edouard/.test(
      combined
    )
  ) {
    return 'Canada';
  }

  if (normalized && normalized !== '—') return 'Hors Québec';
  return 'Non spécifié';
}

/** Options strictes du filtre région — 17 régions QC + extras seulement si données présentes. */
export function buildGpsRegionFilterOptions(dataRegionLabels: readonly string[]): string[] {
  const coerced = new Set<string>();
  for (const label of dataRegionLabels) {
    if (label && label !== '—') coerced.add(coerceToGpsFilterRegion(label));
  }

  const options: string[] = [...QUEBEC_REGIONS];
  for (const extra of GPS_FILTER_EXTRA_REGIONS) {
    if (coerced.has(extra)) options.push(extra);
  }
  return options;
}

/** Tri d'affichage : régions QC officielles en premier (ordre canonique), puis extras. */
export function compareGpsRegionsForDisplay(a: string, b: string): number {
  const qcRank = (r: string): number => {
    const idx = (QUEBEC_REGIONS as readonly string[]).indexOf(r);
    return idx >= 0 ? idx : -1;
  };
  const extraRank = (r: string): number => {
    const idx = GPS_FILTER_EXTRA_REGIONS.indexOf(r as (typeof GPS_FILTER_EXTRA_REGIONS)[number]);
    return idx >= 0 ? 100 + idx : 200;
  };

  const rankA = qcRank(a) >= 0 ? qcRank(a) : extraRank(a);
  const rankB = qcRank(b) >= 0 ? qcRank(b) : extraRank(b);
  if (rankA !== rankB) return rankA - rankB;
  return a.localeCompare(b, 'fr-CA');
}

export function sortGpsRegionsForDisplay<T extends { region: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => compareGpsRegionsForDisplay(a.region, b.region));
}
