/**
 * Conformité mandat — dossiers incomplets (garde-fou OACIQ).
 * Aligné legacy `validateResidenceForMatching` + `MandatsACompleter.jsx`.
 */

import { toPositiveNumber } from './normalizeNumbers';

export type MandateCompletenessSource = {
  status?: string;
  statut?: string;
  askingPrice?: unknown;
  prixAnnonce?: unknown;
  prixDemande?: unknown;
  price?: unknown;
  prix?: unknown;
  unitesRPA?: unknown;
  nombreUnitesTotal?: unknown;
  unitsCount?: unknown;
  nombreUnites?: unknown;
  nombreUnitesRPA?: unknown;
  unites?: unknown;
  capacite?: unknown;
  region?: unknown;
  city?: unknown;
  ville?: unknown;
  residenceType?: unknown;
  type?: unknown;
  assetNiche?: unknown;
};

export interface MandateFieldGap {
  key: string;
  labelFr: string;
  labelEn: string;
}

export interface MandateCompletenessResult {
  /** Mandat actif avec toutes les données critiques pour diffusion / matching. */
  isComplete: boolean;
  /** S'applique au garde-fou (statut mandat canonique ou legacy). */
  applies: boolean;
  missingFields: MandateFieldGap[];
}

const VALID_RESIDENCE_TYPES = ['RPA', 'RI', 'MIXTE', 'MIXTE RPA / RI', 'MIXTE RPA/RI'] as const;

function isMandateStatus(residence: MandateCompletenessSource): boolean {
  const status = String(residence.status ?? residence.statut ?? '')
    .trim()
    .toLowerCase();
  return (
    status === 'mandate' ||
    status === 'mandat' ||
    status === 'en-mandat' ||
    status === 'actif' ||
    status === 'listed'
  );
}

function getAskingPrice(residence: MandateCompletenessSource): number | null {
  return (
    toPositiveNumber(residence.askingPrice) ??
    toPositiveNumber(residence.prixAnnonce) ??
    toPositiveNumber(residence.prixDemande) ??
    toPositiveNumber(residence.price) ??
    toPositiveNumber(residence.prix) ??
    null
  );
}

function getUnitsRpa(residence: MandateCompletenessSource): number | null {
  return (
    toPositiveNumber(residence.unitesRPA) ??
    toPositiveNumber(residence.nombreUnitesTotal) ??
    toPositiveNumber(residence.unitsCount) ??
    toPositiveNumber(residence.nombreUnites) ??
    toPositiveNumber(residence.nombreUnitesRPA) ??
    toPositiveNumber(residence.unites) ??
    toPositiveNumber(residence.capacite) ??
    null
  );
}

function getRegion(residence: MandateCompletenessSource): string | null {
  const region = residence.region ?? residence.city ?? residence.ville;
  if (typeof region !== 'string') return null;
  const trimmed = region.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getResidenceType(residence: MandateCompletenessSource): string | null {
  const type = residence.residenceType ?? residence.type ?? residence.assetNiche;
  if (typeof type !== 'string') return null;
  const typeUpper = type.toUpperCase().trim();
  if (VALID_RESIDENCE_TYPES.some((t) => typeUpper.includes(t) || t.includes(typeUpper))) {
    return type.trim();
  }
  return null;
}

/**
 * Évalue si un mandat actif possède les champs critiques requis.
 * Ne s'applique qu'aux inscriptions en statut mandat.
 */
export function assessMandateCompleteness(
  residence: MandateCompletenessSource | null | undefined
): MandateCompletenessResult {
  const empty: MandateCompletenessResult = {
    isComplete: true,
    applies: false,
    missingFields: [],
  };

  if (!residence) return { ...empty, isComplete: false };

  if (!isMandateStatus(residence)) {
    return empty;
  }

  const missingFields: MandateFieldGap[] = [];

  if (getAskingPrice(residence) === null) {
    missingFields.push({
      key: 'askingPrice',
      labelFr: 'Prix demandé',
      labelEn: 'Asking price',
    });
  }

  if (getUnitsRpa(residence) === null) {
    missingFields.push({
      key: 'unitsRpa',
      labelFr: 'Unités de résidence pour aînés (RPA)',
      labelEn: 'Retirement home units (RPA)',
    });
  }

  if (getRegion(residence) === null) {
    missingFields.push({
      key: 'region',
      labelFr: 'Région',
      labelEn: 'Region',
    });
  }

  if (getResidenceType(residence) === null) {
    missingFields.push({
      key: 'residenceType',
      labelFr: 'Type de résidence',
      labelEn: 'Property type',
    });
  }

  return {
    applies: true,
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

/** Libellés manquants pour infobulle / filtre. */
export function mandateMissingFieldLabels(
  result: MandateCompletenessResult,
  lang: 'fr' | 'en'
): string[] {
  return result.missingFields.map((f) => (lang === 'fr' ? f.labelFr : f.labelEn));
}
