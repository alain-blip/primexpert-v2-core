/**
 * Progression du questionnaire déclaration vendeur (questions parentes).
 */

import {
  DECLARATION_CERTIFICATION_CRITICAL_LOCKS,
  DECLARATION_CRITICAL_LOCK_MESSAGE_EN,
  DECLARATION_CRITICAL_LOCK_MESSAGE_FR,
} from './criticalLocks';
import {
  countAnsweredParentQuestions,
  DECLARATION_SECTION_SUMMARIES,
  DECLARATION_TOTAL_PARENT_QUESTIONS,
  findParentQuestion,
  isDeclarationParentQuestionComplete,
} from './parentQuestions';
import { DECLARATION_SECTIONS, DECLARATION_REQUIRED_QUESTION_IDS } from './questionnaire';
import { isDeclarationAnswerComplete, normalizeDeclarationVendeur } from './normalizeDeclaration';
import { isDeclarationLockedStatus, isDeclarationUploadedStatus } from './types';
import type { DeclarationProgressView, DeclarationVendeurDoc } from './types';

function formatCertifiedLabel(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function evaluateCriticalLocks(declaration: DeclarationVendeurDoc): boolean {
  return DECLARATION_CERTIFICATION_CRITICAL_LOCKS.every((lock) => {
    const section = DECLARATION_SECTIONS.find((s) => s.id === lock.sourceSectionId);
    if (!section) return false;

    const parent = findParentQuestion(lock.sourceSectionId, lock.parentKey);
    if (!parent) return false;

    return isDeclarationParentQuestionComplete(
      parent,
      declaration.answers,
      section.questions
    );
  });
}

export function computeDeclarationProgress(
  doc: Record<string, unknown> | null | undefined
): DeclarationProgressView {
  const declaration = normalizeDeclarationVendeur(doc);
  return computeDeclarationProgressFromDoc(declaration);
}

export function computeDeclarationProgressFromDoc(
  declaration: DeclarationVendeurDoc
): DeclarationProgressView {
  const totalQuestions = DECLARATION_TOTAL_PARENT_QUESTIONS;
  const answeredCount = countAnsweredParentQuestions(declaration.answers);
  const completionPct =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const requiredFieldsComplete = DECLARATION_REQUIRED_QUESTION_IDS.every((id) =>
    isDeclarationAnswerComplete(declaration.answers[id])
  );

  const criticalLocksMet = evaluateCriticalLocks(declaration);
  const isComplete = requiredFieldsComplete && criticalLocksMet;
  const isLocked = isDeclarationLockedStatus(declaration.status);
  const isUploaded = isDeclarationUploadedStatus(declaration.status);

  return {
    totalQuestions,
    answeredCount,
    completionPct,
    isComplete,
    criticalLocksMet,
    criticalLockMessageFr: criticalLocksMet
      ? null
      : DECLARATION_CRITICAL_LOCK_MESSAGE_FR,
    criticalLockMessageEn: criticalLocksMet
      ? null
      : DECLARATION_CRITICAL_LOCK_MESSAGE_EN,
    sectionSummaries: DECLARATION_SECTION_SUMMARIES,
    isLocked,
    isUploaded,
    certifiedAtLabel: formatCertifiedLabel(declaration.certifiedAt),
    confirmationTag: declaration.confirmationTag ?? null,
    certifiedBy: declaration.certifiedBy ?? null,
  };
}
