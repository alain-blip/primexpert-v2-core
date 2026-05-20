import type { OffreConditionsInput } from './offreConditions';
import { serializeOffreForFirestore } from './offreConditions';
import type { OffreClotureInput } from './offreCloture';
import {
  firstNumber,
  firstString,
  readNested,
  toNumber,
} from './transactionParseUtils';

/**
 * SSOT — Tronc de l'offre (Axe 1 PA) : prix et structure de paiement.
 *
 * Clés canoniques Firestore (objet racine `offre`) :
 * - offre.prixOffert
 * - offre.acompteMontant
 * - offre.balanceVenteMontant
 * - offre.acheteurId / offre.acheteurNom
 */

export const OFFRE_TRONC_KEYS = {
  prixOffert: 'prixOffert',
  acompteMontant: 'acompteMontant',
  balanceVenteMontant: 'balanceVenteMontant',
  acheteurId: 'acheteurId',
  acheteurNom: 'acheteurNom',
} as const;

export type OffreTroncFieldKey = keyof typeof OFFRE_TRONC_KEYS;

export interface OffreTroncInput {
  prixOffert?: number;
  acompteMontant?: number;
  balanceVenteMontant?: number;
  acheteurId?: string;
  acheteurNom?: string;
}

/** Chemins Firestore canoniques (documentation / migrations). */
export const OFFRE_FIRESTORE_PATHS = {
  prixOffert: 'offre.prixOffert',
  acompteMontant: 'offre.acompteMontant',
  balanceVenteMontant: 'offre.balanceVenteMontant',
  acheteurId: 'offre.acheteurId',
  acheteurNom: 'offre.acheteurNom',
} as const;

/**
 * Solde à financer = prix offert − acompte − balance de prix de vente.
 * Retourne `undefined` si le prix offert est absent.
 */
export function computeSoldeAFinancer(input: OffreTroncInput): number | undefined {
  if (input.prixOffert == null || !Number.isFinite(input.prixOffert)) {
    return undefined;
  }
  const acompte = input.acompteMontant ?? 0;
  const balance = input.balanceVenteMontant ?? 0;
  return input.prixOffert - acompte - balance;
}

/**
 * Lit le tronc d'offre depuis le document résidence, avec repli sur les
 * alias historiques (montantOffre, purchasePrice, depotInitial, etc.).
 */
export function parseOffreTroncFromDoc(
  doc: Record<string, unknown> | null | undefined
): OffreTroncInput {
  if (!doc) return {};

  const offre =
    doc.offre && typeof doc.offre === 'object'
      ? (doc.offre as Record<string, unknown>)
      : {};

  const promesse =
    doc.promesseAchat && typeof doc.promesseAchat === 'object'
      ? (doc.promesseAchat as Record<string, unknown>)
      : {};

  const acheteur =
    offre.acheteur && typeof offre.acheteur === 'object'
      ? (offre.acheteur as Record<string, unknown>)
      : promesse.buyer && typeof promesse.buyer === 'object'
        ? (promesse.buyer as Record<string, unknown>)
        : promesse.acheteur && typeof promesse.acheteur === 'object'
          ? (promesse.acheteur as Record<string, unknown>)
          : {};

  return {
    prixOffert: firstNumber([
      offre.prixOffert,
      readNested(doc, ['offre', 'prixOffert']),
      doc.montantOffre,
      doc.purchasePrice,
      promesse.prixOffert,
      promesse.prixOffre,
      promesse.montantOffre,
    ]),
    acompteMontant: firstNumber([
      offre.acompteMontant,
      offre.depotInitial,
      offre.deposit,
      doc.depotInitial,
      doc.deposit,
      promesse.acompteMontant,
      promesse.depotInitial,
    ]),
    balanceVenteMontant: firstNumber([
      offre.balanceVenteMontant,
      offre.bdvAmount,
      offre.balanceDeVente,
      doc.bdvAmount,
      doc.balanceDeVente,
      promesse.balanceVenteMontant,
      promesse.bdvAmount,
    ]),
    acheteurId: firstString([
      offre.acheteurId,
      acheteur.contactId,
      acheteur.id,
      doc.acheteurId,
    ]),
    acheteurNom: firstString([
      offre.acheteurNom,
      acheteur.fullName,
      acheteur.nom,
      typeof promesse.acheteur === 'string' ? promesse.acheteur : undefined,
      doc.acheteurNom,
    ]),
  };
}

/** Patch Firestore canonique — fusionne tronc + conditions (évite l'écrasement). */
export function serializeOffreTroncForFirestore(
  input: OffreTroncInput,
  conditions: OffreConditionsInput = {},
  cloture: OffreClotureInput = {}
): Record<string, unknown> {
  return serializeOffreForFirestore(input, conditions, cloture);
}

/** Fusionne un champ du tronc d'offre dans l'état courant. */
export function patchOffreTroncField<K extends OffreTroncFieldKey>(
  current: OffreTroncInput,
  key: K,
  value: OffreTroncInput[K]
): OffreTroncInput {
  return { ...current, [key]: value };
}

export { toNumber };
