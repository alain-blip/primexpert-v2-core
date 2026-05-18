/**
 * Services & Reconnaissance — badges et champs.
 */

import type { ServiceBadgeView, ServicesRecognitionView } from './types';
import { SERVICES_SECTION_DEF, buildSectionFields } from './identitySections';
import { getNestedValue } from './resolveIdentityField';

export const SERVICE_BADGE_DEFS: {
  id: string;
  labelFr: string;
  labelEn: string;
}[] = [
  { id: 'repas', labelFr: 'Repas', labelEn: 'Meals' },
  { id: 'soins', labelFr: 'Soins', labelEn: 'Care' },
  { id: 'hebergement', labelFr: 'Hébergement', labelEn: 'Lodging' },
  { id: 'animation', labelFr: 'Animation', labelEn: 'Activities' },
  { id: 'entretienMenager', labelFr: 'Entretien ménager', labelEn: 'Housekeeping' },
  { id: 'blanchisserie', labelFr: 'Blanchisserie', labelEn: 'Laundry' },
  { id: 'transport', labelFr: 'Transport', labelEn: 'Transport' },
  { id: 'soinsInfirmiers', labelFr: 'Soins infirmiers', labelEn: 'Nursing care' },
];

function readActiveServices(doc: Record<string, unknown>): Set<string> {
  const sr = doc.servicesReconnaissance;
  const raw =
    (sr && typeof sr === 'object' && !Array.isArray(sr)
      ? (sr as Record<string, unknown>).servicesActifs ??
        (sr as Record<string, unknown>).badges
      : null) ??
    doc.servicesOfferts ??
    doc.servicesActifs;

  const set = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') set.add(item);
      else if (item && typeof item === 'object' && 'id' in (item as object)) {
        set.add(String((item as Record<string, unknown>).id));
      }
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      if (val === true) set.add(key);
    }
  }
  return set;
}

export function buildServicesRecognitionView(
  doc: Record<string, unknown>
): ServicesRecognitionView {
  const active = readActiveServices(doc);
  const badges: ServiceBadgeView[] = SERVICE_BADGE_DEFS.map((def) => ({
    ...def,
    active: active.has(def.id),
  }));

  return {
    fields: buildSectionFields(doc, SERVICES_SECTION_DEF),
    badges,
  };
}

export function buildServicesBadgesPatch(
  doc: Record<string, unknown>,
  badgeId: string,
  active: boolean
): Record<string, unknown> {
  const current = readActiveServices(doc);
  if (active) current.add(badgeId);
  else current.delete(badgeId);

  const existing = doc.servicesReconnaissance;
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};

  return {
    servicesReconnaissance: {
      ...base,
      servicesActifs: Array.from(current),
      confirmedBy: base.confirmedBy ?? undefined,
    },
  };
}

export function appendServicesFieldConfirmation(
  doc: Record<string, unknown>,
  patch: Record<string, unknown>,
  fieldId: string
): void {
  if (fieldId.startsWith('services')) {
    const existing = patch.servicesReconnaissance ?? doc.servicesReconnaissance;
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
    patch.servicesReconnaissance = { ...base, confirmedBy: 'user' };
  }
}

export function getServicesNestedValue(doc: Record<string, unknown>, fieldId: string): string {
  const def = SERVICES_SECTION_DEF.fields.find((f) => f.id === fieldId);
  if (!def) return '';
  if (def.canonicalKey) {
    const v = doc[def.canonicalKey];
    return v != null ? String(v) : '';
  }
  if (def.nestedPath?.length) {
    const v = getNestedValue(doc, def.nestedPath);
    return v != null ? String(v) : '';
  }
  return '';
}
