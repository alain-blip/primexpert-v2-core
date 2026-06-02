/**
 * Matrice documentaire transactionnelle Primexpert (OACIQ) — SSOT nomenclature.
 * Catégories Firestore : financier | legal | technique (+ promesseScope pour PA).
 */

import type { PropertyDocumentCategory, PropertyDocumentExtractedData } from '../types/propertyDocument';

/** Onglets transactionnels (UI) — mappés aux catégories de stockage. */
export type TransactionDocumentTab = 'acheteurs' | 'contrats' | 'actes' | 'promesses';

export type AcheteursSubsection =
  | 'dv'
  | 'finances_evaluations'
  | 'baux_services'
  | 'rh_salarial'
  | 'frais_exploitation'
  | 'batiment_technique'
  | 'equipements_securite'
  | 'permis_environnement';

export interface TaxonomyDocumentTypeDef {
  /** Identifiant stable (code). */
  id: string;
  /** Libellé exact français québécois (Gemini + UI). */
  labelFr: string;
  labelEn: string;
  tab: TransactionDocumentTab;
  subsection?: AcheteursSubsection;
  /** Catégorie Firestore après reclassement IA. */
  storageCategory: PropertyDocumentCategory;
}

export interface TransactionTabDef {
  id: TransactionDocumentTab;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
  storageCategory?: PropertyDocumentCategory;
  promesseOnly?: boolean;
}

export const TRANSACTION_DOCUMENT_TABS: TransactionTabDef[] = [
  {
    id: 'acheteurs',
    labelFr: 'Documents pour acheteurs',
    labelEn: 'Documents for buyers',
    descriptionFr: 'Coffre-fort de qualification et d’exploitation (acheteur, banquier, évaluateur).',
    descriptionEn: 'Qualification and operations package (buyer, lender, appraiser).',
    storageCategory: 'financier',
  },
  {
    id: 'contrats',
    labelFr: 'Contrat et annexes',
    labelEn: 'Listing contract & schedules',
    descriptionFr: 'Alignement agence–vendeur (courtage exclusif, annexes OACIQ).',
    descriptionEn: 'Agency–seller alignment (exclusive brokerage, OACIQ schedules).',
    storageCategory: 'legal',
  },
  {
    id: 'actes',
    labelFr: 'Actes et autres documents',
    labelEn: 'Deeds & other documents',
    descriptionFr: 'Structure légale et foncière de la transaction.',
    descriptionEn: 'Legal and land structure of the transaction.',
    storageCategory: 'technique',
  },
  {
    id: 'promesses',
    labelFr: 'Promesses d’achat (PA)',
    labelEn: 'Purchase promises (PA)',
    descriptionFr: 'Centrale de négociation multi-dossiers acheteurs.',
    descriptionEn: 'Multi-buyer negotiation hub.',
    promesseOnly: true,
  },
];

/** Nomenclature complète — libellés FR exacts pour Gemini. */
export const TAXONOMY_DOCUMENT_TYPES: TaxonomyDocumentTypeDef[] = [
  {
    id: 'declaration_vendeur',
    labelFr: 'Déclaration du vendeur (DV)',
    labelEn: 'Seller’s declaration (DV)',
    tab: 'contrats',
    subsection: 'dv',
    storageCategory: 'legal',
  },
  {
    id: 'declaration_vendeur_modifications',
    labelFr: 'Modifications successives à la déclaration du vendeur',
    labelEn: 'Subsequent amendments to the seller’s declaration',
    tab: 'contrats',
    subsection: 'dv',
    storageCategory: 'legal',
  },
  {
    id: 'bilans_etats_financiers',
    labelFr: 'Bilans et états financiers (3 dernières années)',
    labelEn: 'Financial statements (last 3 years)',
    tab: 'acheteurs',
    subsection: 'finances_evaluations',
    storageCategory: 'financier',
  },
  {
    id: 'rapport_interimaire',
    labelFr: "Rapport intérimaire de l'année en cours",
    labelEn: 'Interim report for the current year',
    tab: 'acheteurs',
    subsection: 'finances_evaluations',
    storageCategory: 'financier',
  },
  {
    id: 'rapport_evaluation_agree',
    labelFr: "Rapport d'évaluation de l'évaluateur agréé",
    labelEn: 'Appraisal report by certified appraiser',
    tab: 'acheteurs',
    subsection: 'finances_evaluations',
    storageCategory: 'financier',
  },
  {
    id: 'liste_chambres_loyers_services',
    labelFr: 'Liste des chambres, prix du loyer et des services',
    labelEn: 'Room list, rent and service fees',
    tab: 'acheteurs',
    subsection: 'baux_services',
    storageCategory: 'financier',
  },
  {
    id: 'releves_ciuss',
    labelFr: 'Relevés CIUSS',
    labelEn: 'CIUSS statements',
    tab: 'acheteurs',
    subsection: 'baux_services',
    storageCategory: 'financier',
  },
  {
    id: 'structure_salariale',
    labelFr: 'Structure salariale détaillée (noms, postes, rémunération)',
    labelEn: 'Detailed payroll structure (names, roles, compensation)',
    tab: 'acheteurs',
    subsection: 'rh_salarial',
    storageCategory: 'financier',
  },
  {
    id: 'lettre_classification_cnesst',
    labelFr: 'Lettre de classification CNESST',
    labelEn: 'CNESST classification letter',
    tab: 'acheteurs',
    subsection: 'rh_salarial',
    storageCategory: 'financier',
  },
  {
    id: 'fonction_salaire_proprietaire',
    labelFr: 'Fonction précise et salaire annuel du propriétaire',
    labelEn: 'Owner role and annual salary',
    tab: 'acheteurs',
    subsection: 'rh_salarial',
    storageCategory: 'financier',
  },
  {
    id: 'convention_collective_contrat_travail',
    labelFr: 'Convention collective ou contrat de travail',
    labelEn: 'Collective agreement or employment contract',
    tab: 'acheteurs',
    subsection: 'rh_salarial',
    storageCategory: 'financier',
  },
  {
    id: 'taxes_municipales_scolaires',
    labelFr: 'Compte de taxes municipales et scolaires',
    labelEn: 'Municipal and school tax account',
    tab: 'acheteurs',
    subsection: 'frais_exploitation',
    storageCategory: 'financier',
  },
  {
    id: 'factures_energie',
    labelFr: "Factures d'énergie (électricité, gaz, huile — 12 mois)",
    labelEn: 'Energy bills (electricity, gas, oil — 12 months)',
    tab: 'acheteurs',
    subsection: 'frais_exploitation',
    storageCategory: 'financier',
  },
  {
    id: 'factures_communication',
    labelFr: 'Factures de communication (Internet, câble, cellulaire)',
    labelEn: 'Telecom bills (Internet, cable, mobile)',
    tab: 'acheteurs',
    subsection: 'frais_exploitation',
    storageCategory: 'financier',
  },
  {
    id: 'contrat_factures_assurance',
    labelFr: "Contrat et factures d'assurance",
    labelEn: 'Insurance contract and invoices',
    tab: 'acheteurs',
    subsection: 'frais_exploitation',
    storageCategory: 'financier',
  },
  {
    id: 'factures_systeme_securite',
    labelFr: 'Factures du système de sécurité',
    labelEn: 'Security system invoices',
    tab: 'acheteurs',
    subsection: 'frais_exploitation',
    storageCategory: 'financier',
  },
  {
    id: 'factures_hydro_propane',
    labelFr: 'Factures Hydro-Québec, propane et combustibles',
    labelEn: 'Hydro-Quebec, propane and fuel invoices',
    tab: 'acheteurs',
    subsection: 'frais_exploitation',
    storageCategory: 'financier',
  },
  {
    id: 'factures_services_exterieurs',
    labelFr: 'Factures de déneigement, gazon et entretien extérieur',
    labelEn: 'Snow removal, lawn care and exterior maintenance invoices',
    tab: 'acheteurs',
    subsection: 'frais_exploitation',
    storageCategory: 'financier',
  },
  {
    id: 'factures_copieur_equipements',
    labelFr: 'Factures de copieur et équipements de bureau',
    labelEn: 'Copier and office equipment invoices',
    tab: 'acheteurs',
    subsection: 'frais_exploitation',
    storageCategory: 'financier',
  },
  {
    id: 'descriptions_taches',
    labelFr: 'Descriptions de tâches et responsabilités du personnel',
    labelEn: 'Job descriptions and staff responsibilities',
    tab: 'acheteurs',
    subsection: 'rh_salarial',
    storageCategory: 'financier',
  },
  {
    id: 'registres_rpa',
    labelFr: 'Registres de résidence pour aînés (RPA)',
    labelEn: 'Senior residence registers',
    tab: 'acheteurs',
    subsection: 'baux_services',
    storageCategory: 'financier',
  },
  {
    id: 'liste_inclusions_exclusions',
    labelFr: 'Liste des inclusions et exclusions',
    labelEn: 'Inclusions and exclusions list',
    tab: 'acheteurs',
    subsection: 'baux_services',
    storageCategory: 'financier',
  },
  {
    id: 'certificat_localisation',
    labelFr: 'Certificat de localisation récent (< 10 ans)',
    labelEn: 'Recent certificate of location (< 10 years)',
    tab: 'acheteurs',
    subsection: 'batiment_technique',
    storageCategory: 'financier',
  },
  {
    id: 'rapport_inspection_batiment',
    labelFr: "Rapport d'inspection en bâtiment",
    labelEn: 'Building inspection report',
    tab: 'acheteurs',
    subsection: 'batiment_technique',
    storageCategory: 'financier',
  },
  {
    id: 'factures_entretien_renovation',
    labelFr: "Factures d'entretien ou de rénovations majeures",
    labelEn: 'Maintenance or major renovation invoices',
    tab: 'acheteurs',
    subsection: 'batiment_technique',
    storageCategory: 'financier',
  },
  {
    id: 'contrats_location_equipements',
    labelFr: "Contrats de location d'équipements",
    labelEn: 'Equipment lease contracts',
    tab: 'acheteurs',
    subsection: 'batiment_technique',
    storageCategory: 'financier',
  },
  {
    id: 'rapports_contrats_equipements_critiques',
    labelFr:
      "Rapports d'inspection et contrats d'entretien (ascenseur, génératrice, gicleurs, alarme incendie)",
    labelEn: 'Inspection reports and maintenance contracts (elevator, generator, sprinklers, fire alarm)',
    tab: 'acheteurs',
    subsection: 'equipements_securite',
    storageCategory: 'financier',
  },
  {
    id: 'lettres_conformite_equipements',
    labelFr: 'Lettres de conformité (ascenseurs, gicleurs, incendie)',
    labelEn: 'Compliance letters (elevators, sprinklers, fire)',
    tab: 'acheteurs',
    subsection: 'equipements_securite',
    storageCategory: 'financier',
  },
  {
    id: 'lettres_conformite_permis_residence',
    labelFr: 'Lettres de conformité de la résidence et permis (CIUSS, MAPAQ, RBQ)',
    labelEn: 'Residence compliance letters and permits (CIUSS, MAPAQ, RBQ)',
    tab: 'acheteurs',
    subsection: 'permis_environnement',
    storageCategory: 'financier',
  },
  {
    id: 'rapport_environnement_phase',
    labelFr: "Rapport d'étude ou évaluation environnementale (Phase I/II)",
    labelEn: 'Environmental study or assessment (Phase I/II)',
    tab: 'acheteurs',
    subsection: 'permis_environnement',
    storageCategory: 'financier',
  },
  {
    id: 'plan_etages',
    labelFr: 'Plan des étages',
    labelEn: 'Floor plans',
    tab: 'acheteurs',
    subsection: 'permis_environnement',
    storageCategory: 'financier',
  },
  {
    id: 'contrat_courtage_exclusif',
    labelFr: 'Contrat de courtage exclusif',
    labelEn: 'Exclusive brokerage contract',
    tab: 'contrats',
    storageCategory: 'legal',
  },
  {
    id: 'annexes_oaciq',
    labelFr: 'Annexes officielles de l’OACIQ (Annexe G, Annexe R, etc.)',
    labelEn: 'Official OACIQ schedules (Schedule G, R, etc.)',
    tab: 'contrats',
    storageCategory: 'legal',
  },
  {
    id: 'modification_contrat_courtage',
    labelFr: 'Modifications au contrat de courtage (prix ou prolongation)',
    labelEn: 'Brokerage contract amendments (price or extension)',
    tab: 'contrats',
    storageCategory: 'legal',
  },
  {
    id: 'procuration_conseil_administration',
    labelFr: 'Procuration du conseil d’administration (résolution corporative)',
    labelEn: 'Board resolution / corporate authorization',
    tab: 'actes',
    storageCategory: 'technique',
  },
  {
    id: 'certificat_immatriculation_req',
    labelFr: "Certificat d'immatriculation de l'entreprise (REQ)",
    labelEn: 'Business registration certificate (REQ)',
    tab: 'actes',
    storageCategory: 'technique',
  },
  {
    id: 'acte_vente_achat_actions',
    labelFr: "Acte de vente ou d'achat des actions",
    labelEn: 'Share purchase or sale deed',
    tab: 'actes',
    storageCategory: 'technique',
  },
  {
    id: 'acte_hypotheque_quittance',
    labelFr: 'Acte hypothécaire bancaire, hypothèque légale ou acte de quittance (radiation)',
    labelEn: 'Mortgage deed, legal hypothec or discharge',
    tab: 'actes',
    storageCategory: 'technique',
  },
  {
    id: 'acte_servitudes',
    labelFr: 'Acte de servitudes',
    labelEn: 'Servitude deed',
    tab: 'actes',
    storageCategory: 'technique',
  },
  {
    id: 'releve_soldes_hypothecaires',
    labelFr: 'Relevé des soldes hypothécaires actuels',
    labelEn: 'Current mortgage balance statement',
    tab: 'actes',
    storageCategory: 'technique',
  },
  {
    id: 'promesse_achat_signee',
    labelFr: "Promesse d'achat signée",
    labelEn: 'Signed purchase promise',
    tab: 'promesses',
    storageCategory: 'financier',
  },
  {
    id: 'contre_proposition',
    labelFr: 'Contre-proposition (CP)',
    labelEn: 'Counter-proposal',
    tab: 'promesses',
    storageCategory: 'financier',
  },
  {
    id: 'annexe_realisation_conditions',
    labelFr: 'Annexe de réalisation de conditions (inspection, financement)',
    labelEn: 'Condition fulfillment schedule (inspection, financing)',
    tab: 'promesses',
    storageCategory: 'financier',
  },
  {
    id: 'preuve_fonds_prequalification',
    labelFr: 'Preuve de disponibilité des fonds / lettre de pré-qualification bancaire',
    labelEn: 'Proof of funds / bank pre-qualification letter',
    tab: 'promesses',
    storageCategory: 'financier',
  },
];

export const ACHEUTEURS_SUBSECTIONS: Array<{
  id: AcheteursSubsection;
  labelFr: string;
  labelEn: string;
}> = [
  { id: 'dv', labelFr: 'Déclaration du vendeur', labelEn: 'Seller’s declaration' },
  { id: 'finances_evaluations', labelFr: 'Finances et évaluations', labelEn: 'Finance & appraisals' },
  { id: 'baux_services', labelFr: 'Baux et services (RPA)', labelEn: 'Leases & services' },
  { id: 'rh_salarial', labelFr: 'Structure RH et salariale', labelEn: 'HR & payroll' },
  { id: 'frais_exploitation', labelFr: "Frais d'exploitation (factures)", labelEn: 'Operating expenses' },
  { id: 'batiment_technique', labelFr: 'Bâtiment, technique et entretien', labelEn: 'Building & maintenance' },
  { id: 'equipements_securite', labelFr: 'Équipements et sécurité', labelEn: 'Equipment & safety' },
  { id: 'permis_environnement', labelFr: 'Permis, environnement et plans', labelEn: 'Permits, environment & plans' },
];

const BY_ID = new Map(TAXONOMY_DOCUMENT_TYPES.map((t) => [t.id, t]));
const BY_LABEL_FR = new Map(TAXONOMY_DOCUMENT_TYPES.map((t) => [normalizeLabel(t.labelFr), t]));

function normalizeLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

/** Libellés FR exacts pour le prompt Gemini (liste fermée). */
export function taxonomyLabelsForGeminiPrompt(): string {
  return TAXONOMY_DOCUMENT_TYPES.map((t) => `- "${t.labelFr}"`).join('\n');
}

export function resolveTaxonomyType(idOrLabel?: string | null): TaxonomyDocumentTypeDef | undefined {
  if (!idOrLabel?.trim()) return undefined;
  const raw = idOrLabel.trim();
  const byId = BY_ID.get(raw);
  if (byId) return byId;
  return BY_LABEL_FR.get(normalizeLabel(raw));
}

export function inferStorageCategoryFromExtractedData(
  data: PropertyDocumentExtractedData
): PropertyDocumentCategory {
  const t = resolveTaxonomyType(data.documentType as string | undefined);
  if (t) return t.storageCategory;
  if (data.metadataCL || data.irregularites?.length) return 'financier';
  if (data.comparables?.length || data.sujet) return 'financier';
  if ((data.amounts?.length ?? 0) > 0) return 'financier';
  return 'financier';
}

export function inferDocumentCategoryForRecord(doc: {
  category: PropertyDocumentCategory;
  fileName: string;
  promesseScope?: boolean;
  extractedData?: PropertyDocumentExtractedData;
}): PropertyDocumentCategory {
  if (doc.promesseScope) return doc.category;

  // Comparables ACM (Centris PDF) : catégorie hermétique — jamais reclassée.
  if (doc.category === 'acm_comparables') return 'acm_comparables';

  const extractedType = resolveTaxonomyType(doc.extractedData?.documentType as string | undefined);
  if (extractedType) return extractedType.storageCategory;

  const n = normalizeLabel(doc.fileName);

  if (/declaration.*vendeur|qa.*declaration.*vendeur|dv/.test(n)) return 'legal';

  if (
    /(^|[^a-z])cl([^a-z]|$)|certificat.*localisation|localisation/.test(n) ||
    /facture|hydro|propane|cable|ascenseur|alarme|deneigement|gazon|copieur/.test(n) ||
    /cnesst|description.*tache|tache|remuneration|salaire|proprietaire/.test(n) ||
    /assurance|taxe|taxes|scolaire|municipal|municipale/.test(n) ||
    /registre|rpa|inclusion|exclusion|ciuss|ciusss|loyer|chambre/.test(n)
  ) {
    return 'financier';
  }

  if (/procuration|resolution|immatriculation|req|acte|servitude|hypothe|quittance/.test(n)) {
    return 'technique';
  }

  return doc.category;
}

export function resolveTransactionTab(
  category: PropertyDocumentCategory,
  promesseScope?: boolean
): TransactionDocumentTab {
  if (promesseScope) return 'promesses';
  if (category === 'legal') return 'contrats';
  if (category === 'technique') return 'actes';
  return 'acheteurs';
}

export function tabToUploadCategory(tab: TransactionDocumentTab): PropertyDocumentCategory {
  const def = TRANSACTION_DOCUMENT_TABS.find((t) => t.id === tab);
  return def?.storageCategory ?? 'financier';
}

export function isPromesseTab(tab: TransactionDocumentTab): boolean {
  return tab === 'promesses';
}

export function filterDocsForTab(
  docs: Array<{ category: PropertyDocumentCategory; promesseScope?: boolean }>,
  tab: TransactionDocumentTab
): typeof docs {
  if (tab === 'promesses') {
    return docs.filter((d) => d.promesseScope === true);
  }
  const cat =
    TRANSACTION_DOCUMENT_TABS.find((t) => t.id === tab)?.storageCategory ?? 'financier';
  return docs.filter((d) => !d.promesseScope && d.category === cat);
}

export function resolveAcheteursSubsection(
  data: PropertyDocumentExtractedData | undefined,
  fileName: string
): AcheteursSubsection | 'autre' {
  const t = resolveTaxonomyType(data?.documentType as string | undefined);
  if (t?.subsection) return t.subsection;
  const n = fileName.toLowerCase();
  if (/dv|déclaration|declaration|vendeur/.test(n)) return 'dv';
  if (/bilan|état|etat|financier|évaluation|evaluation|interim|intérimaire/.test(n)) {
    return 'finances_evaluations';
  }
  if (/bail|loyer|chambre|ciuss|ciusss/.test(n)) return 'baux_services';
  if (/cnesst|salaire|rh|convention|travail/.test(n)) return 'rh_salarial';
  if (/taxe|énergie|energie|assurance|sécurité|securite|communication/.test(n)) {
    return 'frais_exploitation';
  }
  if (/localisation|inspection|entretien|rénovation|renovation|équipement|equipement/.test(n)) {
    return 'batiment_technique';
  }
  if (/ascenseur|gicleur|incendie|conformité|conformite|génératrice|generatrice/.test(n)) {
    return 'equipements_securite';
  }
  if (/phase|environnement|mapaq|rbq|plan/.test(n)) return 'permis_environnement';
  return 'autre';
}

export type DocumentShareRecipient = 'acheteur' | 'notaire' | 'banquier';

export const CONTACT_DOCUMENT_TYPES = [
  'Entente de confidentialité',
  'Preuve de fonds',
  'Lettre bancaire',
  'Vérification identité CANAFE',
] as const;

export const BROKER_TOOL_FOLDERS = [
  'Modèles',
  'Grilles',
  'Présentations',
  'Formulaires',
] as const;

export interface DocumentShareDraft {
  documentIds: string[];
  recipients: DocumentShareRecipient[];
  preparedAtMillis: number;
}
