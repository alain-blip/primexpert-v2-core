/**
 * Verrous de certification — questions critiques (exigences Alain).
 *
 * Les clés parent (subSection) regroupent les sous-champs du formulaire officiel.
 * Les sections d'audit « D4 » et « D8 » désignent les thèmes réglementaires ;
 * les parentKeys pointent vers les numéros de questions dans le mapping RPA.
 */

export interface DeclarationCriticalLock {
  /** Section affichée dans les messages d'audit (D4, D8). */
  auditSectionId: 'D4' | 'D8';
  /** Clé parente (ex. D2.4, D5.2) — voir parentQuestions.resolveParentQuestionKey. */
  parentKey: string;
  /** Section réelle du champ dans questionnaire.ts (peut différer de auditSectionId). */
  sourceSectionId: string;
  labelFr: string;
  labelEn: string;
}

/**
 * D4 — Zonage / PIIA + facteurs environnementaux (2 questions parentes).
 * D8 — Fondations + fissures / infiltrations structurelles (2 questions parentes).
 */
export const DECLARATION_CERTIFICATION_CRITICAL_LOCKS: DeclarationCriticalLock[] = [
  {
    auditSectionId: 'D4',
    sourceSectionId: 'D2',
    parentKey: 'D2.4',
    labelFr: 'Zonage / PIIA (limitations, zone inondable)',
    labelEn: 'Zoning / PIIA (limitations, flood zone)',
  },
  {
    auditSectionId: 'D4',
    sourceSectionId: 'D24',
    parentKey: 'D24.2',
    labelFr: 'Facteurs environnementaux (études Phase I / II)',
    labelEn: 'Environmental factors (Phase I / II studies)',
  },
  {
    auditSectionId: 'D8',
    sourceSectionId: 'D5',
    parentKey: 'D5.1',
    labelFr: 'Fondations (type et conformité)',
    labelEn: 'Foundations (type and compliance)',
  },
  {
    auditSectionId: 'D8',
    sourceSectionId: 'D5',
    parentKey: 'D5.2',
    labelFr: 'Fissures / infiltrations (sous-sol, vide sanitaire)',
    labelEn: 'Cracks / infiltration (basement, crawl space)',
  },
];

export const DECLARATION_CRITICAL_LOCK_MESSAGE_FR =
  'Questions critiques en D4 et D8 requises pour la certification';

export const DECLARATION_CRITICAL_LOCK_MESSAGE_EN =
  'Critical D4 and D8 questions required for certification';
