/**
 * Résolution de champs identité — alias canoniques + chemins imbriqués.
 */

import { getResidenceField } from '../canonical/canonicalHelpers';

export function getNestedValue(
  doc: Record<string, unknown> | null | undefined,
  path: string[]
): unknown {
  if (!doc || path.length === 0) return undefined;
  let cur: unknown = doc;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function isFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'number' && !Number.isFinite(value)) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Lit un champ canonique (aliases Firestore) ou un chemin imbriqué (`immeuble.generatrice`).
 */
export function resolveIdentityField(
  doc: Record<string, unknown> | null | undefined,
  canonicalKey: string,
  nestedPath?: string[]
): unknown {
  if (!doc) return undefined;

  if (nestedPath?.length) {
    const nested = getNestedValue(doc, nestedPath);
    if (!isFieldEmpty(nested)) return nested;
  }

  return getResidenceField(doc, canonicalKey);
}

/** Gicleurs : booléen / chaîne / alias historiques. */
export function resolveSprinklerDisplay(doc: Record<string, unknown>): string | null {
  const raw =
    resolveIdentityField(doc, 'systemeGicleurs') ??
    doc.giclee ??
    doc.sprinklers ??
    doc.niveauGicleurs;
  if (raw === true) return 'Oui';
  if (raw === false) return 'Non';
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}

/** Génératrice : racine ou `immeuble.generatrice`. */
export function resolveGeneratorDisplay(doc: Record<string, unknown>): string | null {
  const root = resolveIdentityField(doc, 'generatrice');
  if (root === true) return 'Oui';
  if (root === false) return 'Non';
  if (typeof root === 'string' && root.trim()) return root.trim();

  const nested = getNestedValue(doc, ['immeuble', 'generatrice']);
  if (nested === true) return 'Oui';
  if (nested === false) return 'Non';
  return null;
}
