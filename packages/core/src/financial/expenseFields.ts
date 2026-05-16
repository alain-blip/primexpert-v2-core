/**
 * Grille des postes de dépenses — SSOT (port Copilote expenseFields.js).
 */
import type { ExpenseKey } from './expenseKeys';

export interface ExpenseFieldDef {
  key: ExpenseKey | string;
  label: string;
  labelEn: string;
  isPrimary?: boolean;
}

/** Postes visibles en priorité dans la grille CPA (lecture seule V2). */
export const EXPENSE_FIELDS: ExpenseFieldDef[] = [
  { key: 'mainDOeuvreDirecte', label: "Main-d'œuvre directe et charges sociales", labelEn: 'Direct labour & payroll', isPrimary: true },
  { key: 'salairesAvantages', label: 'Salaires et charges sociales', labelEn: 'Salaries & benefits', isPrimary: true },
  { key: 'telecommunications', label: 'Câblodistribution et téléphonie', labelEn: 'Cable & telecom', isPrimary: true },
  { key: 'energie', label: 'Énergie', labelEn: 'Energy', isPrimary: true },
  { key: 'assurances', label: 'Assurances', labelEn: 'Insurance', isPrimary: true },
  { key: 'taxesPermis', label: 'Taxes et permis', labelEn: 'Taxes & permits', isPrimary: true },
  { key: 'nourritures', label: 'Achats de nourriture', labelEn: 'Food purchases', isPrimary: true },
  { key: 'fournituresBureau', label: 'Frais de bureau', labelEn: 'Office expenses', isPrimary: true },
  { key: 'fraisDeplacements', label: 'Déplacements', labelEn: 'Travel', isPrimary: true },
  { key: 'honorairesProfessionnels', label: 'Honoraires', labelEn: 'Professional fees', isPrimary: true },
  { key: 'fraisRepresentation', label: 'Représentation', labelEn: 'Representation', isPrimary: true },
  { key: 'taxesMunicipalesScolaire', label: 'Taxes municipale & scolaire', labelEn: 'Municipal & school taxes' },
  { key: 'entretienReparation', label: 'Entretien / Réparation', labelEn: 'Maintenance / repairs' },
  { key: 'fraisGestion', label: 'Frais de gestion', labelEn: 'Management fees' },
  { key: 'publicite', label: 'Publicité', labelEn: 'Advertising' },
  { key: 'divers', label: 'Divers', labelEn: 'Miscellaneous' },
];

/**
 * % du RBE — références sectorielles RPA (repli tant que benchmark portefeuille V2 n'est pas branché).
 * Valeurs en points de pourcentage (ex. 42 = 42 % du RBE).
 */
export const MARKET_REF_PCT_OF_RBE: Partial<Record<string, number>> = {
  salairesAvantages: 42,
  mainDOeuvreDirecte: 38,
  energie: 7.5,
  assurances: 3.2,
  taxesPermis: 4.5,
  nourritures: 12,
  telecommunications: 1.8,
  entretienReparation: 5.5,
  honorairesProfessionnels: 2.5,
  fraisGestion: 4,
};
