/** Types de biens protégés par forfait / spécialité (Radar). */
export type RadarPropertyType = 'rpa' | 'cpe' | 'plex' | 'commercial';

export const RADAR_EXCLUSIVE_TYPES: readonly RadarPropertyType[] = ['rpa', 'cpe'];

export const RADAR_UPSELL_TYPES: readonly RadarPropertyType[] = ['plex', 'commercial'];
