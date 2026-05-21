/**
 * Moteur d'anonymisation — fonction pure `buildPublicListing()`.
 *
 * Règles d'invariance :
 *  1. Whitelist absolue : seuls les champs déclarés dans `PublicListing`
 *     (et listés dans `PUBLIC_ALLOWED_FIELDS`) peuvent être retournés.
 *  2. Aucun effet de bord : pas de génération d'UUID (fourni par caller),
 *     pas d'accès Firestore, pas de lecture d'horloge implicite.
 *  3. Déterminisme : `currentYear` injectable via `options.currentYear` pour
 *     les tests à horloge fixée. Défaut = `new Date().getUTCFullYear()`.
 *  4. Tolérance d'entrée : tous les champs source sont optionnels et peuvent
 *     être nuls/chaînes/nombres — `safeNum` couvre les variantes fr-CA.
 */

import { safeNum } from '../financial/safeNumbers';
import { villeToSecteur } from './villeToSecteur';
import {
  arrondirTauxOccupation,
  getPriceRange,
  getPublicUnitsRangeLabel,
  getVisualCategory,
} from './priceRanges';
import {
  BUYER_TARGET_PROFILE,
  PUBLIC_LISTING_STATUS,
  type BuyerTargetProfile,
  type PublicListing,
  type PublicListingStatus,
  type ResidenceForPublicListing,
  type SyndicationToggles,
} from './types';

/** Seuil sous lequel l'année de construction est masquée à « XXXX+ ». */
const ANNEE_MASQUE_SEUIL_ANS = 5;

/** Type de résidence par défaut si la source est vide. */
const DEFAULT_RESIDENCE_TYPE = 'RPA';

function pickString(...candidates: ReadonlyArray<unknown>): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function pickPositiveNumber(...candidates: ReadonlyArray<unknown>): number {
  for (const candidate of candidates) {
    const n = safeNum(candidate);
    if (n != null && n > 0) return n;
  }
  return 0;
}

function resolveBuyerProfile(raw: unknown): BuyerTargetProfile {
  if (typeof raw !== 'string') return BUYER_TARGET_PROFILE.OUVERT;
  const upper = raw.trim().toUpperCase();
  const allowed = new Set<string>(Object.values(BUYER_TARGET_PROFILE));
  return allowed.has(upper)
    ? (upper as BuyerTargetProfile)
    : BUYER_TARGET_PROFILE.OUVERT;
}

function resolveSyndication(
  raw: SyndicationToggles | null | undefined
): SyndicationToggles {
  return {
    rpaAVendre: raw?.rpaAVendre === true,
    cpeAVendre: raw?.cpeAVendre === true,
    plexAVendre: raw?.plexAVendre === true,
  };
}

function resolveAnneeConstruction(
  raw: unknown,
  currentYear: number
): string | null {
  const annee = safeNum(raw);
  if (annee == null || annee <= 0) return null;
  const ecart = currentYear - annee;
  if (ecart >= 0 && ecart < ANNEE_MASQUE_SEUIL_ANS) {
    return `${currentYear - ANNEE_MASQUE_SEUIL_ANS}+`;
  }
  return String(Math.trunc(annee));
}

export interface BuildPublicListingOptions {
  /** Statut initial du listing (défaut `VISIBLE`). */
  visibility?: PublicListingStatus;
  /**
   * Année courante injectée — clé de testabilité (`buildPublicListing(input, id,
   * { currentYear: 2026 })`). Défaut : `new Date().getUTCFullYear()`.
   */
  currentYear?: number;
}

/**
 * Convertit une `ResidenceForPublicListing` brute en `PublicListing` anonymisé
 * prêt pour le silo `public_listings/{publicId}`.
 *
 * Cette fonction est **pure** : pour la même entrée et le même `currentYear`,
 * la sortie est strictement identique. Aucun effet de bord ni I/O.
 *
 * @param input    Données résidence brutes (jamais persistées dans public_listings).
 * @param publicId UUID v4 fourni par la couche d'orchestration (Cloud Function).
 * @param options  Statut initial et horloge injectable pour les tests.
 *
 * @throws Si `publicId` est absent ou non-chaîne — invariant de sécurité :
 *         un listing public sans identifiant briserait le silo.
 */
export function buildPublicListing(
  input: ResidenceForPublicListing,
  publicId: string,
  options: BuildPublicListingOptions = {}
): PublicListing {
  if (typeof publicId !== 'string' || !publicId.trim()) {
    throw new Error(
      '[buildPublicListing] publicId requis (UUID v4 fourni par le caller).'
    );
  }

  const currentYear =
    typeof options.currentYear === 'number' && Number.isFinite(options.currentYear)
      ? options.currentYear
      : new Date().getUTCFullYear();

  const nombreUnites = pickPositiveNumber(
    input.nombreUnites,
    input.nombreUnitesTotal,
    input.unitsCount
  );

  const ville = pickString(input.ville, input.municipalite, input.city);
  const secteur = villeToSecteur(ville);

  const region = pickString(
    input.region,
    input.regionSociosanitaire,
    input.regionAdministrative,
    Array.isArray(input.regions) && input.regions.length > 0
      ? input.regions[0]
      : null
  );

  const prixCandidat = pickPositiveNumber(
    input.publicPrice,
    input.prixDemande,
    input.askingPrice,
    input.prix
  );

  return {
    publicId: publicId.trim(),
    publicTitle: pickString(input.publicTitle),
    publicVisualUrl: pickString(input.publicVisualUrl),
    publicDescription: pickString(input.publicDescription),
    categorieVisuelle: getVisualCategory(nombreUnites),
    residenceType: pickString(input.residenceType) ?? DEFAULT_RESIDENCE_TYPE,
    region,
    secteur,
    nombreUnites,
    fourchetteUnites: getPublicUnitsRangeLabel(nombreUnites),
    anneeConstruction: resolveAnneeConstruction(input.anneeConstruction, currentYear),
    fourchettePrix: getPriceRange(prixCandidat),
    tauxOccupation: arrondirTauxOccupation(input.tauxOccupation, nombreUnites),
    publicInclusions: pickString(input.publicInclusions),
    publicExclusions: pickString(input.publicExclusions),
    buyerTargetProfile: resolveBuyerProfile(input.buyerTargetProfile),
    buyerTargetNotes: pickString(input.buyerTargetNotes),
    visibility: options.visibility ?? PUBLIC_LISTING_STATUS.VISIBLE,
    syndication: resolveSyndication(input.syndication ?? null),
  };
}
