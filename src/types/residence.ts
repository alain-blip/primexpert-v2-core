/**
 * Modèle universel « Asset » — silo multi-niches (RPA / CPE / Plex).
 * Une seule application cockpit ; les vues filtrent par `niche` + métadonnées.
 */

export type AssetNiche = 'RPA' | 'CPE' | 'PLEX';

export interface RpaNicheFields {
  units: number;
  careLevel: string;
}

export interface CpeNicheFields {
  places: number;
  permitType: string;
}

export interface PlexNicheFields {
  units: number;
  revenue: number;
  /** Taux d'inoccupation (0–1 ou % selon convention données) */
  vacancyRate?: number;
  mrn?: string;
}

export interface AssetNicheMetadata {
  rpaFields?: RpaNicheFields;
  cpeFields?: CpeNicheFields;
  plexFields?: PlexNicheFields;
}

/** Cases à cocher diffusion (RPAaVendre.com, CPEaVendre.com, PlexaVendre.com). */
export interface AssetSyndication {
  rpaAVendre?: boolean;
  cpeAVendre?: boolean;
  plexAVendre?: boolean;
}

export interface Asset {
  id: string;
  niche: AssetNiche;
  address: string;
  city: string;
  price: number;
  /** Courtier OACIQ-responsable (aligné `courtiersResponsables`). */
  ownerBrokerId?: string;
  metadata: AssetNicheMetadata;
  syndication?: AssetSyndication;
}

export const ASSET_NICHE_IDS: readonly AssetNiche[] = ['RPA', 'CPE', 'PLEX'] as const;

export function parseAssetNiche(raw: unknown): AssetNiche | undefined {
  if (raw === 'RPA' || raw === 'CPE' || raw === 'PLEX') return raw;
  return undefined;
}

/**
 * Cloison silo : fiche sans `assetNiche` = héritage RPA uniquement
 * (les CPE/Plex exigent une niche explicite en base).
 */
export function residenceMatchesNiche(
  assetNiche: AssetNiche | undefined,
  activeNiche: AssetNiche
): boolean {
  if (!assetNiche) return activeNiche === 'RPA';
  return assetNiche === activeNiche;
}
