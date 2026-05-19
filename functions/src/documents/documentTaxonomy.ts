/**
 * Nomenclature documentaire — miroir serveur (aligné sur src/lib/propertyDocumentTaxonomy.ts).
 */

export type StorageCategory = 'financier' | 'legal' | 'technique';

export interface TaxonomyEntry {
  id: string;
  labelFr: string;
  storageCategory: StorageCategory;
  extractionKind?: 'certificat_localisation' | 'etats_financiers' | 'rapport_evaluation';
}

export const CONTACT_DOCUMENT_TYPES = [
  'Entente de confidentialité',
  'Preuve de fonds',
  'Lettre bancaire',
  'Vérification identité CANAFE',
] as const;

export const TAXONOMY_ENTRIES: TaxonomyEntry[] = [
  { id: 'declaration_vendeur', labelFr: 'Déclaration du vendeur (DV)', storageCategory: 'legal' },
  {
    id: 'declaration_vendeur_modifications',
    labelFr: 'Modifications successives à la déclaration du vendeur',
    storageCategory: 'legal',
  },
  {
    id: 'bilans_etats_financiers',
    labelFr: 'Bilans et états financiers (3 dernières années)',
    storageCategory: 'financier',
    extractionKind: 'etats_financiers',
  },
  {
    id: 'rapport_interimaire',
    labelFr: "Rapport intérimaire de l'année en cours",
    storageCategory: 'financier',
    extractionKind: 'etats_financiers',
  },
  {
    id: 'rapport_evaluation_agree',
    labelFr: "Rapport d'évaluation de l'évaluateur agréé",
    storageCategory: 'financier',
    extractionKind: 'rapport_evaluation',
  },
  { id: 'liste_chambres_loyers_services', labelFr: 'Liste des chambres, prix du loyer et des services', storageCategory: 'financier' },
  { id: 'releves_ciuss', labelFr: 'Relevés CIUSS', storageCategory: 'financier' },
  {
    id: 'structure_salariale',
    labelFr: 'Structure salariale détaillée (noms, postes, rémunération)',
    storageCategory: 'financier',
  },
  { id: 'lettre_classification_cnesst', labelFr: 'Lettre de classification CNESST', storageCategory: 'financier' },
  {
    id: 'fonction_salaire_proprietaire',
    labelFr: 'Fonction précise et salaire annuel du propriétaire',
    storageCategory: 'financier',
  },
  {
    id: 'convention_collective_contrat_travail',
    labelFr: 'Convention collective ou contrat de travail',
    storageCategory: 'financier',
  },
  { id: 'taxes_municipales_scolaires', labelFr: 'Compte de taxes municipales et scolaires', storageCategory: 'financier' },
  {
    id: 'factures_energie',
    labelFr: "Factures d'énergie (électricité, gaz, huile — 12 mois)",
    storageCategory: 'financier',
  },
  {
    id: 'factures_communication',
    labelFr: 'Factures de communication (Internet, câble, cellulaire)',
    storageCategory: 'financier',
  },
  { id: 'contrat_factures_assurance', labelFr: "Contrat et factures d'assurance", storageCategory: 'financier' },
  { id: 'factures_systeme_securite', labelFr: 'Factures du système de sécurité', storageCategory: 'financier' },
  {
    id: 'factures_hydro_propane',
    labelFr: 'Factures Hydro-Québec, propane et combustibles',
    storageCategory: 'financier',
  },
  {
    id: 'factures_services_exterieurs',
    labelFr: 'Factures de déneigement, gazon et entretien extérieur',
    storageCategory: 'financier',
  },
  {
    id: 'factures_copieur_equipements',
    labelFr: 'Factures de copieur et équipements de bureau',
    storageCategory: 'financier',
  },
  {
    id: 'descriptions_taches',
    labelFr: 'Descriptions de tâches et responsabilités du personnel',
    storageCategory: 'financier',
  },
  { id: 'registres_rpa', labelFr: 'Registres de résidence pour aînés (RPA)', storageCategory: 'financier' },
  { id: 'liste_inclusions_exclusions', labelFr: 'Liste des inclusions et exclusions', storageCategory: 'financier' },
  {
    id: 'certificat_localisation',
    labelFr: 'Certificat de localisation récent (< 10 ans)',
    storageCategory: 'financier',
    extractionKind: 'certificat_localisation',
  },
  { id: 'rapport_inspection_batiment', labelFr: "Rapport d'inspection en bâtiment", storageCategory: 'financier' },
  {
    id: 'factures_entretien_renovation',
    labelFr: "Factures d'entretien ou de rénovations majeures",
    storageCategory: 'financier',
  },
  { id: 'contrats_location_equipements', labelFr: "Contrats de location d'équipements", storageCategory: 'financier' },
  {
    id: 'rapports_contrats_equipements_critiques',
    labelFr:
      "Rapports d'inspection et contrats d'entretien (ascenseur, génératrice, gicleurs, alarme incendie)",
    storageCategory: 'financier',
  },
  {
    id: 'lettres_conformite_equipements',
    labelFr: 'Lettres de conformité (ascenseurs, gicleurs, incendie)',
    storageCategory: 'financier',
  },
  {
    id: 'lettres_conformite_permis_residence',
    labelFr: 'Lettres de conformité de la résidence et permis (CIUSS, MAPAQ, RBQ)',
    storageCategory: 'financier',
  },
  {
    id: 'rapport_environnement_phase',
    labelFr: "Rapport d'étude ou évaluation environnementale (Phase I/II)",
    storageCategory: 'financier',
  },
  { id: 'plan_etages', labelFr: 'Plan des étages', storageCategory: 'financier' },
  { id: 'contrat_courtage_exclusif', labelFr: 'Contrat de courtage exclusif', storageCategory: 'legal' },
  {
    id: 'annexes_oaciq',
    labelFr: 'Annexes officielles de l’OACIQ (Annexe G, Annexe R, etc.)',
    storageCategory: 'legal',
  },
  {
    id: 'modification_contrat_courtage',
    labelFr: 'Modifications au contrat de courtage (prix ou prolongation)',
    storageCategory: 'legal',
  },
  {
    id: 'procuration_conseil_administration',
    labelFr: 'Procuration du conseil d’administration (résolution corporative)',
    storageCategory: 'technique',
  },
  {
    id: 'certificat_immatriculation_req',
    labelFr: "Certificat d'immatriculation de l'entreprise (REQ)",
    storageCategory: 'technique',
  },
  { id: 'acte_vente_achat_actions', labelFr: "Acte de vente ou d'achat des actions", storageCategory: 'technique' },
  {
    id: 'acte_hypotheque_quittance',
    labelFr: 'Acte hypothécaire bancaire, hypothèque légale ou acte de quittance (radiation)',
    storageCategory: 'technique',
  },
  { id: 'acte_servitudes', labelFr: 'Acte de servitudes', storageCategory: 'technique' },
  { id: 'releve_soldes_hypothecaires', labelFr: 'Relevé des soldes hypothécaires actuels', storageCategory: 'technique' },
  { id: 'promesse_achat_signee', labelFr: "Promesse d'achat signée", storageCategory: 'financier' },
  { id: 'contre_proposition', labelFr: 'Contre-proposition (CP)', storageCategory: 'financier' },
  {
    id: 'annexe_realisation_conditions',
    labelFr: 'Annexe de réalisation de conditions (inspection, financement)',
    storageCategory: 'financier',
  },
  {
    id: 'preuve_fonds_prequalification',
    labelFr: 'Preuve de disponibilité des fonds / lettre de pré-qualification bancaire',
    storageCategory: 'financier',
  },
];

const BY_ID = new Map(TAXONOMY_ENTRIES.map((e) => [e.id, e]));
const BY_LABEL = new Map(
  TAXONOMY_ENTRIES.map((e) => [
    e.labelFr
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' '),
    e,
  ])
);

function normalizeLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

export function taxonomyLabelsForGeminiPrompt(): string {
  return TAXONOMY_ENTRIES.map((e) => `- "${e.labelFr}"`).join('\n');
}

export function resolveTaxonomyEntry(idOrLabel?: string): TaxonomyEntry | undefined {
  if (!idOrLabel?.trim()) return undefined;
  const raw = idOrLabel.trim();
  return BY_ID.get(raw) ?? BY_LABEL.get(normalizeLabel(raw));
}

export function inferStorageCategory(documentType?: string): StorageCategory {
  const entry = resolveTaxonomyEntry(documentType);
  if (entry) return entry.storageCategory;
  return 'financier';
}

export function resolveExtractionKind(documentType?: string): TaxonomyEntry['extractionKind'] {
  const entry = resolveTaxonomyEntry(documentType);
  if (entry?.extractionKind) return entry.extractionKind;
  const n = normalizeLabel(documentType ?? '');
  if (n.includes('certificat de localisation') || n.includes('localisation')) {
    return 'certificat_localisation';
  }
  if (n.includes('rapport d') && n.includes('valuation')) return 'rapport_evaluation';
  if (n.includes('etat') || n.includes('bilan') || n.includes('financier')) return 'etats_financiers';
  return undefined;
}
