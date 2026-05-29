/**
 * Déclaration du vendeur — Gold Signature (Phase 5).
 */

export type DeclarationResponse = 'yes' | 'no' | 'na';

/** Types de champs Copilote (dvRpaMapping.js). */
export type DeclarationFieldType =
  | 'yesno'
  | 'yesno_nsp'
  | 'text'
  | 'textarea'
  | 'number'
  | 'year'
  | 'date'
  | 'currency'
  | 'percent'
  | 'checkbox_group';

export const DECLARATION_YESNO_FIELD_TYPES: ReadonlySet<DeclarationFieldType> = new Set([
  'yesno',
  'yesno_nsp',
]);

/** `lock` = V2 ; `finalized` = alias Copilote ; `uploaded` = PDF signé téléversé. */
export type DeclarationVendeurStatus = 'draft' | 'lock' | 'finalized' | 'uploaded';

export function isDeclarationLockedStatus(status: DeclarationVendeurStatus): boolean {
  return status === 'lock' || status === 'finalized';
}

export function isDeclarationUploadedStatus(status: DeclarationVendeurStatus): boolean {
  return status === 'uploaded';
}

export function isDeclarationReadOnlyStatus(status: DeclarationVendeurStatus): boolean {
  return isDeclarationLockedStatus(status) || isDeclarationUploadedStatus(status);
}

export interface DeclarationAnswer {
  response: DeclarationResponse | null;
  /** Valeur saisie (texte, nombre, date…) pour les champs non booléens. */
  value?: string;
  notes?: string;
}

/** Statut courtier — alerte synthèse 360° après soumission vendeur portail. */
export type DeclarationReviewStatus = 'A_REVISER';

export interface DeclarationVendeurDoc {
  status: DeclarationVendeurStatus;
  /** Soumission portail vendeur pour révision courtier. */
  submittedForReviewAt?: string;
  submittedBy?: string;
  certifiedAt?: string;
  certifiedBy?: string;
  /** Code de sécurité unique (scellé à la certification). */
  confirmationTag?: string;
  /** URL du PDF signé téléversé hors application. */
  fileUrl?: string;
  answers: Record<string, DeclarationAnswer>;
}

export interface DeclarationQuestionDef {
  id: string;
  firestorePath: string;
  labelFr: string;
  labelEn: string;
  fieldType: DeclarationFieldType;
  optional?: boolean;
  subSection?: string;
}

export interface DeclarationSectionDef {
  id: string;
  titleFr: string;
  titleEn: string;
  category: 'standard' | 'rpa';
  sectionOptional?: boolean;
  questions: DeclarationQuestionDef[];
}

export interface DeclarationSectionSummary {
  sectionId: string;
  questionCount: number;
}

export interface DeclarationProgressView {
  /** Nombre total de questions parentes (regroupées par subSection). */
  totalQuestions: number;
  answeredCount: number;
  completionPct: number;
  isComplete: boolean;
  /** Verrous D4 / D8 (questions critiques Alain). */
  criticalLocksMet: boolean;
  criticalLockMessageFr: string | null;
  criticalLockMessageEn: string | null;
  sectionSummaries: DeclarationSectionSummary[];
  isLocked: boolean;
  /** PDF signé fourni hors formulaire (status uploaded). */
  isUploaded: boolean;
  certifiedAtLabel: string | null;
  confirmationTag: string | null;
  certifiedBy: string | null;
}
