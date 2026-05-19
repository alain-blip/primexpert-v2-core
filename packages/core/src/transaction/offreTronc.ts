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

function toNumber(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n =
    typeof raw === 'number'
      ? raw
      : Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function toString(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s.length > 0 ? s : undefined;
}

function readNested(doc: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = doc;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function firstNumber(sources: unknown[]): number | undefined {
  for (const raw of sources) {
    const n = toNumber(raw);
    if (n != null) return n;
  }
  return undefined;
}

function firstString(sources: unknown[]): string | undefined {
  for (const raw of sources) {
    const s = toString(raw);
    if (s) return s;
  }
  return undefined;
}

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

/** Patch Firestore canonique — écrit uniquement sous `offre`. */
export function serializeOffreTroncForFirestore(
  input: OffreTroncInput
): Record<string, unknown> {
  return {
    offre: {
      prixOffert: input.prixOffert ?? null,
      acompteMontant: input.acompteMontant ?? null,
      balanceVenteMontant: input.balanceVenteMontant ?? null,
      acheteurId: input.acheteurId ?? null,
      acheteurNom: input.acheteurNom ?? null,
    },
  };
}

/** Fusionne un champ du tronc d'offre dans l'état courant. */
export function patchOffreTroncField<K extends OffreTroncFieldKey>(
  current: OffreTroncInput,
  key: K,
  value: OffreTroncInput[K]
): OffreTroncInput {
  return { ...current, [key]: value };
}
