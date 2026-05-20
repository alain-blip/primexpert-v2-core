/**
 * SSOT — Conditions suspensives & diligences RPA (Axe 2 PA).
 *
 * Clés canoniques Firestore (objet racine `offre`) :
 * - offre.dateLimiteFinancement
 * - offre.conditionPermisMsss
 * - offre.dateLimitePermisMsss
 * - offre.conditionAnnexe6
 * - offre.clauseAjustementNoi
 * - offre.tgaAjustement
 */

import { addCalendarDays } from './promesseAchatEngine';
import type { OffreClotureInput } from './offreCloture';
import type { OffreTroncInput } from './offreTronc';
import {
  firstIso,
  firstTernary,
  toIsoDateString,
  toNumber,
  toTernaryBool,
} from './transactionParseUtils';

export type TernaryBool = boolean | null;

export const OFFRE_CONDITIONS_KEYS = {
  dateLimiteFinancement: 'dateLimiteFinancement',
  conditionPermisMsss: 'conditionPermisMsss',
  dateLimitePermisMsss: 'dateLimitePermisMsss',
  conditionAnnexe6: 'conditionAnnexe6',
  clauseAjustementNoi: 'clauseAjustementNoi',
  tgaAjustement: 'tgaAjustement',
} as const;

export type OffreConditionsFieldKey = keyof typeof OFFRE_CONDITIONS_KEYS;

export interface OffreConditionsInput {
  dateLimiteFinancement?: string;
  conditionPermisMsss?: TernaryBool;
  dateLimitePermisMsss?: string;
  conditionAnnexe6?: TernaryBool;
  clauseAjustementNoi?: TernaryBool;
  tgaAjustement?: number;
}

/** Chemins Firestore canoniques (documentation / migrations). */
export const OFFRE_CONDITIONS_FIRESTORE_PATHS = {
  dateLimiteFinancement: 'offre.dateLimiteFinancement',
  conditionPermisMsss: 'offre.conditionPermisMsss',
  dateLimitePermisMsss: 'offre.dateLimitePermisMsss',
  conditionAnnexe6: 'offre.conditionAnnexe6',
  clauseAjustementNoi: 'offre.clauseAjustementNoi',
  tgaAjustement: 'offre.tgaAjustement',
} as const;

/** Tronc + conditions (documentation). */
export type OffreDocumentInput = OffreConditionsInput & {
  prixOffert?: number;
  acompteMontant?: number;
  balanceVenteMontant?: number;
  acheteurId?: string;
  acheteurNom?: string;
};

/**
 * Lit les conditions suspensives depuis le document résidence, avec repli
 * sur les délais en jours (`promesseAchat.delais`) et alias historiques.
 */
export function parseOffreConditionsFromDoc(
  doc: Record<string, unknown> | null | undefined
): OffreConditionsInput {
  if (!doc) return {};

  const offre =
    doc.offre && typeof doc.offre === 'object'
      ? (doc.offre as Record<string, unknown>)
      : {};

  const promesse =
    doc.promesseAchat && typeof doc.promesseAchat === 'object'
      ? (doc.promesseAchat as Record<string, unknown>)
      : {};

  const delais =
    promesse.delais && typeof promesse.delais === 'object'
      ? (promesse.delais as Record<string, unknown>)
      : promesse.delaisLimites && typeof promesse.delaisLimites === 'object'
        ? (promesse.delaisLimites as Record<string, unknown>)
        : {};

  const dateAcceptation = toIsoDateString(
    promesse.dateAcceptation ?? promesse.dateAcceptationOffre
  );
  const financementJours = toNumber(
    delais.financementJours ?? delais.financementHypothecaireJours
  );
  const permisJours = toNumber(delais.permisJours);

  const computedFinancement =
    dateAcceptation && financementJours != null
      ? addCalendarDays(dateAcceptation, financementJours)
      : undefined;
  const computedPermis =
    dateAcceptation && permisJours != null
      ? addCalendarDays(dateAcceptation, permisJours)
      : undefined;

  return {
    dateLimiteFinancement: firstIso([
      computedFinancement,
      offre.dateLimiteFinancement,
      doc.dateLimiteFinancement,
      doc.dateLimiteFinancementHypothecaire,
      promesse.dateLimiteFinancement,
    ]),
    conditionPermisMsss: firstTernary([
      offre.conditionPermisMsss,
      offre.conditionPermis,
      offre.permisMsss,
      offre.permisExploitationCiusss,
      doc.conditionPermisMsss,
      promesse.conditionPermisMsss,
    ]),
    dateLimitePermisMsss: firstIso([
      computedPermis,
      offre.dateLimitePermisMsss,
      offre.dateLimitePermis,
      doc.dateLimitePermisMsss,
      promesse.dateLimitePermisMsss,
    ]),
    conditionAnnexe6: firstTernary([
      offre.conditionAnnexe6,
      offre.annexe6,
      offre.conformiteAnnexe6,
      doc.conditionAnnexe6,
      promesse.conditionAnnexe6,
    ]),
    clauseAjustementNoi: firstTernary([
      offre.clauseAjustementNoi,
      offre.ajustementNoi,
      offre.clauseNoi,
      doc.clauseAjustementNoi,
      promesse.clauseAjustementNoi,
    ]),
    tgaAjustement: toNumber(
      offre.tgaAjustement ??
        offre.tga ??
        offre.capRateAjustement ??
        doc.tgaAjustement ??
        promesse.tgaAjustement
    ),
  };
}

function offreBlockFromInputs(
  tronc: OffreTroncInput,
  conditions: OffreConditionsInput,
  cloture: OffreClotureInput = {}
): Record<string, unknown> {
  return {
    prixOffert: tronc.prixOffert ?? null,
    acompteMontant: tronc.acompteMontant ?? null,
    balanceVenteMontant: tronc.balanceVenteMontant ?? null,
    acheteurId: tronc.acheteurId ?? null,
    acheteurNom: tronc.acheteurNom ?? null,
    dateLimiteFinancement: conditions.dateLimiteFinancement ?? null,
    conditionPermisMsss: conditions.conditionPermisMsss ?? null,
    dateLimitePermisMsss: conditions.dateLimitePermisMsss ?? null,
    conditionAnnexe6: conditions.conditionAnnexe6 ?? null,
    clauseAjustementNoi: conditions.clauseAjustementNoi ?? null,
    tgaAjustement: conditions.tgaAjustement ?? null,
    datePrisePossession: cloture.datePrisePossession ?? null,
    transfertFiducie: cloture.transfertFiducie ?? null,
    prorataSubventions: cloture.prorataSubventions ?? null,
  };
}

/**
 * Patch Firestore complet sous `offre` — fusionne tronc + conditions + clôture
 * pour éviter d'écraser un sous-ensemble lors d'un updateDoc.
 */
export function serializeOffreForFirestore(
  tronc: Pick<
    OffreDocumentInput,
    'prixOffert' | 'acompteMontant' | 'balanceVenteMontant' | 'acheteurId' | 'acheteurNom'
  >,
  conditions: OffreConditionsInput = {},
  cloture: OffreClotureInput = {}
): Record<string, unknown> {
  return { offre: offreBlockFromInputs(tronc, conditions, cloture) };
}

export function serializeOffreConditionsForFirestore(
  conditions: OffreConditionsInput,
  tronc: Pick<
    OffreDocumentInput,
    'prixOffert' | 'acompteMontant' | 'balanceVenteMontant' | 'acheteurId' | 'acheteurNom'
  > = {},
  cloture: OffreClotureInput = {}
): Record<string, unknown> {
  return serializeOffreForFirestore(tronc, conditions, cloture);
}

export function patchOffreConditionsField<K extends OffreConditionsFieldKey>(
  current: OffreConditionsInput,
  key: K,
  value: OffreConditionsInput[K]
): OffreConditionsInput {
  return { ...current, [key]: value };
}

export { toTernaryBool };
