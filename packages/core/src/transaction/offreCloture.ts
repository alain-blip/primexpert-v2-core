/**
 * SSOT — Clôture, proratas & rétribution (Axe 3 PA).
 *
 * Clés canoniques Firestore (objet racine `offre`) :
 * - offre.datePrisePossession
 * - offre.transfertFiducie
 * - offre.prorataSubventions
 */

import type { TernaryBool } from './offreConditions';
import { firstIso, firstTernary, toTernaryBool } from './transactionParseUtils';

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

export { toTernaryBool };
