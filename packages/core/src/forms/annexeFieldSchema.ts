/**
 * Schéma canonique — champs entre parenthèses des annexes OACIQ / courtage RPA.
 * Mappe les zones `(       $ )`, `(       % )`, `CCV-     ` vers des propriétés typées.
 */

/** Annexe de prix — modification de prix (parenthèses monétaires). */
export interface AnnexePrixFields {
  /** Valeur numérique pour le champ `(       $ )` */
  nouveauPrixNumerique?: number;
}

/** Annexe R — réduction de commission (parenthèses pourcentage). */
export interface AnnexeRFields {
  /** Valeur pour le champ `(       % )` */
  retributionPct?: number;
}

/** Annexe G — confidentialité des coordonnées (référence CCV). */
export interface AnnexeGFields {
  /** Valeur pour le champ `CCV-     ` */
  ccvReference?: string;
}

export type ContractAnnexeId =
  | 'contratCourtage'
  | 'annexePrix'
  | 'annexeG'
  | 'annexeR'
  | 'promesseActifs';

export interface ContractAnnexeSelection {
  contratCourtage: boolean;
  annexePrix: boolean;
  annexeG: boolean;
  annexeR: boolean;
  promesseActifs: boolean;
}

/** État UI — panneau d'assemblage (sans mot réglementaire banni). */
export interface ContractAssemblerFieldState {
  selection: ContractAnnexeSelection;
  annexePrix: AnnexePrixFields;
  annexeR: AnnexeRFields;
  annexeG: AnnexeGFields;
}

export const DEFAULT_CONTRACT_ANNEXE_SELECTION: ContractAnnexeSelection = {
  contratCourtage: true,
  annexePrix: false,
  annexeG: false,
  annexeR: false,
  promesseActifs: false,
};

export function createDefaultContractAssemblerState(
  partial?: Partial<ContractAssemblerFieldState>
): ContractAssemblerFieldState {
  return {
    selection: { ...DEFAULT_CONTRACT_ANNEXE_SELECTION, ...partial?.selection },
    annexePrix: { ...partial?.annexePrix },
    annexeR: { ...partial?.annexeR },
    annexeG: { ...partial?.annexeG },
  };
}

/** Métadonnées d'affichage — libellés UI Québec. */
export const CONTRACT_ANNEXE_CATALOG: {
  id: ContractAnnexeId;
  labelFr: string;
  labelEn: string;
  parenthesisHintFr?: string;
}[] = [
  {
    id: 'contratCourtage',
    labelFr: 'Contrat de courtage RPA',
    labelEn: 'RPA brokerage contract',
  },
  {
    id: 'annexePrix',
    labelFr: 'Annexe — modification de prix',
    labelEn: 'Schedule — price amendment',
    parenthesisHintFr: 'Champ entre parenthèses : montant ($)',
  },
  {
    id: 'annexeG',
    labelFr: 'Annexe G — confidentialité des coordonnées',
    labelEn: 'Schedule G — contact confidentiality',
    parenthesisHintFr: 'Référence CCV-…',
  },
  {
    id: 'annexeR',
    labelFr: 'Annexe R — réduction de commission',
    labelEn: 'Schedule R — commission reduction',
    parenthesisHintFr: 'Champ entre parenthèses : taux (%)',
  },
  {
    id: 'promesseActifs',
    labelFr: "Promesse d'achat d'actifs",
    labelEn: 'Asset purchase promise',
  },
];
