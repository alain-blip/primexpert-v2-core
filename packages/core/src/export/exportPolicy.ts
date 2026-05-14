/**
 * Export Policy — LOT 8 + BASCULE DOCUMENTAIRE
 *
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    RÈGLE DE BASCULE DOCUMENTAIRE                             ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║ L'identité de la résidence est communiquée UNIQUEMENT lors de la            ║
 * ║ transmission officielle des documents, immédiatement avant la préparation   ║
 * ║ de l'offre d'achat.                                                         ║
 * ║                                                                              ║
 * ║ AVANT documents : anonymat strict (BUYER_PREVIEW)                           ║
 * ║ À l'envoi documents : identité autorisée (BUYER_DOCUMENTS)                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Vues disponibles:
 * - INTERNAL_TEAM: accès complet (équipe)
 * - BANK_VIEW: vue banquier (financement) - identité complète
 * - BUYER_PREVIEW: aperçu acheteur ANONYME (plateforme)
 * - BUYER_DOCUMENTS: documents acheteur avec IDENTITÉ (envoi officiel)
 *
 * Privacy-first: les champs sensibles ne sont JAMAIS exportés.
 */

// ============================================================
// TYPES
// ============================================================

export type ExportView = 'INTERNAL_TEAM' | 'BANK_VIEW' | 'BUYER_PREVIEW' | 'BUYER_DOCUMENTS';

export interface ExportPolicy {
  /** Champs autorisés pour cette vue */
  allowedFields: string[];
  /** Champs explicitement masqués */
  redactedFields: string[];
  /** Sections incluses */
  sections: ExportSection[];
  /** Inclure les informations de provenance */
  includeProvenance: boolean;
  /** Inclure le score qualité */
  includeQualityScore: boolean;
  /** Inclure la liste des documents */
  includeDocuments: boolean;
  /** Inclure les liens vers documents */
  includeDocumentLinks: boolean;
}

export type ExportSection =
  | 'summary'
  | 'identity'
  | 'location'
  | 'capacity'
  | 'revenue'
  | 'building'
  | 'safety'
  | 'compliance'
  | 'documents'
  | 'quality';

// ============================================================
// CHAMPS SENSIBLES (JAMAIS EXPORTÉS)
// ============================================================

/**
 * Champs JAMAIS exportés, quelle que soit la vue
 */
export const NEVER_EXPORT_FIELDS: string[] = [
  // Données personnelles administrateurs
  'administrateurs',
  'homeAddress',
  'personalPhone',
  'personalEmail',
  'personalAddress',
  'sin',
  'nas',
  'bankAccount',
  'bankAccountNumber',
  'password',
  'accessToken',
  'refreshToken',
  // Notes internes
  'notesInternes',
  'internalNotes',
  'privateNotes',
  // Logs et erreurs
  'ingestionErrors',
  'lastError',
  'errorLog',
  'debugInfo',
  // Automation interne
  'automationQueue',
  'automationSummary',
  // Provenance détaillée (logs)
  'fieldProvenanceLogs',
  'syncHistory',
  // Métadonnées sensibles
  'createdBy',
  'modifiedBy',
  'assignedCourtiers',
  'accessList',
];

/**
 * Patterns de champs sensibles (regex)
 */
export const SENSITIVE_FIELD_PATTERNS: RegExp[] = [
  /password/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /credential/i,
  /sin\b/i,
  /nas\b/i,
  /ssn/i,
  /homeAddress/i,
  /personalPhone/i,
  /personalEmail/i,
];

// ============================================================
// CHAMPS PAR CATÉGORIE
// ============================================================

const IDENTITY_FIELDS = [
  'name',
  'residenceType',
  'categorieRPA',
  'raisonSociale',
  'neq',
  'formeJuridique',
];

const LOCATION_FIELDS = [
  'address',
  'municipalite',
  'regionSociosanitaire',
  'codePostal',
  'region',
];

const CONTACT_FIELDS = [
  'telephone',
  'courriel',
  'siteWeb',
];

const CAPACITY_FIELDS = [
  'nombreUnitesTotal',
  'tauxOccupation',
  'nombreUnitesDisponibles',
  'nombreResidents',
];

const BUILDING_FIELDS = [
  'anneeConstruction',
  'nombreEtages',
  'superficieBatiment',
  'superficieTerrain',
];

const SAFETY_FIELDS = [
  'systemeGicleurs',
  'ascenseur',
  'categorieSecurite',
  'certificationMSSS',
];

const FINANCE_FIELDS = [
  'askingPrice',
  'revenusAnnuels',
  'depensesAnnuelles',
  'loyerMoyen',
  'tauxCapitalisation',
  'evaluationFonciere',
  'revenuNetExploitation',
  'multiplicateurRevenuBrut',
];

const MARKET_FIELDS = [
  'dateOuverture',
  'datePrisePossession',
  'anneeAcquisitionImmeuble',
  'anneeDebutExploitationRPA',
];

// ============================================================
// POLITIQUES PAR VUE
// ============================================================

/**
 * Vue équipe interne (accès complet sauf sensibles)
 */
export const INTERNAL_TEAM_POLICY: ExportPolicy = {
  allowedFields: [
    ...IDENTITY_FIELDS,
    ...LOCATION_FIELDS,
    ...CONTACT_FIELDS,
    ...CAPACITY_FIELDS,
    ...BUILDING_FIELDS,
    ...SAFETY_FIELDS,
    ...FINANCE_FIELDS,
    ...MARKET_FIELDS,
  ],
  redactedFields: NEVER_EXPORT_FIELDS,
  sections: ['summary', 'identity', 'location', 'capacity', 'revenue', 'building', 'safety', 'compliance', 'documents', 'quality'],
  includeProvenance: true,
  includeQualityScore: true,
  includeDocuments: true,
  includeDocumentLinks: true,
};

/**
 * Vue banquier (financement)
 */
export const BANK_VIEW_POLICY: ExportPolicy = {
  allowedFields: [
    // Identité (sans détails personnels)
    'name',
    'residenceType',
    'categorieRPA',
    'raisonSociale',
    'neq',
    'formeJuridique',
    // Localisation
    'address',
    'municipalite',
    'regionSociosanitaire',
    'codePostal',
    // Contact professionnel
    'telephone',
    'courriel',
    'siteWeb',
    // Capacité
    'nombreUnitesTotal',
    'tauxOccupation',
    'nombreUnitesDisponibles',
    // Bâtiment
    'anneeConstruction',
    'nombreEtages',
    'superficieBatiment',
    'superficieTerrain',
    // Sécurité
    'systemeGicleurs',
    'ascenseur',
    'categorieSecurite',
    // Finances
    'askingPrice',
    'revenusAnnuels',
    'depensesAnnuelles',
    'loyerMoyen',
    'tauxCapitalisation',
    'evaluationFonciere',
    'revenuNetExploitation',
    // Dates
    'anneeConstruction',
    'anneeDebutExploitationRPA',
  ],
  redactedFields: [
    ...NEVER_EXPORT_FIELDS,
    // Notes et commentaires
    'notes',
    'commentaires',
  ],
  sections: ['summary', 'identity', 'location', 'capacity', 'revenue', 'building', 'safety', 'documents'],
  includeProvenance: false, // Pas les détails de provenance
  includeQualityScore: true, // Le banquier peut voir le score
  includeDocuments: true,
  includeDocumentLinks: false, // Pas de liens directs
};

/**
 * Vue acheteur PREVIEW - ANONYME mais RICHE EN DONNÉES FINANCIÈRES
 *
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ « Les informations présentées permettent d'évaluer la pertinence            ║
 * ║   financière de l'opportunité. L'identité de la résidence est               ║
 * ║   communiquée lors de la transmission officielle des documents. »           ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * ⚠️ RÈGLE ABSOLUE: Cette vue ne contient JAMAIS l'identité de la résidence
 * - ❌ Pas de nom
 * - ❌ Pas d'adresse
 * - ❌ Pas de ville
 *
 * ✅ MAIS contient TOUTES les données financières nécessaires à l'évaluation:
 * - Prix demandé
 * - Revenus annuels
 * - Dépenses annuelles
 * - Profit (BAIIA / NOI)
 * - Données pour calcul de financement
 */
export const BUYER_PREVIEW_POLICY: ExportPolicy = {
  allowedFields: [
    // ❌ PAS de 'name' - INTERDIT
    // ❌ PAS de 'address' - INTERDIT
    // ❌ PAS de 'municipalite' - INTERDIT

    // Type de résidence
    'residenceType',
    'categorieRPA',

    // Région LARGE uniquement (pas la ville)
    'region',
    'regionSociosanitaire',

    // Capacité (approximatif autorisé)
    'nombreUnitesTotal',
    'tauxOccupation',

    // Bâtiment
    'anneeConstruction',
    'nombreEtages',

    // Sécurité
    'systemeGicleurs',
    'ascenseur',

    // ✅ FINANCES - OBLIGATOIRES pour évaluation
    'askingPrice',           // Prix demandé
    'prixDemande',           // Alias
    'revenusAnnuels',        // Revenus annuels
    'depensesAnnuelles',     // Dépenses annuelles
    'profitBrut',            // BAIIA / NOI
    'revenuNetExploitation', // NOI alias
    'tauxCapitalisation',    // Cap rate
    'loyerMoyen',            // Loyer moyen par unité

    // ✅ FINANCEMENT - Données calculées
    'financingData',         // Objet avec calculs de financement
  ],
  redactedFields: [
    ...NEVER_EXPORT_FIELDS,
    // IDENTITÉ - TOUJOURS INTERDIT
    'name',
    'nom',
    'nomResidence',
    'raisonSociale',
    'neq',
    'formeJuridique',
    // LOCALISATION PRÉCISE - TOUJOURS INTERDIT
    'address',
    'adresse',
    'municipalite',
    'ville',
    'city',
    'codePostal',
    'postalCode',
    // CONTACT - INTERDIT
    'telephone',
    'courriel',
    'siteWeb',
    // ÉVALUATION FONCIÈRE - INTERDIT (identifiant potentiel)
    'evaluationFonciere',
  ],
  sections: ['summary', 'capacity', 'building', 'safety', 'revenue'],
  includeProvenance: false,
  includeQualityScore: false,
  includeDocuments: false,
  includeDocumentLinks: false,
};

/**
 * Vue acheteur DOCUMENTS - AVEC IDENTITÉ (envoi officiel uniquement)
 *
 * ✅ Cette vue est utilisée UNIQUEMENT lors de l'envoi des documents officiels
 * ✅ L'identité est révélée car c'est le POINT DE BASCULE documentaire
 * ✅ Accès sécurisé, temporaire, journalisé et révocable
 */
export const BUYER_DOCUMENTS_POLICY: ExportPolicy = {
  allowedFields: [
    // ✅ IDENTITÉ AUTORISÉE (point de bascule)
    'name',
    'residenceType',
    'categorieRPA',
    'raisonSociale',
    // ✅ LOCALISATION AUTORISÉE
    'address',
    'municipalite',
    'regionSociosanitaire',
    'codePostal',
    'region',
    // ✅ CONTACT AUTORISÉ
    'telephone',
    'siteWeb',
    // Capacité
    'nombreUnitesTotal',
    'tauxOccupation',
    'nombreUnitesDisponibles',
    // Bâtiment
    'anneeConstruction',
    'nombreEtages',
    'superficieBatiment',
    'superficieTerrain',
    // Sécurité
    'systemeGicleurs',
    'ascenseur',
    'categorieSecurite',
    // ✅ FINANCES DÉTAILLÉES AUTORISÉES
    'askingPrice',
    'tauxCapitalisation',
    'loyerMoyen',
    'revenusAnnuels',
    'depensesAnnuelles',
  ],
  redactedFields: [
    ...NEVER_EXPORT_FIELDS,
    // Détails légaux internes
    'neq',
    'formeJuridique',
    // Évaluation foncière (interne)
    'evaluationFonciere',
  ],
  sections: ['summary', 'identity', 'location', 'capacity', 'revenue', 'building', 'safety', 'documents'],
  includeProvenance: false,
  includeQualityScore: false,
  includeDocuments: true, // ✅ Liste des documents incluse
  includeDocumentLinks: false, // Liens via token sécurisé séparé
};

/**
 * @deprecated Utiliser BUYER_PREVIEW_POLICY ou BUYER_DOCUMENTS_POLICY
 * Conservé pour rétrocompatibilité - alias vers BUYER_DOCUMENTS_POLICY
 */
export const BUYER_VIEW_POLICY: ExportPolicy = BUYER_DOCUMENTS_POLICY;

// ============================================================
// HELPERS
// ============================================================

/**
 * Récupère la politique d'export pour une vue
 */
export function getExportPolicy(view: ExportView | 'BUYER_VIEW'): ExportPolicy {
  switch (view) {
    case 'INTERNAL_TEAM':
      return INTERNAL_TEAM_POLICY;
    case 'BANK_VIEW':
      return BANK_VIEW_POLICY;
    case 'BUYER_PREVIEW':
      return BUYER_PREVIEW_POLICY;
    case 'BUYER_DOCUMENTS':
      return BUYER_DOCUMENTS_POLICY;
    case 'BUYER_VIEW':
      // @deprecated - rétrocompatibilité
      return BUYER_DOCUMENTS_POLICY;
    default:
      throw new Error(`Vue d'export inconnue: ${view}`);
  }
}

/**
 * Vérifie si un champ est autorisé pour une vue
 */
export function isFieldAllowed(field: string, view: ExportView): boolean {
  const policy = getExportPolicy(view);

  // Vérifier les champs jamais exportés
  if (NEVER_EXPORT_FIELDS.includes(field)) {
    return false;
  }

  // Vérifier les patterns sensibles
  if (SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(field))) {
    return false;
  }

  // Vérifier les champs redactés
  if (policy.redactedFields.includes(field)) {
    return false;
  }

  // Vérifier si dans la liste autorisée
  return policy.allowedFields.includes(field);
}

/**
 * Vérifie si un champ est sensible (jamais exportable)
 */
export function isSensitiveField(field: string): boolean {
  if (NEVER_EXPORT_FIELDS.includes(field)) {
    return true;
  }

  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(field));
}

/**
 * Filtre un objet pour ne garder que les champs autorisés
 */
export function filterAllowedFields<T extends Record<string, unknown>>(
  data: T,
  view: ExportView
): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isFieldAllowed(key, view)) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

/**
 * Vérifie qu'aucune donnée sensible n'est présente dans un dataset
 * Retourne la liste des champs sensibles trouvés (devrait être vide)
 */
export function auditSensitiveFields(data: Record<string, unknown>): string[] {
  const found: string[] = [];

  function checkObject(obj: Record<string, unknown>, prefix = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (isSensitiveField(key)) {
        found.push(fullKey);
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        checkObject(value as Record<string, unknown>, fullKey);
      }
    }
  }

  checkObject(data);
  return found;
}

// ============================================================
// LABELS POUR L'UI
// ============================================================

export const VIEW_LABELS: Record<ExportView, string> = {
  INTERNAL_TEAM: 'Équipe interne',
  BANK_VIEW: 'Pack Financement (Banquier)',
  BUYER_PREVIEW: 'Aperçu Acheteur (Anonyme)',
  BUYER_DOCUMENTS: 'Documents Acheteur (Avec identité)',
};

export const VIEW_DESCRIPTIONS: Record<ExportView, string> = {
  INTERNAL_TEAM: 'Accès complet aux données (équipe seulement)',
  BANK_VIEW: 'Données financières et opérationnelles pour le financement',
  BUYER_PREVIEW: '⚠️ ANONYME - Aperçu sans nom ni adresse (plateforme)',
  BUYER_DOCUMENTS: '✅ IDENTITÉ RÉVÉLÉE - Pour envoi documentaire officiel uniquement',
};

/**
 * Indique si une vue révèle l'identité de la résidence
 * IMPORTANT: Utilisé pour journaliser la bascule documentaire
 */
export function viewRevealsIdentity(view: ExportView | 'BUYER_VIEW'): boolean {
  switch (view) {
    case 'INTERNAL_TEAM':
    case 'BANK_VIEW':
    case 'BUYER_DOCUMENTS':
    case 'BUYER_VIEW': // deprecated alias
      return true;
    case 'BUYER_PREVIEW':
      return false;
    default:
      return false;
  }
}

export default {
  getExportPolicy,
  isFieldAllowed,
  isSensitiveField,
  filterAllowedFields,
  auditSensitiveFields,
  viewRevealsIdentity,
  NEVER_EXPORT_FIELDS,
  VIEW_LABELS,
  VIEW_DESCRIPTIONS,
  BUYER_PREVIEW_POLICY,
  BUYER_DOCUMENTS_POLICY,
};
