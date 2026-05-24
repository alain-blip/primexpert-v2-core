/**
 * Garde-fous glisser-déposer pipeline Kanban — aligné legacy Copilote.
 */

import { toPositiveNumber } from './normalizeNumbers';

export type PipelineTargetColumn = 'prospect' | 'mandate' | 'promise' | 'sold';

export type PipelineDragResidence = {
  prixAccepte?: unknown;
  purchaseOffer?: { prixAccepte?: unknown };
};

export interface PipelineDragValidation {
  allowed: boolean;
  messageFr?: string;
  messageEn?: string;
}

/** Prix accepté (promesse d'achat) — requis pour colonne « Promesse ». */
export function getAcceptedPurchasePrice(
  residence: PipelineDragResidence | null | undefined
): number | null {
  if (!residence) return null;
  return (
    toPositiveNumber(residence.prixAccepte) ??
    toPositiveNumber(residence.purchaseOffer?.prixAccepte) ??
    null
  );
}

/** Valide un déplacement vers une colonne cible. */
export function validatePipelineColumnMove(
  residence: PipelineDragResidence | null | undefined,
  targetColumn: PipelineTargetColumn
): PipelineDragValidation {
  if (targetColumn !== 'promise') {
    return { allowed: true };
  }

  if (getAcceptedPurchasePrice(residence) != null) {
    return { allowed: true };
  }

  return {
    allowed: false,
    messageFr:
      "Action requise : Veuillez inscrire le prix accepté avant de passer en promesse d'achat.",
    messageEn:
      'Action required: Please enter the accepted price before moving to promise to purchase.',
  };
}
