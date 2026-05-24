/**
 * Régions sociosanitaires du Québec — SSOT (aligné legacy `msssRegions.js`).
 */

export const QUEBEC_REGIONS = [
  'Bas-Saint-Laurent',
  'Saguenay-Lac-Saint-Jean',
  'Capitale-Nationale',
  'Mauricie et Centre-du-Québec',
  'Estrie',
  'Montréal',
  'Outaouais',
  'Abitibi-Témiscamingue',
  'Côte-Nord',
  'Nord-du-Québec',
  'Gaspésie-Îles-de-la-Madeleine',
  'Chaudière-Appalaches',
  'Laval',
  'Lanaudière',
  'Laurentides',
  'Montérégie',
] as const;

export type QuebecRegion = (typeof QUEBEC_REGIONS)[number];

const REGION_ALIASES: Record<string, QuebecRegion> = {
  Mauricie: 'Mauricie et Centre-du-Québec',
  'Centre-du-Québec': 'Mauricie et Centre-du-Québec',
  'Saguenay–Lac-Saint-Jean': 'Saguenay-Lac-Saint-Jean',
  'Gaspésie–Îles-de-la-Madeleine': 'Gaspésie-Îles-de-la-Madeleine',
};

function normalizeRegionToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Résout le libellé région affiché / filtré pour une fiche. */
export function resolveResidenceQuebecRegion(residence: {
  region?: string | null;
  city?: string | null;
  ville?: string | null;
}): QuebecRegion | null {
  const candidates = [residence.region, residence.city, residence.ville].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  );

  for (const raw of candidates) {
    const trimmed = raw.trim();
    if ((QUEBEC_REGIONS as readonly string[]).includes(trimmed)) {
      return trimmed as QuebecRegion;
    }
    const alias = REGION_ALIASES[trimmed];
    if (alias) return alias;

    const token = normalizeRegionToken(trimmed);
    for (const region of QUEBEC_REGIONS) {
      if (normalizeRegionToken(region) === token) return region;
    }
    if (token.includes('montreal') || token === 'montreal') return 'Montréal';
    if (token.includes('laval')) return 'Laval';
    if (token.includes('longueuil') || token.includes('brossard')) return 'Montérégie';
  }

  return null;
}

/** Filtre inventaire — aucune sélection = tout afficher. */
export function residenceMatchesRegionFilter(
  residence: { region?: string | null; city?: string | null; ville?: string | null },
  selectedRegions: readonly string[]
): boolean {
  if (!selectedRegions.length) return true;
  const resolved = resolveResidenceQuebecRegion(residence);
  if (!resolved) return false;
  return selectedRegions.includes(resolved);
}
