import type { UserProfile } from './auth';
import type { RadarPropertyType } from '../types/radarAccess';

function normalizeSpecialty(s: string): RadarPropertyType | null {
  const v = s.trim().toLowerCase();
  if (v === 'rpa' || v === 'cpe' || v === 'plex' || v === 'commercial') return v;
  return null;
}

/** Spécialités actives pour le courtier (Firestore `specialties` ou silos accessibles). */
export function resolveUserSpecialties(profile: UserProfile | null | undefined): RadarPropertyType[] {
  if (!profile) return [];

  if (profile.role === 'admin_system') {
    return ['rpa', 'cpe', 'plex', 'commercial'];
  }

  if (profile.specialties?.length) {
    const set = new Set<RadarPropertyType>();
    for (const s of profile.specialties) {
      const n = normalizeSpecialty(s);
      if (n) set.add(n);
    }
    return [...set];
  }

  const fromSilos = (profile.accessibleSilos ?? ['RPA', 'CPE', 'PLEX']).map((s) => s.toLowerCase());
  const set = new Set<RadarPropertyType>();
  for (const s of fromSilos) {
    const n = normalizeSpecialty(s);
    if (n && n !== 'commercial') set.add(n);
  }
  return [...set];
}
