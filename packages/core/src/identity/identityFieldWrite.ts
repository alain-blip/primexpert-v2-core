/**
 * Patch Firestore pour l'écriture identité (Phase 4b).
 * Raphael ✨ : confirmedBy "user" sur sous-objet ou identityConfirmations.
 */

import { prepareCanonicalPatch } from '../canonical/canonicalHelpers';
import { hasMsssEnrichment } from './msssRaphaelBadge';
import { getNestedValue } from './resolveIdentityField';
import type { IdentityFieldDef } from './identitySections';
import { getAllIdentitySectionDefs } from './identitySections';
import {
  buildRentPricingSavePatch,
  isRentPricingFieldId,
} from './rentPricingGrid';
import {
  appendServicesFieldConfirmation,
  buildServicesBadgesPatch,
} from './servicesRecognition';

export interface CapacityEditableFieldDef {
  id: string;
  canonicalKey?: string;
  nestedPath?: string[];
  confirmedPath?: string[];
  labelFr: string;
  labelEn: string;
  inputType?: 'text' | 'number';
}

export const CAPACITY_EDITABLE_FIELDS: CapacityEditableFieldDef[] = [
  {
    id: 'nombreUnitesTotal',
    canonicalKey: 'nombreUnitesTotal',
    labelFr: "Nombre total d'unités",
    labelEn: 'Total units',
    inputType: 'number',
  },
  {
    id: 'effectifs-jourSemaine',
    nestedPath: ['effectifs', 'jourSemaine'],
    confirmedPath: ['effectifs', 'confirmedBy'],
    labelFr: 'Effectifs — jour (sem.)',
    labelEn: 'Staff — day (weekday)',
    inputType: 'number',
  },
  {
    id: 'effectifs-jourFinSemaine',
    nestedPath: ['effectifs', 'jourFinSemaine'],
    confirmedPath: ['effectifs', 'confirmedBy'],
    labelFr: 'Effectifs — jour (f.s.)',
    labelEn: 'Staff — day (weekend)',
    inputType: 'number',
  },
  {
    id: 'effectifs-soir',
    nestedPath: ['effectifs', 'soir'],
    confirmedPath: ['effectifs', 'confirmedBy'],
    labelFr: 'Effectifs — soir',
    labelEn: 'Staff — evening',
    inputType: 'number',
  },
  {
    id: 'effectifs-nuit',
    nestedPath: ['effectifs', 'nuit'],
    confirmedPath: ['effectifs', 'confirmedBy'],
    labelFr: 'Effectifs — nuit',
    labelEn: 'Staff — night',
    inputType: 'number',
  },
];

export function getIdentityFieldDef(fieldId: string): IdentityFieldDef | undefined {
  for (const section of getAllIdentitySectionDefs()) {
    const def = section.fields.find((f) => f.id === fieldId);
    if (def) return def;
  }
  return undefined;
}

export function getCapacityFieldDef(fieldId: string): CapacityEditableFieldDef | undefined {
  return CAPACITY_EDITABLE_FIELDS.find((f) => f.id === fieldId);
}

function coerceScalarInput(
  rawValue: string,
  inputType?: 'text' | 'number' | 'sprinkler' | 'currency' | 'percent'
): unknown {
  const trimmed = rawValue.trim();
  if (inputType === 'number' || inputType === 'currency' || inputType === 'percent') {
    if (!trimmed) return null;
    const n = parseFloat(trimmed.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  if (inputType === 'sprinkler') {
    const lower = trimmed.toLowerCase();
    if (lower === 'oui' || lower === 'yes' || lower === 'true') return true;
    if (lower === 'non' || lower === 'no' || lower === 'false') return false;
    return trimmed || null;
  }
  return trimmed || null;
}

function setNestedOnPatch(
  doc: Record<string, unknown>,
  patch: Record<string, unknown>,
  nestedPath: string[],
  value: unknown
): void {
  if (nestedPath.length === 0) return;
  const [root, ...rest] = nestedPath;
  if (rest.length === 0) {
    patch[root] = value;
    return;
  }
  const existingRoot = patch[root] ?? getNestedValue(doc, [root]);
  const rootObj =
    existingRoot && typeof existingRoot === 'object' && !Array.isArray(existingRoot)
      ? { ...(existingRoot as Record<string, unknown>) }
      : {};
  let cur: Record<string, unknown> = rootObj;
  for (let i = 0; i < rest.length - 1; i++) {
    const key = rest[i];
    const next =
      cur[key] && typeof cur[key] === 'object' && !Array.isArray(cur[key])
        ? { ...(cur[key] as Record<string, unknown>) }
        : {};
    cur[key] = next;
    cur = next;
  }
  cur[rest[rest.length - 1]] = value;
  patch[root] = rootObj;
}

function mergeParentConfirmed(
  doc: Record<string, unknown>,
  patch: Record<string, unknown>,
  confirmedPath: string[]
): void {
  const parentKey = confirmedPath[0];
  const existingInPatch = patch[parentKey];
  const existingInDoc = getNestedValue(doc, [parentKey]);
  const base =
    existingInPatch && typeof existingInPatch === 'object' && !Array.isArray(existingInPatch)
      ? (existingInPatch as Record<string, unknown>)
      : existingInDoc && typeof existingInDoc === 'object' && !Array.isArray(existingInDoc)
        ? { ...(existingInDoc as Record<string, unknown>) }
        : {};
  patch[parentKey] = { ...base, confirmedBy: 'user' };
}

function appendRaphaelUserConfirmation(
  doc: Record<string, unknown>,
  patch: Record<string, unknown>,
  opts: { fieldId: string; confirmedPath?: string[] }
): void {
  if (!hasMsssEnrichment(doc)) return;

  if (opts.confirmedPath?.length) {
    mergeParentConfirmed(doc, patch, opts.confirmedPath);
    return;
  }

  const existing = doc.identityConfirmations;
  const map =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  map[opts.fieldId] = {
    confirmedBy: 'user',
    confirmedAt: new Date().toISOString(),
  };
  patch.identityConfirmations = map;
}

function resolveInputType(fieldId: string, def: IdentityFieldDef): IdentityFieldDef['inputType'] {
  if (def.inputType) return def.inputType;
  if (fieldId === 'systemeGicleurs' || fieldId === 'generatrice' || fieldId === 'ascenseur') {
    return 'sprinkler';
  }
  if (
    fieldId.includes('evaluation') ||
    fieldId.includes('valeurMarche') ||
    fieldId.includes('Fonciere')
  ) {
    return 'currency';
  }
  if (fieldId.includes('ecart') || fieldId.includes('Pct')) {
    return 'percent';
  }
  if (
    fieldId === 'anneeConstruction' ||
    fieldId === 'nombreEtages' ||
    fieldId === 'superficieBatiment' ||
    fieldId === 'superficieTerrain' ||
    fieldId === 'nombreAscenseurs'
  ) {
    return 'number';
  }
  return 'text';
}

/** Construit le patch Firestore pour un champ identité. */
export function buildIdentityFieldSavePatch(
  doc: Record<string, unknown>,
  fieldId: string,
  rawValue: string
): Record<string, unknown> {
  if (isRentPricingFieldId(fieldId)) {
    return buildRentPricingSavePatch(doc, fieldId, rawValue);
  }

  const def = getIdentityFieldDef(fieldId);
  if (!def) {
    throw new Error(`Champ identité inconnu: ${fieldId}`);
  }

  const inputType = resolveInputType(fieldId, def);
  const value = coerceScalarInput(rawValue, inputType);
  const patch: Record<string, unknown> = {};

  if (def.nestedPath?.length) {
    setNestedOnPatch(doc, patch, def.nestedPath, value);
  } else if (def.canonicalKey) {
    patch[def.canonicalKey] = value;
  } else {
    patch[fieldId] = value;
  }

  if (fieldId === 'systemeGicleurs') {
    patch.giclee = value;
    patch.sprinklers = value;
  }

  if (fieldId === 'administrateursREQ' && typeof value === 'string' && value.trim()) {
    patch.administrateursREQ = value.split('·').map((s) => s.trim()).filter(Boolean);
  }

  const canonicalPatch = prepareCanonicalPatch(patch);

  appendRaphaelUserConfirmation(doc, canonicalPatch, {
    fieldId,
    confirmedPath: def.confirmedPath,
  });

  appendServicesFieldConfirmation(doc, canonicalPatch, fieldId);

  return canonicalPatch;
}

/** Patch pour un champ capacité / effectifs. */
export function buildCapacityFieldSavePatch(
  doc: Record<string, unknown>,
  fieldId: string,
  rawValue: string
): Record<string, unknown> {
  const def = getCapacityFieldDef(fieldId);
  if (!def) {
    throw new Error(`Champ capacité inconnu: ${fieldId}`);
  }

  const value = coerceScalarInput(rawValue, def.inputType ?? 'text');
  const patch: Record<string, unknown> = {};

  if (def.nestedPath?.length) {
    setNestedOnPatch(doc, patch, def.nestedPath, value);
  } else if (def.canonicalKey) {
    patch[def.canonicalKey] = value;
  }

  const canonicalPatch = prepareCanonicalPatch(patch);

  appendRaphaelUserConfirmation(doc, canonicalPatch, {
    fieldId,
    confirmedPath: def.confirmedPath,
  });

  return canonicalPatch;
}

export function buildServiceBadgeTogglePatch(
  doc: Record<string, unknown>,
  badgeId: string,
  active: boolean
): Record<string, unknown> {
  const patch = buildServicesBadgesPatch(doc, badgeId, active);
  if (hasMsssEnrichment(doc)) {
    appendRaphaelUserConfirmation(doc, patch, { fieldId: `service-badge-${badgeId}` });
    const sr = patch.servicesReconnaissance as Record<string, unknown>;
    patch.servicesReconnaissance = { ...sr, confirmedBy: 'user' };
  }
  return patch;
}
