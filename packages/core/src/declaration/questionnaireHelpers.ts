/**
 * Helpers questionnaire déclaration vendeur.
 */

import {
  DECLARATION_YESNO_FIELD_TYPES,
  type DeclarationFieldType,
} from './types';

export function declarationQuestionNeedsValue(fieldType: DeclarationFieldType): boolean {
  return !DECLARATION_YESNO_FIELD_TYPES.has(fieldType);
}

export function declarationQuestionInputType(
  fieldType: DeclarationFieldType
): 'text' | 'number' | 'date' | 'textarea' {
  switch (fieldType) {
    case 'textarea':
      return 'textarea';
    case 'number':
    case 'year':
    case 'percent':
    case 'currency':
      return 'number';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}
