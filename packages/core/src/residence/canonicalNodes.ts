/**
 * Nœuds canoniques résidence (SSOT Firestore).
 * Enrichissement V2 : Bilan exécutif 360 (juridique, bâtiment, opérations).
 */

export interface ResidenceLegalNode {
  raisonSociale?: string;
  neq?: string;
  actionnaires?: string;
}

export interface ResidenceBuildingInstallationsNode {
  ascenseur?: number;
  climatisation?: boolean;
  mitigeurs?: boolean;
  generatrice?: boolean;
}

export interface ResidenceBuildingNode {
  anneeConstruction?: number;
  etages?: number;
  nombreUnites?: number;
  structure?: string;
  superficieTotale?: number;
  installations?: ResidenceBuildingInstallationsNode;
}

export interface ResidenceOperationsNode {
  effectifs?: {
    jour?: number;
    soir?: number;
    nuit?: number;
  };
}
