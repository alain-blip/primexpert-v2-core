import type { Residence } from '../services/residences';
import type { RadarPropertyType } from '../types/radarAccess';
import { RADAR_EXCLUSIVE_TYPES, RADAR_UPSELL_TYPES } from '../types/radarAccess';

export type { RadarPropertyType };

const PROTECTED_TYPES: RadarPropertyType[] = ['rpa', 'cpe', 'plex', 'commercial'];

function hasSpecialty(userSpecialties: string[], type: RadarPropertyType): boolean {
  const norm = userSpecialties.map((s) => s.trim().toLowerCase());
  return norm.includes(type);
}

/** Déduit le type de bien à partir de la fiche (niche ou champ explicite). */
export function resolvePropertyType(residence: Residence): RadarPropertyType {
  if (residence.propertyType) {
    const p = residence.propertyType.toLowerCase();
    if (PROTECTED_TYPES.includes(p as RadarPropertyType)) return p as RadarPropertyType;
  }
  const niche = residence.assetNiche?.toLowerCase();
  if (niche === 'rpa' || niche === 'cpe' || niche === 'plex') return niche;
  return 'rpa';
}

/**
 * RPA / CPE : exclusion stricte si la spécialité manque.
 * Plex / commercial : toujours affichés (verrouillés ensuite si besoin).
 */
export function shouldDisplayProperty(
  propertyType: string,
  userSpecialties: string[]
): boolean {
  const t = propertyType.toLowerCase() as RadarPropertyType;
  if (RADAR_EXCLUSIVE_TYPES.includes(t)) {
    return hasSpecialty(userSpecialties, t);
  }
  return true;
}

/** Plex & commercial uniquement : flou + upsell si spécialité absente. */
export function isPropertyLocked(propertyType: string, userSpecialties: string[]): boolean {
  const t = propertyType.toLowerCase() as RadarPropertyType;
  if (!RADAR_UPSELL_TYPES.includes(t)) return false;
  return !hasSpecialty(userSpecialties, t);
}

export interface RadarListingView extends Residence {
  propertyType: RadarPropertyType;
  isLocked: boolean;
}

export function enrichListingForRadar(
  residence: Residence,
  userSpecialties: string[]
): RadarListingView | null {
  const propertyType = resolvePropertyType(residence);
  if (!shouldDisplayProperty(propertyType, userSpecialties)) return null;
  return {
    ...residence,
    propertyType,
    isLocked: isPropertyLocked(propertyType, userSpecialties),
  };
}

export function filterListingsForRadar(
  residences: Residence[],
  userSpecialties: string[]
): RadarListingView[] {
  const out: RadarListingView[] = [];
  for (const r of residences) {
    const row = enrichListingForRadar(r, userSpecialties);
    if (row) out.push(row);
  }
  return out;
}

export function upsellExtensionLabel(
  propertyType: RadarPropertyType,
  locale: 'fr' | 'en'
): string {
  const labels: Record<RadarPropertyType, { fr: string; en: string }> = {
    rpa: { fr: 'RPA', en: 'RPA' },
    cpe: { fr: 'CPE', en: 'CPE' },
    plex: { fr: 'Plex / multilogement', en: 'Plex / multi-unit' },
    commercial: { fr: 'Commercial', en: 'Commercial' },
  };
  return locale === 'fr' ? labels[propertyType].fr : labels[propertyType].en;
}
