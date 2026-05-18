/**
 * Patches Firestore pour declarationVendeur.
 */

import { generateDeclarationConfirmationTag } from './confirmationTag';
import { normalizeDeclarationVendeur } from './normalizeDeclaration';
import { isDeclarationReadOnlyStatus } from './types';
import type { DeclarationAnswer, DeclarationResponse } from './types';

export function buildDeclarationAnswerPatch(
  doc: Record<string, unknown>,
  questionId: string,
  partial: {
    response?: DeclarationResponse | null;
    notes?: string;
    value?: string;
  }
): Record<string, unknown> {
  const current = normalizeDeclarationVendeur(doc);
  if (isDeclarationReadOnlyStatus(current.status)) {
    throw new Error(
      current.status === 'uploaded' ? 'DECLARATION_UPLOADED' : 'DECLARATION_LOCKED'
    );
  }

  const prev = current.answers[questionId] ?? { response: null };
  const next: DeclarationAnswer = {
    response: partial.response !== undefined ? partial.response : prev.response,
    notes: partial.notes !== undefined ? partial.notes : prev.notes,
    value: partial.value !== undefined ? partial.value : prev.value,
  };

  return {
    declarationVendeur: {
      ...current,
      status: 'draft',
      answers: {
        ...current.answers,
        [questionId]: next,
      },
    },
  };
}

export function buildDeclarationCertifyPatch(
  doc: Record<string, unknown>,
  userId: string,
  residenceId: string
): Record<string, unknown> {
  const current = normalizeDeclarationVendeur(doc);
  const confirmationTag =
    current.confirmationTag ?? generateDeclarationConfirmationTag(residenceId);
  return {
    declarationVendeur: {
      ...current,
      status: 'lock',
      certifiedAt: new Date().toISOString(),
      certifiedBy: userId,
      confirmationTag,
    },
  };
}
