/**
 * SSOT — Clôture, proratas & rétribution (Axe 3 PA).
 *
 * Clés canoniques Firestore (objet racine `offre`) :
 * - offre.datePrisePossession
 * - offre.transfertFiducie
 * - offre.prorataSubventions
 */

import type { TernaryBool } from './offreConditions';

export const OFFRE_CLOTURE_KEYS = {
  datePrisePossession: 'datePrisePossession',
  transfertFiducie: 'transfertFiducie',
  prorataSubventions: 'prorataSubventions',
} as const;

export type OffreClotureFieldKey = keyof typeof OFFRE_CLOTURE_KEYS;

export interface OffreClotureInput {
  datePrisePossession?: string;
  transfertFiducie?: TernaryBool;
  prorataSubventions?: TernaryBool;
}

export const OFFRE_CLOTURE_FIRESTORE_PATHS = {
  datePrisePossession: 'offre.datePrisePossession',
  transfertFiducie: 'offre.transfertFiducie',
  prorataSubventions: 'offre.prorataSubventions',
} as const;

function toTernaryBool(raw: unknown): TernaryBool {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  if (typeof raw === 'string') {
    const norm = raw.trim().toLowerCase();
    if (['true', 'oui', 'yes', '1', 'o'].includes(norm)) return true;
    if (['false', 'non', 'no', '0', 'n'].includes(norm)) return false;
  }
  return null;
}

function toIsoDateString(raw: unknown): string | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const t = Date.parse(trimmed);
    if (Number.isFinite(t)) {
      const d = new Date(t);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (typeof o.toMillis === 'function') {
      try {
        const d = new Date((o.toMillis as () => number)());
        if (!Number.isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        }
      } catch {
        return undefined;
      }
    }
    if (typeof o.seconds === 'number') {
      const d = new Date(o.seconds * 1000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  return undefined;
}

function firstIso(sources: unknown[]): string | undefined {
  for (const raw of sources) {
    const iso = toIsoDateString(raw);
    if (iso) return iso;
  }
  return undefined;
}

function firstTernary(sources: unknown[]): TernaryBool {
  for (const raw of sources) {
    if (raw === undefined || raw === null || raw === '') continue;
    return toTernaryBool(raw);
  }
  return null;
}

/**
 * Lit la clôture / proratas depuis le document résidence, avec repli legacy.
 */
export function parseOffreClotureFromDoc(
  doc: Record<string, unknown> | null | undefined
): OffreClotureInput {
  if (!doc) return {};

  const offre =
    doc.offre && typeof doc.offre === 'object'
      ? (doc.offre as Record<string, unknown>)
      : {};

  const promesse =
    doc.promesseAchat && typeof doc.promesseAchat === 'object'
      ? (doc.promesseAchat as Record<string, unknown>)
      : {};

  return {
    datePrisePossession: firstIso([
      offre.datePrisePossession,
      doc.datePrisePossession,
      promesse.datePrisePossession,
      promesse.dateNotairePrevue,
      promesse.dateNotaire,
      promesse.dateCloture,
    ]),
    transfertFiducie: firstTernary([
      offre.transfertFiducie,
      offre.transfertDepotsFiducie,
      doc.transfertFiducie,
      doc.transfertDepots,
      promesse.transfertFiducie,
    ]),
    prorataSubventions: firstTernary([
      offre.prorataSubventions,
      offre.prorataMsss,
      offre.repartitionSubventionsMsss,
      doc.prorataSubventions,
      doc.prorataMsss,
      promesse.prorataSubventions,
    ]),
  };
}

export function patchOffreClotureField<K extends OffreClotureFieldKey>(
  current: OffreClotureInput,
  key: K,
  value: OffreClotureInput[K]
): OffreClotureInput {
  return { ...current, [key]: value };
}
