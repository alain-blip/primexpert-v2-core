/**
 * Questions parentes (D1.1, D4.2…) — regroupe les sous-champs physiques du mapping.
 */

import { DECLARATION_SECTIONS } from './questionnaire';
import { declarationQuestionNeedsValue } from './questionnaireHelpers';
import { isDeclarationAnswerComplete } from './normalizeDeclaration';
import type {
  DeclarationAnswer,
  DeclarationQuestionDef,
  DeclarationSectionDef,
  DeclarationSectionSummary,
} from './types';

export interface DeclarationParentQuestion {
  sectionId: string;
  parentKey: string;
  fieldIds: string[];
  /** Champ principal (yesno / obligatoire) pour la complétion parent. */
  primaryFieldIds: string[];
}

export function resolveParentQuestionKey(
  sectionId: string,
  question: DeclarationQuestionDef
): string {
  return question.subSection ?? `${sectionId}::__${question.id}`;
}

function buildParentIndexForSection(
  section: DeclarationSectionDef
): DeclarationParentQuestion[] {
  const groups = new Map<string, DeclarationQuestionDef[]>();

  for (const q of section.questions) {
    const key = resolveParentQuestionKey(section.id, q);
    const list = groups.get(key) ?? [];
    list.push(q);
    groups.set(key, list);
  }

  return [...groups.entries()].map(([parentKey, fields]) => {
    const primaryFieldIds = fields
      .filter((f) => !f.optional)
      .filter(
        (f) =>
          f.fieldType === 'yesno' ||
          f.fieldType === 'yesno_nsp' ||
          !declarationQuestionNeedsValue(f.fieldType)
      )
      .map((f) => f.id);

    const fallbackPrimary =
      primaryFieldIds.length > 0
        ? primaryFieldIds
        : fields.filter((f) => !f.optional).map((f) => f.id);

    return {
      sectionId: section.id,
      parentKey,
      fieldIds: fields.map((f) => f.id),
      primaryFieldIds:
        fallbackPrimary.length > 0 ? fallbackPrimary : [fields[0]!.id],
    };
  });
}

export const DECLARATION_PARENT_QUESTIONS: DeclarationParentQuestion[] =
  DECLARATION_SECTIONS.flatMap(buildParentIndexForSection);

export const DECLARATION_SECTION_SUMMARIES: DeclarationSectionSummary[] =
  DECLARATION_SECTIONS.map((section) => ({
    sectionId: section.id,
    questionCount: buildParentIndexForSection(section).length,
  }));

export const ALL_DECLARATION_PARENT_KEYS: string[] = DECLARATION_PARENT_QUESTIONS.map(
  (p) => `${p.sectionId}::${p.parentKey}`
);

export function findParentQuestion(
  sectionId: string,
  parentKey: string
): DeclarationParentQuestion | undefined {
  return DECLARATION_PARENT_QUESTIONS.find(
    (p) => p.sectionId === sectionId && p.parentKey === parentKey
  );
}

export function isDeclarationFieldComplete(
  question: DeclarationQuestionDef,
  answer: DeclarationAnswer | undefined
): boolean {
  if (!isDeclarationAnswerComplete(answer)) return false;
  if (question.optional) return true;
  if (
    question.fieldType === 'yesno' ||
    question.fieldType === 'yesno_nsp' ||
    question.fieldType === 'checkbox_group'
  ) {
    return true;
  }
  if (declarationQuestionNeedsValue(question.fieldType)) {
    return Boolean(answer?.value?.trim());
  }
  return true;
}

export function isDeclarationParentQuestionComplete(
  parent: DeclarationParentQuestion,
  answers: Record<string, DeclarationAnswer>,
  sectionQuestions: DeclarationQuestionDef[]
): boolean {
  const byId = new Map(sectionQuestions.map((q) => [q.id, q]));

  return parent.primaryFieldIds.every((fieldId) => {
    const q = byId.get(fieldId);
    if (!q) return false;
    return isDeclarationFieldComplete(q, answers[fieldId]);
  });
}

export function countAnsweredParentQuestions(
  answers: Record<string, DeclarationAnswer>
): number {
  let n = 0;
  for (const section of DECLARATION_SECTIONS) {
    const parents = buildParentIndexForSection(section);
    for (const parent of parents) {
      if (
        isDeclarationParentQuestionComplete(parent, answers, section.questions)
      ) {
        n += 1;
      }
    }
  }
  return n;
}

export const DECLARATION_TOTAL_PARENT_QUESTIONS = DECLARATION_PARENT_QUESTIONS.length;
