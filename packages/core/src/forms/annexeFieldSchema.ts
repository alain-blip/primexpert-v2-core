/**
 * Schéma canonique (SSOT) — types plats des documents transactionnels et de leurs
 * variables entre parenthèses ( ). Consommé par les gabarits du Core
 * (`templates/*`) et par le compilateur `renderContractAssemblerToHtml`.
 *
 * Nomenclature d'affaires : on parle de « revue de conformité du graphe contractuel ».
 */

import type { PaActifsRenderData } from './paActifsTypes';

/** Identifiant plat d'un document maître ou d'une annexe sélectionnable. */
export type ContractAnnexeId =
  | 'contratCourtage'
  | 'contratCourtageAchat'
  | 'promesseActifs'
  | 'annexeG'
  | 'annexeR'
  | 'annexeE'
  | 'annexePR'
  | 'annexeC'
  | 'annexePrix'
  | 'annexeMiseHorsMarche'
  | 'annexeRimouski';

/** Document maître (contrat / promesse) ou annexe complémentaire. */
export type ContractAnnexeCategory = 'master' | 'annexe';

/** Type d'une variable entre parenthèses ( ) — pilote la saisie réactive et le rendu. */
export type ParenthesisFieldKind = 'money' | 'percent' | 'days' | 'text' | 'ccv';

/** Définition d'une variable ( ) reliée à l'état local réactif. */
export interface ParenthesisFieldDef {
  /** Clé plate unique, ex. `annexePrix.nouveauPrix`. */
  key: string;
  labelFr: string;
  labelEn: string;
  kind: ParenthesisFieldKind;
  hintFr?: string;
}

/** Métadonnées d'un document indexé dans le panneau d'assemblage. */
export interface ContractDocumentDef {
  id: ContractAnnexeId;
  category: ContractAnnexeCategory;
  /** Code d'affaires court affiché (CCVE, CC-ACHAT, PA-ACTIFS, Annexe G…). */
  codeFr: string;
  labelFr: string;
  labelEn: string;
  fields: ParenthesisFieldDef[];
}

/** Valeurs plates des variables ( ) — clé = `ParenthesisFieldDef.key`. */
export type ParenthesisValueMap = Record<string, string | number | undefined>;

/** Sélection cochable du panneau (un drapeau par document). */
export type ContractAnnexeSelection = Record<ContractAnnexeId, boolean>;

/** État UI réactif — sélection + valeurs des variables entre parenthèses. */
export interface ContractAssemblerFieldState {
  selection: ContractAnnexeSelection;
  values: ParenthesisValueMap;
}

/** Contexte de rendu transmis aux gabarits (parties, courtier, résidence, valeurs ( )). */
export interface ContractRenderContext {
  locale: 'fr' | 'en';
  values: ParenthesisValueMap;
  paData: PaActifsRenderData;
  residenceLabel?: string;
}

/**
 * Catalogue d'affaires complet — documents maîtres + familles d'annexes
 * (confidentialité G, rétribution R, exclusion E, préemption PR, coordination C,
 * et modifications MO : prix, mise hors marché, modèle Rimouski).
 */
export const CONTRACT_DOCUMENT_CATALOG: ContractDocumentDef[] = [
  {
    id: 'contratCourtage',
    category: 'master',
    codeFr: 'CCVE',
    labelFr: "Contrat de courtage exclusif — vente (résidence pour aînés (RPA))",
    labelEn: 'Exclusive brokerage contract — sale (seniors’ residence)',
    fields: [
      {
        key: 'contratCourtage.tauxRetributionPct',
        kind: 'percent',
        labelFr: 'Taux de rétribution ( % )',
        labelEn: 'Remuneration rate ( % )',
      },
      {
        key: 'contratCourtage.dureeJours',
        kind: 'days',
        labelFr: 'Durée du contrat ( jours )',
        labelEn: 'Contract term ( days )',
      },
    ],
  },
  {
    id: 'contratCourtageAchat',
    category: 'master',
    codeFr: 'CC-ACHAT',
    labelFr: "Contrat de courtage exclusif — recherche d’achat commercial",
    labelEn: 'Exclusive brokerage contract — commercial purchase search',
    fields: [
      {
        key: 'contratCourtageAchat.tauxRetributionPct',
        kind: 'percent',
        labelFr: 'Taux de rétribution ( % )',
        labelEn: 'Remuneration rate ( % )',
      },
      {
        key: 'contratCourtageAchat.dureeJours',
        kind: 'days',
        labelFr: 'Durée du mandat ( jours )',
        labelEn: 'Mandate term ( days )',
      },
    ],
  },
  {
    id: 'promesseActifs',
    category: 'master',
    codeFr: 'PA-ACTIFS',
    labelFr: "Promesse d’achat d’actifs",
    labelEn: 'Asset purchase promise',
    fields: [],
  },
  {
    id: 'annexeG',
    category: 'annexe',
    codeFr: 'Annexe G',
    labelFr: 'Annexe G — confidentialité des coordonnées',
    labelEn: 'Schedule G — contact confidentiality',
    fields: [
      {
        key: 'annexeG.ccvReference',
        kind: 'ccv',
        labelFr: 'Référence ( CCV- )',
        labelEn: 'Reference ( CCV- )',
      },
    ],
  },
  {
    id: 'annexeR',
    category: 'annexe',
    codeFr: 'Annexe R',
    labelFr: 'Annexe R — réduction de rétribution',
    labelEn: 'Schedule R — remuneration reduction',
    fields: [
      {
        key: 'annexeR.retributionPct',
        kind: 'percent',
        labelFr: 'Rétribution réduite ( % )',
        labelEn: 'Reduced remuneration ( % )',
      },
    ],
  },
  {
    id: 'annexeE',
    category: 'annexe',
    codeFr: 'Annexe E',
    labelFr: 'Annexe E — exclusion d’acheteur',
    labelEn: 'Schedule E — buyer exclusion',
    fields: [
      {
        key: 'annexeE.acheteurExclu',
        kind: 'text',
        labelFr: 'Acheteur exclu',
        labelEn: 'Excluded buyer',
      },
      {
        key: 'annexeE.delaiExclusiviteJours',
        kind: 'days',
        labelFr: 'Délai d’exclusivité ( jours )',
        labelEn: 'Exclusivity period ( days )',
      },
    ],
  },
  {
    id: 'annexePR',
    category: 'annexe',
    codeFr: 'Annexe PR',
    labelFr: 'Annexe PR — droit de préemption',
    labelEn: 'Schedule PR — right of pre-emption',
    fields: [
      {
        key: 'annexePR.delaiPreemptionJours',
        kind: 'days',
        labelFr: 'Délai d’exercice ( jours )',
        labelEn: 'Exercise period ( days )',
      },
    ],
  },
  {
    id: 'annexeC',
    category: 'annexe',
    codeFr: 'Annexe C',
    labelFr: 'Annexe C — coordination des intervenants professionnels',
    labelEn: 'Schedule C — professional stakeholder coordination',
    fields: [
      {
        key: 'annexeC.intervenantPivot',
        kind: 'text',
        labelFr: 'Intervenant pivot',
        labelEn: 'Lead stakeholder',
      },
    ],
  },
  {
    id: 'annexePrix',
    category: 'annexe',
    codeFr: 'Annexe MO — prix',
    labelFr: 'Annexe (modification) — prix de vente',
    labelEn: 'Schedule (amendment) — sale price',
    fields: [
      {
        key: 'annexePrix.nouveauPrix',
        kind: 'money',
        labelFr: 'Nouveau prix ( $ )',
        labelEn: 'New price ( $ )',
      },
    ],
  },
  {
    id: 'annexeMiseHorsMarche',
    category: 'annexe',
    codeFr: 'Annexe MO — mise hors marché',
    labelFr: 'Annexe (modification) — mise hors marché',
    labelEn: 'Schedule (amendment) — market withdrawal',
    fields: [
      {
        key: 'annexeMiseHorsMarche.dateRetrait',
        kind: 'text',
        labelFr: 'Date de retrait',
        labelEn: 'Withdrawal date',
      },
    ],
  },
  {
    id: 'annexeRimouski',
    category: 'annexe',
    codeFr: 'Annexe MO — modèle Rimouski',
    labelFr: 'Annexe (modification) — avenant modèle Rimouski',
    labelEn: 'Schedule (amendment) — Rimouski model addendum',
    fields: [
      {
        key: 'annexeRimouski.particularite',
        kind: 'text',
        labelFr: 'Particularité régionale',
        labelEn: 'Regional specificity',
      },
    ],
  },
];

/** Sélection par défaut — le contrat de courtage exclusif est proposé activé. */
export const DEFAULT_CONTRACT_ANNEXE_SELECTION: ContractAnnexeSelection = {
  contratCourtage: true,
  contratCourtageAchat: false,
  promesseActifs: false,
  annexeG: false,
  annexeR: false,
  annexeE: false,
  annexePR: false,
  annexeC: false,
  annexePrix: false,
  annexeMiseHorsMarche: false,
  annexeRimouski: false,
};

export function createDefaultContractAssemblerState(
  partial?: Partial<ContractAssemblerFieldState>
): ContractAssemblerFieldState {
  return {
    selection: { ...DEFAULT_CONTRACT_ANNEXE_SELECTION, ...partial?.selection },
    values: { ...partial?.values },
  };
}
