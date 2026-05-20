/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 *
 * Source canonique : packages/core/src/diffusion/
 * Régénéré par   : functions/scripts/sync-core-diffusion.cjs (prebuild)
 */
/**
 * Diffusion Web — Types & Enums (Sprint Jour 1).
 *
 * SSOT des silos `public_listings/{publicId}` (document anonymisé) et
 * `listing_mappings/{publicId}` (lien privé `publicId ⇄ residenceId`).
 *
 * Pure : aucune dépendance UI, aucune dépendance Firestore.
 * Couplage zéro avec la couche app — la résidence est consommée via un type
 * structurel `ResidenceForPublicListing` (whitelist d'entrée).
 */

// ============================================================================
// STATUTS DE VISIBILITÉ — silo public_listings
// ============================================================================

export const PUBLIC_LISTING_STATUS = {
  VISIBLE: 'VISIBLE',
  MASQUE: 'MASQUE',
  SUSPENDU: 'SUSPENDU',
  ARCHIVE: 'ARCHIVE',
} as const;

export type PublicListingStatus =
  (typeof PUBLIC_LISTING_STATUS)[keyof typeof PUBLIC_LISTING_STATUS];

export const PUBLIC_LISTING_STATUS_LABELS_FR: Readonly<
  Record<PublicListingStatus, string>
> = Object.freeze({
  VISIBLE: 'Visible',
  MASQUE: 'Masquée',
  SUSPENDU: 'Suspendue',
  ARCHIVE: 'Archivée',
});

export const PUBLIC_LISTING_STATUS_LABELS_EN: Readonly<
  Record<PublicListingStatus, string>
> = Object.freeze({
  VISIBLE: 'Visible',
  MASQUE: 'Hidden',
  SUSPENDU: 'Suspended',
  ARCHIVE: 'Archived',
});

// ============================================================================
// SANTÉ DOSSIER — éligibilité publication
// ============================================================================

export const DATA_HEALTH_STATUS = {
  PUBLIABLE: 'PUBLIABLE',
  INCOMPLET: 'INCOMPLET',
  BLOQUE: 'BLOQUE',
} as const;

export type DataHealthStatus =
  (typeof DATA_HEALTH_STATUS)[keyof typeof DATA_HEALTH_STATUS];

// ============================================================================
// PROFIL ACHETEUR CIBLE
// ============================================================================

export const BUYER_TARGET_PROFILE = {
  OPERATEUR: 'OPERATEUR',
  INVESTISSEUR: 'INVESTISSEUR',
  CONSOLIDATEUR: 'CONSOLIDATEUR',
  PREMIERE_ACQUISITION: 'PREMIERE_ACQUISITION',
  OUVERT: 'OUVERT',
} as const;

export type BuyerTargetProfile =
  (typeof BUYER_TARGET_PROFILE)[keyof typeof BUYER_TARGET_PROFILE];

// ============================================================================
// CATÉGORIE VISUELLE — image générique Imagen 3 / brochure
// ============================================================================

export const VISUAL_CATEGORY = {
  COMPACT: 'COMPACT',
  MEDIUM: 'MEDIUM',
  INSTITUTIONAL: 'INSTITUTIONAL',
} as const;

export type VisualCategory =
  (typeof VISUAL_CATEGORY)[keyof typeof VISUAL_CATEGORY];

// ============================================================================
// SYNDICATION MULTI-PORTAILS — RPAaVendre.com / CPEaVendre.com / PlexaVendre.com
// ============================================================================

/**
 * Équivalent core de l'interface `AssetSyndication` (couche app `src/types/residence.ts`).
 * Défini ici pour éviter le couplage inversé core → app.
 */
export interface SyndicationToggles {
  rpaAVendre?: boolean;
  cpeAVendre?: boolean;
  plexAVendre?: boolean;
}

// ============================================================================
// CHAMPS PUBLICS AUTORISÉS — WHITELIST IMMUABLE
// ============================================================================

/**
 * Référence des champs sortants. Toute clé absente de cette liste ne peut être
 * persistée dans `public_listings/{publicId}`. Documentaire — utilisé par
 * `anonymizeResidence.ts` et par les tests futurs de conformité Loi 25.
 */
export const PUBLIC_ALLOWED_FIELDS = [
  'publicId',
  'publicTitle',
  'publicVisualUrl',
  'publicDescription',
  'categorieVisuelle',
  'residenceType',
  'region',
  'secteur',
  'nombreUnites',
  'anneeConstruction',
  'fourchettePrix',
  'tauxOccupation',
  'publicInclusions',
  'publicExclusions',
  'buyerTargetProfile',
  'buyerTargetNotes',
  'visibility',
  'syndication',
] as const;

export type PublicAllowedField = (typeof PUBLIC_ALLOWED_FIELDS)[number];

// ============================================================================
// RÉSIDENCE EN ENTRÉE — type structurel pour buildPublicListing()
// ============================================================================

/**
 * Vue minimale d'une résidence brute requise par le moteur d'anonymisation.
 *
 * Volontairement structurel (pas d'`extends Residence`) — le core reste neutre
 * et compatible avec n'importe quelle source (Firestore residences, fixture
 * de test, payload Cloud Function).
 */
export interface ResidenceForPublicListing {
  id?: string | null;

  // Identification
  name?: string | null;
  nomCommercial?: string | null;
  residenceType?: string | null;

  // Localisation (jamais publiée brute)
  ville?: string | null;
  municipalite?: string | null;
  city?: string | null;
  region?: string | null;
  regionSociosanitaire?: string | null;
  regionAdministrative?: string | null;
  regions?: ReadonlyArray<string> | null;

  // Caractéristiques
  nombreUnites?: number | string | null;
  nombreUnitesTotal?: number | string | null;
  unitsCount?: number | string | null;
  anneeConstruction?: number | string | null;

  // Financier (jamais publié exact)
  prixDemande?: number | string | null;
  askingPrice?: number | string | null;
  prix?: number | string | null;
  publicPrice?: number | string | null;
  tauxOccupation?: number | string | null;

  // Marketing public (saisi par le courtier)
  publicTitle?: string | null;
  publicVisualUrl?: string | null;
  publicDescription?: string | null;
  publicInclusions?: string | null;
  publicExclusions?: string | null;

  // Profil acheteur
  buyerTargetProfile?: BuyerTargetProfile | string | null;
  buyerTargetNotes?: string | null;

  // Syndication multi-portails
  syndication?: SyndicationToggles | null;

  // Méta éligibilité
  dataHealth?: DataHealthStatus | string | null;
}

// ============================================================================
// GARDE-FOUS PUBLICATION — entrée élargie (pipeline + conformité RPA)
// ============================================================================

/** Champs additionnels pour `evaluatePublicationGuardrails` (structurel, sans couplage UI). */
export interface ResidenceForPublicationGuardrails extends ResidenceForPublicListing {
  status?: string | null;
  stage?: string | null;
  pipelineStatus?: string | null;
  statut?: string | null;
  assetNiche?: string | null;
  numeroPermisMsss?: string | null;
  numeroRegistreMsss?: string | null;
  codeMSSS?: string | null;
  msssNumber?: string | null;
  permitNumber?: string | null;
  numeroRqra?: string | null;
  rqraNumber?: string | null;
  numeroAdhesionRqra?: string | null;
  courtiersResponsables?: string | null;
  courtierResponsable?: string | null;
  contratCourtage?: string | null;
  telephone?: string | null;
  courriel?: string | null;
  email?: string | null;
  adresse?: string | null;
  address?: string | null;
  ville?: string | null;
  municipalite?: string | null;
  annexeGActive?: boolean | null;
  contratCourtageSigne?: boolean | null;
}

export const PUBLICATION_GUARDRAIL_STATUS = {
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL',
} as const;

export type PublicationGuardrailStatus =
  (typeof PUBLICATION_GUARDRAIL_STATUS)[keyof typeof PUBLICATION_GUARDRAIL_STATUS];

export interface PublicationGuardrailResult {
  id: string;
  labelFr: string;
  labelEn: string;
  status: PublicationGuardrailStatus;
  /** Si vrai, un échec (`FAIL`) bloque `isPublishable`. */
  blocking: boolean;
  detailFr?: string;
  detailEn?: string;
}

export interface PublicationGuardrailsEvaluation {
  isPublishable: boolean;
  /** Nombre de vérifications réussies (PASS uniquement). */
  score: number;
  maxScore: number;
  /** Score normalisé 0–100 (arrondi). */
  scorePercent: number;
  results: PublicationGuardrailResult[];
}

// ============================================================================
// DOCUMENT PUBLIC LISTING — silo public_listings/{publicId}
// ============================================================================

/**
 * Vue anonymisée d'une résidence destinée au silo public.
 *
 * Garanties :
 *  - Aucune donnée identifiante : pas de ville, pas de prix exact, pas de nom commercial.
 *  - `publicId` non corrélable avec l'ID Firestore privé (mapping séparé).
 *  - Toutes les chaînes restent nullables si absentes côté source — pas de
 *    valeurs « N/A » fantômes qui pollueraient l'affichage public.
 */
export interface PublicListing {
  /** UUID v4 non-corrélable. Fourni par la couche d'orchestration. */
  publicId: string;

  /** Titre marketing public — jamais le nom commercial réel. */
  publicTitle: string | null;

  /** URL d'image générique (Imagen 3 ou banque maison). */
  publicVisualUrl: string | null;

  /** Description marketing longue. */
  publicDescription: string | null;

  /** Catégorie visuelle dérivée du nombre d'unités. */
  categorieVisuelle: VisualCategory;

  /** Type de résidence (RPA, RI-RTF, etc.). Défaut « RPA ». */
  residenceType: string;

  /** Région administrative (ex. « Estrie », « Capitale-Nationale »). */
  region: string | null;

  /** Secteur large optionnel (ex. « Rive-Sud »). Jamais la ville. */
  secteur: string | null;

  /** Nombre d'unités (valeur brute, mais non identifiante à elle seule). */
  nombreUnites: number;

  /** Année construction — masquée à `XXXX+` si moins de 5 ans. */
  anneeConstruction: string | null;

  /** Fourchette de prix (ex. « 2M-3M », jamais le prix exact). */
  fourchettePrix: string;

  /** Taux d'occupation arrondi (pas de 10 % si < 40 unités, 5 % sinon). */
  tauxOccupation: number | null;

  /** Inclusions / exclusions de la vente (texte libre courtier). */
  publicInclusions: string | null;
  publicExclusions: string | null;

  /** Profil acheteur recherché. Défaut `OUVERT`. */
  buyerTargetProfile: BuyerTargetProfile;
  buyerTargetNotes: string | null;

  /** Statut de visibilité du silo public. */
  visibility: PublicListingStatus;

  /** Toggles syndication multi-portails (RPAaVendre / CPE / Plex). */
  syndication: SyndicationToggles;
}
