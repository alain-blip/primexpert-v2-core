/**
 * Mapping des alias de champs vers les noms canoniques
 *
 * Mission 3 — Champs canoniques & Alias Mapper
 *
 * Ce fichier définit la correspondance entre les noms de champs
 * utilisés historiquement et les noms canoniques.
 *
 * RÈGLE: Le nom canonique est toujours le premier, les alias suivent
 * dans l'ordre de priorité de lecture.
 */

import type { CanonicalFieldDefinition, FieldCategory } from './types';

// ============================================================================
// DÉFINITIONS DES CHAMPS CANONIQUES
// ============================================================================

/**
 * Champs d'identité de la résidence
 */
export const IDENTITY_FIELDS: CanonicalFieldDefinition[] = [
  {
    canonical: 'name',
    aliases: ['nomResidence', 'nom', 'residenceName'],
    category: 'identity',
    type: 'string',
    description: 'Nom commercial de la résidence',
    required: true,
  },
  {
    canonical: 'residenceType',
    aliases: ['type'],
    category: 'identity',
    type: 'string',
    description: 'Type de résidence (RPA, RI, etc.)',
  },
  {
    canonical: 'categorieRPA',
    aliases: ['category', 'categorie'],
    category: 'identity',
    type: 'string',
    description: 'Catégorie de la RPA',
  },
  {
    canonical: 'dateOuverture',
    aliases: ['openingDate', 'dateOpening'],
    category: 'identity',
    type: 'date',
    description: 'Date d\'ouverture de la résidence',
  },
  {
    canonical: 'datePrisePossession',
    aliases: ['possessionDate', 'datePossession'],
    category: 'identity',
    type: 'date',
    description: 'Date de prise de possession',
  },
];

/**
 * Champs de localisation
 */
export const LOCATION_FIELDS: CanonicalFieldDefinition[] = [
  {
    canonical: 'address',
    aliases: ['adresse', 'adresseComplete', 'fullAddress'],
    category: 'location',
    type: 'string',
    description: 'Adresse complète de la résidence',
    required: true,
  },
  {
    canonical: 'municipalite',
    aliases: ['ville', 'city', 'municipality'],
    category: 'location',
    type: 'string',
    description: 'Municipalité',
  },
  {
    canonical: 'codePostal',
    aliases: ['postalCode', 'zip'],
    category: 'location',
    type: 'string',
    description: 'Code postal',
  },
  {
    canonical: 'regionSociosanitaire',
    aliases: ['region', 'regions'],
    category: 'location',
    type: 'string',
    description: 'Région sociosanitaire',
  },
  {
    canonical: 'telephone',
    aliases: ['phone', 'tel'],
    category: 'location',
    type: 'string',
    description: 'Numéro de téléphone',
  },
  {
    canonical: 'courriel',
    aliases: ['email', 'mail'],
    category: 'location',
    type: 'string',
    description: 'Adresse courriel',
  },
  {
    canonical: 'siteWeb',
    aliases: ['websiteUrl', 'siteInternetResidence', 'website'],
    category: 'location',
    type: 'string',
    description: 'Site web de la résidence',
  },
];

/**
 * Champs de structure juridique
 */
export const LEGAL_FIELDS: CanonicalFieldDefinition[] = [
  {
    canonical: 'raisonSociale',
    aliases: ['nomCompagnie', 'companyName', 'legalName'],
    category: 'legal',
    type: 'string',
    description: 'Raison sociale de l\'entreprise',
  },
  {
    canonical: 'formeJuridique',
    aliases: ['legalForm', 'corporateForm'],
    category: 'legal',
    type: 'string',
    description: 'Forme juridique (inc., OSBL, etc.)',
  },
  {
    canonical: 'neq',
    aliases: ['numeroEntreprise', 'enterpriseNumber'],
    category: 'legal',
    type: 'string',
    description: 'Numéro d\'entreprise du Québec',
  },
];

/**
 * Champs de capacité et unités
 */
export const CAPACITY_FIELDS: CanonicalFieldDefinition[] = [
  {
    canonical: 'nombreUnitesTotal',
    aliases: ['unitsCount', 'nombreUnites', 'nombreUnitesRPA', 'totalUnits'],
    category: 'capacity',
    type: 'number',
    description: 'Nombre total d\'unités',
    required: true,
  },
  {
    canonical: 'nombreChambresSimples',
    aliases: ['singleRooms', 'chambresSimples'],
    category: 'capacity',
    type: 'number',
    description: 'Nombre de chambres simples',
    defaultValue: 0,
  },
  {
    canonical: 'nombreChambresDoubles',
    aliases: ['doubleRooms', 'chambresDoubles'],
    category: 'capacity',
    type: 'number',
    description: 'Nombre de chambres doubles',
    defaultValue: 0,
  },
  {
    canonical: 'nombreStudios',
    aliases: ['studios', 'studioUnits'],
    category: 'capacity',
    type: 'number',
    description: 'Nombre de studios',
    defaultValue: 0,
  },
  {
    canonical: 'nombre2demie',
    aliases: ['apt2half', 'appartements2demi'],
    category: 'capacity',
    type: 'number',
    description: 'Nombre d\'appartements 2½',
    defaultValue: 0,
  },
  {
    canonical: 'nombre3demie',
    aliases: ['apt3half', 'appartements3demi'],
    category: 'capacity',
    type: 'number',
    description: 'Nombre d\'appartements 3½',
    defaultValue: 0,
  },
  {
    canonical: 'nombre4demie',
    aliases: ['apt4half', 'appartements4demi'],
    category: 'capacity',
    type: 'number',
    description: 'Nombre d\'appartements 4½',
    defaultValue: 0,
  },
  {
    canonical: 'tauxOccupation',
    aliases: ['occupancyRate', 'occupation'],
    category: 'capacity',
    type: 'number',
    description: 'Taux d\'occupation (%)',
  },
];

/**
 * Champs bâtiment / immobilier
 */
export const BUILDING_FIELDS: CanonicalFieldDefinition[] = [
  {
    canonical: 'anneeConstruction',
    aliases: ['yearBuilt', 'constructionYear', 'anneeConstructionApprox'],
    category: 'building',
    type: 'number',
    description: 'Année de construction',
  },
  {
    canonical: 'nombreEtages',
    aliases: ['floors', 'etages', 'floorCount'],
    category: 'building',
    type: 'number',
    description: 'Nombre d\'étages',
  },
  {
    canonical: 'superficieTerrain',
    aliases: ['landArea', 'terrainArea'],
    category: 'building',
    type: 'number',
    description: 'Superficie du terrain (m²)',
  },
  {
    canonical: 'superficieBatiment',
    aliases: ['buildingArea', 'batimentArea'],
    category: 'building',
    type: 'number',
    description: 'Superficie du bâtiment (m²)',
  },
  {
    canonical: 'evaluationFonciere',
    aliases: ['propertyAssessment', 'taxAssessment'],
    category: 'building',
    type: 'number',
    description: 'Évaluation foncière municipale',
  },
];

/**
 * Champs de sécurité
 */
export const SAFETY_FIELDS: CanonicalFieldDefinition[] = [
  {
    canonical: 'systemeGicleurs',
    aliases: ['sprinklers', 'giclee', 'hasSprinklers'],
    category: 'safety',
    type: 'boolean',
    description: 'Système de gicleurs installé',
  },
  {
    canonical: 'ascenseur',
    aliases: ['elevator', 'hasElevator'],
    category: 'safety',
    type: 'boolean',
    description: 'Ascenseur présent',
  },
  {
    canonical: 'nombreAscenseurs',
    aliases: ['elevatorCount', 'nbAscenseurs'],
    category: 'safety',
    type: 'number',
    description: 'Nombre d\'ascenseurs',
    defaultValue: 0,
  },
];

/**
 * Champs financiers
 */
export const FINANCE_FIELDS: CanonicalFieldDefinition[] = [
  {
    canonical: 'askingPrice',
    aliases: ['prixDemande', 'prixAnnonce', 'listingPrice', 'prix'],
    category: 'finance',
    type: 'number',
    description: 'Prix demandé',
  },
  {
    canonical: 'revenusAnnuels',
    aliases: ['annualRevenue', 'revenus', 'revenusAnnuelsBruts'],
    category: 'finance',
    type: 'number',
    description: 'Revenus annuels',
  },
  {
    canonical: 'loyerMoyen',
    aliases: ['avgRent', 'loyerMensuelMoyen', 'averageRent'],
    category: 'finance',
    type: 'number',
    description: 'Loyer mensuel moyen',
  },
  {
    canonical: 'tauxCapitalisation',
    aliases: ['capRate', 'capitalizationRate'],
    category: 'finance',
    type: 'number',
    description: 'Taux de capitalisation (%)',
  },
];

/**
 * Champs comptables / Amortissements & Ajustements
 */
export const ACCOUNTING_FIELDS: CanonicalFieldDefinition[] = [
  // Amortissements
  {
    canonical: 'amortissementImmobilisationsCorporelles',
    aliases: ['amortissementCorporel', 'depreciationCorporel', 'amortCorporel'],
    category: 'accounting',
    type: 'number',
    description: 'Amortissement des immobilisations corporelles',
  },
  {
    canonical: 'amortissementImmobilisationsIncorporelles',
    aliases: ['amortissementIncorporel', 'depreciationIncorporel', 'amortIncorporel'],
    category: 'accounting',
    type: 'number',
    description: 'Amortissement des immobilisations incorporelles',
  },
  {
    canonical: 'amortissementGoodwill',
    aliases: ['goodwillAmortization', 'amortEcartAcquisition', 'depreciationGoodwill'],
    category: 'accounting',
    type: 'number',
    description: 'Amortissement du goodwill/écart d\'acquisition',
  },
  {
    canonical: 'amortissementConventionAssociationEtEnteteMSSS',
    aliases: ['amortConvention', 'amortEntente108', 'amortMSSS'],
    category: 'accounting',
    type: 'number',
    description: 'Amortissement convention/entente MSSS',
  },
  {
    canonical: 'amortissementFraisFinancement',
    aliases: ['amortFraisFinancement', 'amortFraisReportes', 'financingCostAmortization'],
    category: 'accounting',
    type: 'number',
    description: 'Amortissement des frais de financement (SCHL, honoraires)',
  },
  {
    canonical: 'totalAmortissements',
    aliases: ['amortTotal', 'dotationAmortissement', 'chargeAmortissement'],
    category: 'accounting',
    type: 'number',
    description: 'Total des amortissements',
  },
  // Charges financières (intérêts et frais bancaires - requis pour DSCR/BAIIA)
  {
    canonical: 'interetsDette',
    aliases: ['interestOnDebt', 'chargeInterets', 'interetsLongTerme'],
    category: 'accounting',
    type: 'number',
    description: 'Intérêts sur la dette',
  },
  {
    canonical: 'fraisBancaires',
    aliases: ['bankFees', 'fraisBanque', 'commissionsBank'],
    category: 'accounting',
    type: 'number',
    description: 'Frais bancaires',
  },
  {
    canonical: 'interetsEtFraisBancairesCombines',
    aliases: ['interestAndBankFees', 'chargesFinancieres', 'fraisFinanciers'],
    category: 'accounting',
    type: 'number',
    description: 'Intérêts et frais bancaires combinés (quand non séparés)',
  },
  // Dette
  {
    canonical: 'detteLongTerme',
    aliases: ['longTermDebt', 'detteALongTerme', 'empruntsLongTerme'],
    category: 'accounting',
    type: 'number',
    description: 'Dette à long terme',
  },
  {
    canonical: 'hypotheques',
    aliases: ['mortgages', 'empruntHypothecaire', 'soldeHypothecaire'],
    category: 'accounting',
    type: 'number',
    description: 'Hypothèques',
  },
  {
    canonical: 'empruntsBancaires',
    aliases: ['bankLoans', 'margeCredit', 'ligneCredit'],
    category: 'accounting',
    type: 'number',
    description: 'Emprunts bancaires',
  },
  {
    canonical: 'detteNette',
    aliases: ['netDebt', 'detteNetteCalculee'],
    category: 'accounting',
    type: 'number',
    description: 'Dette nette (dette - trésorerie)',
  },
  // Fonds de roulement
  {
    canonical: 'actifsCourants',
    aliases: ['currentAssets', 'actifCourtTerme', 'actifCourant'],
    category: 'accounting',
    type: 'number',
    description: 'Actifs courants',
  },
  {
    canonical: 'passifsCourants',
    aliases: ['currentLiabilities', 'passifCourtTerme', 'passifCourant'],
    category: 'accounting',
    type: 'number',
    description: 'Passifs courants',
  },
  {
    canonical: 'fondRoulement',
    aliases: ['workingCapital', 'capitalRoulement', 'fondsRoulement'],
    category: 'accounting',
    type: 'number',
    description: 'Fonds de roulement (actifs CT - passifs CT)',
  },
  // CAPEX
  {
    canonical: 'capexMaintenance',
    aliases: ['maintenanceCapex', 'capexRecurrent', 'investissementMaintenance'],
    category: 'accounting',
    type: 'number',
    description: 'CAPEX de maintenance (récurrent)',
  },
  {
    canonical: 'capexCroissance',
    aliases: ['growthCapex', 'capexExpansion', 'investissementCroissance'],
    category: 'accounting',
    type: 'number',
    description: 'CAPEX de croissance (non récurrent)',
  },
  // BAIIA
  {
    canonical: 'baiiaComptable',
    aliases: ['ebitda', 'baiia', 'resultatExploitation'],
    category: 'accounting',
    type: 'number',
    description: 'BAIIA comptable (avant normalisation)',
  },
  {
    canonical: 'baiiaNormalise',
    aliases: ['normalizedEbitda', 'ebitdaNormalise', 'baiiaAjuste'],
    category: 'accounting',
    type: 'number',
    description: 'BAIIA normalisé (après ajustements)',
  },
  // État des résultats
  {
    canonical: 'beneficeNet',
    aliases: ['netIncome', 'resultatNet', 'profitNet'],
    category: 'accounting',
    type: 'number',
    description: 'Bénéfice net',
  },
];

/**
 * Champs de transaction
 */
export const TRANSACTION_FIELDS: CanonicalFieldDefinition[] = [
  {
    canonical: 'status',
    aliases: ['statut', 'residenceStatus'],
    category: 'transaction',
    type: 'string',
    description: 'Statut du dossier (prospection, mandat, etc.)',
  },
  {
    canonical: 'typeTransaction',
    aliases: ['transactionType', 'dealType'],
    category: 'transaction',
    type: 'string',
    description: 'Type de transaction',
  },
  {
    canonical: 'courtiersResponsables',
    aliases: ['courtierResponsable', 'assignedBrokers', 'brokers'],
    category: 'transaction',
    type: 'array',
    description: 'Courtiers responsables du dossier',
  },
];

/**
 * Champs fiche résidence — extraction documentaire V2 (Firestore `residences`, pas de parallèle).
 * @see functions-ai/extractionV2IA.js — V2_ALLOWED_CRM
 */
export const PROPERTY_DOCUMENT_EXTRACTION_FIELDS: CanonicalFieldDefinition[] = [
  {
    canonical: 'lotCadastreOfficiel',
    aliases: ['lotCadastre', 'lot_cadastre_officiel'],
    category: 'legal',
    type: 'string',
    description: 'Lot du cadastre officiel du Québec',
  },
  {
    canonical: 'descriptionConstructions',
    aliases: ['description_constructions', 'natureConstructions'],
    category: 'building',
    type: 'string',
    description: 'Détails sur la nature des constructions',
  },
  {
    canonical: 'chargesServitudes',
    aliases: ['charges_servitudes'],
    category: 'legal',
    type: 'string',
    description: 'Charges, servitudes et autres constatations (hors seule nuance CL)',
  },
  {
    canonical: 'reglementMunicipalZonage',
    aliases: ['reglement_zonage', 'zonage_reglement_municipal'],
    category: 'building',
    type: 'string',
    description: 'Règlement municipal de zonage applicable ou extrait',
  },
];

// ============================================================================
// REGISTRE COMPLET
// ============================================================================

/**
 * Tous les champs canoniques regroupés
 */
export const ALL_CANONICAL_FIELDS: CanonicalFieldDefinition[] = [
  ...IDENTITY_FIELDS,
  ...LOCATION_FIELDS,
  ...LEGAL_FIELDS,
  ...CAPACITY_FIELDS,
  ...BUILDING_FIELDS,
  ...SAFETY_FIELDS,
  ...FINANCE_FIELDS,
  ...ACCOUNTING_FIELDS,
  ...TRANSACTION_FIELDS,
  ...PROPERTY_DOCUMENT_EXTRACTION_FIELDS,
];

/**
 * Map inversée: alias -> canonical
 * Permet une recherche O(1) du nom canonique à partir d'un alias
 */
export const ALIAS_TO_CANONICAL: Record<string, string> = {};

/**
 * Map: canonical -> définition complète
 */
export const CANONICAL_DEFINITIONS: Record<string, CanonicalFieldDefinition> = {};

// Initialiser les maps
ALL_CANONICAL_FIELDS.forEach((field) => {
  // Ajouter le canonical lui-même
  ALIAS_TO_CANONICAL[field.canonical] = field.canonical;
  CANONICAL_DEFINITIONS[field.canonical] = field;

  // Ajouter tous les alias
  field.aliases.forEach((alias) => {
    ALIAS_TO_CANONICAL[alias] = field.canonical;
  });
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Obtient le nom canonique à partir d'un nom de champ (canonical ou alias)
 *
 * @param fieldName - Nom du champ (canonical ou alias)
 * @returns Le nom canonique ou undefined si non trouvé
 */
export function getCanonicalName(fieldName: string): string | undefined {
  return ALIAS_TO_CANONICAL[fieldName];
}

/**
 * Vérifie si un nom de champ est un nom canonique
 */
export function isCanonicalName(fieldName: string): boolean {
  return CANONICAL_DEFINITIONS[fieldName] !== undefined;
}

/**
 * Vérifie si un nom de champ est un alias connu
 */
export function isKnownField(fieldName: string): boolean {
  return ALIAS_TO_CANONICAL[fieldName] !== undefined;
}

/**
 * Obtient la définition d'un champ canonique
 */
export function getFieldDefinition(fieldName: string): CanonicalFieldDefinition | undefined {
  const canonical = getCanonicalName(fieldName);
  return canonical ? CANONICAL_DEFINITIONS[canonical] : undefined;
}

/**
 * Obtient tous les alias d'un champ canonique (incluant le canonical lui-même)
 */
export function getAllFieldNames(canonicalName: string): string[] {
  const def = CANONICAL_DEFINITIONS[canonicalName];
  if (!def) return [];
  return [def.canonical, ...def.aliases];
}

/**
 * Obtient les champs par catégorie
 */
export function getFieldsByCategory(category: FieldCategory): CanonicalFieldDefinition[] {
  return ALL_CANONICAL_FIELDS.filter((f) => f.category === category);
}

/**
 * Obtient les champs requis
 */
export function getRequiredFields(): CanonicalFieldDefinition[] {
  return ALL_CANONICAL_FIELDS.filter((f) => f.required);
}
