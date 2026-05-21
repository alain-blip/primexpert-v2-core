/**
 * Mapping `PublicListing` → payload REST WordPress.
 *
 * L'entrée est déjà anonymisée par `buildPublicListing()` du core — aucune
 * donnée privée ne peut transiter ici. Cette couche est donc purement
 * cosmétique (mise en forme HTML + remplissage `meta` ACF).
 */

import type { PublicListing } from './_vendored';
import { PUBLIC_BUYER_CONTRACTS_HTML } from './_vendored/publicBuyerDisclosures';
import {
  resolveAcfListingStatus,
  type TransactionPublicationInput,
} from './_vendored/transactionBanner';
import type {
  WordPressPostStatus,
  WordPressUpsertRequest,
} from './wordPressClient';

const HTML_SECTION_SEP = '\n\n';
const DEFAULT_TITLE_FR = 'Résidence privée à vendre';

export interface BuildWordPressPayloadOptions {
  /** Contexte transaction (stage, date notaire) pour ACF « sous offre » / « vendu ». */
  transaction?: TransactionPublicationInput;
  /** Horloge injectable (tests). */
  now?: Date;
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pushFact(target: string[], label: string, value: string | number | null): void {
  if (value === null || value === '' || value === undefined) return;
  const safeValue = typeof value === 'number' ? String(value) : htmlEscape(value);
  target.push(`<li><strong>${label} :</strong> ${safeValue}</li>`);
}

function buildContentHtml(listing: PublicListing): string {
  const sections: string[] = [];

  if (listing.publicDescription) {
    sections.push(`<p>${htmlEscape(listing.publicDescription)}</p>`);
  }

  const facts: string[] = [];
  pushFact(facts, 'Type', listing.residenceType);
  if (listing.region) pushFact(facts, 'Région', listing.region);
  if (listing.secteur) pushFact(facts, 'Secteur', listing.secteur);
  if (listing.fourchetteUnites && listing.fourchetteUnites !== 'Non divulgué') {
    pushFact(facts, 'Unités', listing.fourchetteUnites);
  }
  if (listing.tauxOccupation != null) {
    pushFact(facts, "Taux d'occupation", `${listing.tauxOccupation} %`);
  }
  if (listing.anneeConstruction) {
    pushFact(facts, 'Année', listing.anneeConstruction);
  }
  pushFact(facts, 'Fourchette de prix', listing.fourchettePrix);
  if (facts.length > 0) {
    sections.push(`<ul>${facts.join('')}</ul>`);
  }

  if (listing.publicInclusions) {
    sections.push(
      `<h3>Inclusions</h3><p>${htmlEscape(listing.publicInclusions)}</p>`
    );
  }
  if (listing.publicExclusions) {
    sections.push(
      `<h3>Exclusions</h3><p>${htmlEscape(listing.publicExclusions)}</p>`
    );
  }

  sections.push(PUBLIC_BUYER_CONTRACTS_HTML);

  return sections.join(HTML_SECTION_SEP);
}

function buildMeta(
  listing: PublicListing,
  transaction: TransactionPublicationInput | undefined,
  now?: Date
): Record<string, string | number> {
  const acfListingStatus = resolveAcfListingStatus(transaction ?? {}, { now });
  return {
    pub_public_id: listing.publicId,
    pub_residence_type: listing.residenceType,
    pub_region: listing.region ?? '',
    pub_secteur: listing.secteur ?? '',
    pub_nombre_unites: listing.nombreUnites,
    pub_fourchette_unites: listing.fourchetteUnites,
    pub_annee_construction: listing.anneeConstruction ?? '',
    pub_fourchette_prix: listing.fourchettePrix,
    pub_taux_occupation:
      listing.tauxOccupation == null ? '' : listing.tauxOccupation,
    pub_categorie_visuelle: listing.categorieVisuelle,
    pub_buyer_profile: listing.buyerTargetProfile,
    pub_visual_url: listing.publicVisualUrl ?? '',
    acf_listing_status: acfListingStatus,
    acfListingStatus: acfListingStatus,
  };
}

/**
 * Construit la requête REST WordPress prête à envoyer depuis un `PublicListing`.
 *
 * @param listing  `PublicListing` déjà anonymisé par le core.
 * @param status   Statut WP cible (`publish`, `draft`, `private`).
 * @param wpPostId ID du post WP existant (si update). Absent → création.
 * @param options  Contexte transaction pour bannières publiques ACF.
 */
export function buildWordPressPayload(
  listing: PublicListing,
  status: WordPressPostStatus,
  wpPostId?: number,
  options: BuildWordPressPayloadOptions = {}
): WordPressUpsertRequest {
  return {
    wpPostId,
    status,
    title: listing.publicTitle ?? DEFAULT_TITLE_FR,
    content: buildContentHtml(listing),
    slug: `rpa-${listing.publicId.slice(0, 8)}`,
    meta: buildMeta(listing, options.transaction, options.now),
  };
}
