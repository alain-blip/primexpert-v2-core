/**
 * Normalise declarationVendeur depuis le document résidence.
 */

import { ALL_DECLARATION_QUESTION_IDS } from './questionnaire';
import type { DeclarationAnswer, DeclarationVendeurDoc, DeclarationVendeurStatus } from './types';

function isValidResponse(v: unknown): v is DeclarationAnswer['response'] {
  return v === 'yes' || v === 'no' || v === 'na';
}

export function normalizeDeclarationVendeur(
  doc: Record<string, unknown> | null | undefined
): DeclarationVendeurDoc {
  const raw = doc?.declarationVendeur;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { status: 'draft', answers: {} };
  }

  const r = raw as Record<string, unknown>;
  const status: DeclarationVendeurStatus =
    r.status === 'lock' || r.status === 'finalized' || r.status === 'uploaded'
      ? (r.status as DeclarationVendeurStatus)
      : 'draft';
  const answers: Record<string, DeclarationAnswer> = {};

  const rawAnswers = r.answers;
  if (rawAnswers && typeof rawAnswers === 'object' && !Array.isArray(rawAnswers)) {
    for (const [qid, entry] of Object.entries(rawAnswers as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const row = entry as Record<string, unknown>;
      const response = isValidResponse(row.response) ? row.response : null;
      const notes = typeof row.notes === 'string' ? row.notes : undefined;
      const value =
        row.value !== undefined && row.value !== null ? String(row.value) : undefined;
      answers[qid] = { response, notes, value };
    }
  }

  return {
    status,
    submittedForReviewAt:
      typeof r.submittedForReviewAt === 'string' ? r.submittedForReviewAt : undefined,
    submittedBy: typeof r.submittedBy === 'string' ? r.submittedBy : undefined,
    certifiedAt: typeof r.certifiedAt === 'string' ? r.certifiedAt : undefined,
    certifiedBy: typeof r.certifiedBy === 'string' ? r.certifiedBy : undefined,
    confirmationTag:
      typeof r.confirmationTag === 'string' ? r.confirmationTag : undefined,
    fileUrl: typeof r.fileUrl === 'string' && r.fileUrl.trim() ? r.fileUrl.trim() : undefined,
    answers,
  };
}

export function isDeclarationAnswerComplete(answer: DeclarationAnswer | undefined): boolean {
  return answer?.response === 'yes' || answer?.response === 'no' || answer?.response === 'na';
}

export function countAnsweredQuestions(answers: Record<string, DeclarationAnswer>): number {
  return ALL_DECLARATION_QUESTION_IDS.filter((id) =>
    isDeclarationAnswerComplete(answers[id])
  ).length;
}
