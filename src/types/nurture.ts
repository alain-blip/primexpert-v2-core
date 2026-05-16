/** Options du sondage J7 (première semaine d'essai). */
export type J7SurveyOption = 'A' | 'B' | 'C';

export interface J7SurveyResponse {
  option: J7SurveyOption;
  /** Commentaire libre (surtout pour B / C). */
  comment?: string;
  /** ISO 8601 */
  submittedAt: string;
}

export const J7_OPTION_LABELS = {
  A: {
    fr: 'Tout va bien — je maîtrise le Radar',
    en: 'All good — I am comfortable with the Radar',
  },
  B: {
    fr: "Besoin d'aide pour les filtres / la prospection",
    en: 'Need help with filters / prospecting',
  },
  C: {
    fr: 'Problème technique ou blocage',
    en: 'Technical issue or blocker',
  },
} as const;
