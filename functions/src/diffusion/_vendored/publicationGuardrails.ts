/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 *
 * Source canonique : packages/core/src/diffusion/
 * Régénéré par   : functions/scripts/sync-core-diffusion.cjs (prebuild)
 */
/**
 * Moteur de conformité — 28 points Due Diligence OACIQ (publication web).
 *
 * Fonction pure : aucune dépendance UI / Firestore.
 * Consomme la résidence brute + la vue `PublicListing` déjà anonymisée (Jour 1).
 */

import { safeNum } from './safeNumbers';
import { PRICE_RANGE_UNKNOWN } from './priceRanges';
import {
  DATA_HEALTH_STATUS,
  PUBLICATION_GUARDRAIL_STATUS,
  type PublicationGuardrailResult,
  type PublicationGuardrailsEvaluation,
  type PublicationGuardrailStatus,
  type PublicListing,
  type ResidenceForPublicationGuardrails,
} from './types';

export const PUBLICATION_GUARDRAIL_MAX_SCORE = 28 as const;

const MIN_PUBLIC_DESCRIPTION_CHARS = 200;

type RuleEvaluator = (ctx: {
  residence: ResidenceForPublicationGuardrails;
  listing: PublicListing;
}) => PublicationGuardrailResult;

function pickString(...values: ReadonlyArray<unknown>): string {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function pickPositiveNumber(...values: ReadonlyArray<unknown>): number | null {
  for (const v of values) {
    const n = safeNum(v);
    if (n != null && n > 0) return n;
  }
  return null;
}

function normalizeToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

function resolvePipelineStage(residence: ResidenceForPublicationGuardrails): string {
  return normalizeToken(
    residence.stage ??
      residence.pipelineStatus ??
      residence.status ??
      residence.statut ??
      ''
  );
}

function isMandateStage(stageToken: string, residence: ResidenceForPublicationGuardrails): boolean {
  if (stageToken === 'MANDAT' || stageToken === 'ENMANDAT' || stageToken === 'MANDATE') {
    return true;
  }
  const status = normalizeToken(residence.status);
  return status === 'MANDAT' || status === 'MANDATE' || status === 'ENMANDAT';
}

function resolveDataHealth(residence: ResidenceForPublicationGuardrails): string {
  return normalizeToken(residence.dataHealth ?? '');
}

function isRpaAsset(residence: ResidenceForPublicationGuardrails): boolean {
  const niche = normalizeToken(residence.assetNiche);
  if (niche === 'CPE' || niche === 'PLEX') return false;
  if (niche === 'RPA') return true;
  const type = pickString(residence.residenceType).toUpperCase();
  return type.includes('RPA') || type === '';
}

function hasMsssOrRqraPermit(residence: ResidenceForPublicationGuardrails): boolean {
  return Boolean(
    pickString(
      residence.numeroPermisMsss,
      residence.numeroRegistreMsss,
      residence.codeMSSS,
      residence.msssNumber,
      residence.permitNumber,
      residence.numeroRqra,
      residence.rqraNumber,
      residence.numeroAdhesionRqra
    )
  );
}

function result(
  id: string,
  labelFr: string,
  labelEn: string,
  status: PublicationGuardrailStatus,
  blocking: boolean,
  detailFr?: string,
  detailEn?: string
): PublicationGuardrailResult {
  return { id, labelFr, labelEn, status, blocking, detailFr, detailEn };
}

function pass(id: string, labelFr: string, labelEn: string): PublicationGuardrailResult {
  return result(id, labelFr, labelEn, PUBLICATION_GUARDRAIL_STATUS.PASS, false);
}

function warn(
  id: string,
  labelFr: string,
  labelEn: string,
  detailFr: string,
  detailEn: string,
  blocking = false
): PublicationGuardrailResult {
  return result(id, labelFr, labelEn, PUBLICATION_GUARDRAIL_STATUS.WARN, blocking, detailFr, detailEn);
}

function fail(
  id: string,
  labelFr: string,
  labelEn: string,
  detailFr: string,
  detailEn: string,
  blocking = true
): PublicationGuardrailResult {
  return result(id, labelFr, labelEn, PUBLICATION_GUARDRAIL_STATUS.FAIL, blocking, detailFr, detailEn);
}

const RULES: ReadonlyArray<RuleEvaluator> = [
  // 1 — Pipeline mandat
  ({ residence }) => {
    const stage = resolvePipelineStage(residence);
    if (isMandateStage(stage, residence)) {
      return pass(
        'pipeline_stage_mandate',
        'Statut pipeline : en mandat (mise en marché)',
        'Pipeline status: listed (on market)'
      );
    }
    return fail(
      'pipeline_stage_mandate',
      'Statut pipeline : en mandat (mise en marché)',
      'Pipeline status: listed (on market)',
      `Étape actuelle : ${stage || 'non définie'} — la publication exige un mandat actif.`,
      `Current stage: ${stage || 'undefined'} — publishing requires an active listing mandate.`
    );
  },

  // 2 — Santé PUBLIABLE
  ({ residence }) => {
    const health = resolveDataHealth(residence);
    if (health === DATA_HEALTH_STATUS.PUBLIABLE) {
      return pass(
        'data_health_publishable',
        'Santé des données : publiable',
        'Data health: publishable'
      );
    }
    if (health === DATA_HEALTH_STATUS.BLOQUE) {
      return fail(
        'data_health_publishable',
        'Santé des données : publiable',
        'Data health: publishable',
        'Dossier bloqué — corrigez les anomalies avant diffusion.',
        'Record blocked — resolve anomalies before syndication.'
      );
    }
    return fail(
      'data_health_publishable',
      'Santé des données : publiable',
      'Data health: publishable',
      `Statut actuel : ${health || 'INCOMPLET'} — complétez la fiche pour atteindre PUBLIABLE.`,
      `Current status: ${health || 'INCOMPLETE'} — complete the record to reach PUBLISHABLE.`
    );
  },

  // 3 — Prix demandé (privé)
  ({ residence }) => {
    const price = pickPositiveNumber(
      residence.askingPrice,
      residence.prixDemande,
      residence.prix,
      residence.publicPrice
    );
    if (price != null) {
      return pass(
        'asking_price_present',
        'Prix demandé renseigné (donnée privée)',
        'Asking price on file (private data)'
      );
    }
    return fail(
      'asking_price_present',
      'Prix demandé renseigné (donnée privée)',
      'Asking price on file (private data)',
      'Le prix demandé est obligatoire pour calculer la fourchette anonymisée.',
      'Asking price is required to compute the anonymized price range.'
    );
  },

  // 4 — Permis MSSS / RQRA (RPA)
  ({ residence }) => {
    if (!isRpaAsset(residence)) {
      return pass(
        'regulatory_permit_rpa',
        'Permis MSSS ou adhésion RQRA (si RPA)',
        'MSSS permit or RQRA membership (RPA assets)'
      );
    }
    if (hasMsssOrRqraPermit(residence)) {
      return pass(
        'regulatory_permit_rpa',
        'Permis MSSS ou adhésion RQRA (si RPA)',
        'MSSS permit or RQRA membership (RPA assets)'
      );
    }
    return fail(
      'regulatory_permit_rpa',
      'Permis MSSS ou adhésion RQRA (si RPA)',
      'MSSS permit or RQRA membership (RPA assets)',
      'Numéro de permis MSSS ou identifiant RQRA requis pour une résidence pour aînés (RPA).',
      'MSSS permit number or RQRA identifier required for a retirement home (RPA).'
    );
  },

  // 5 — Visuel public
  ({ residence, listing }) => {
    const url = pickString(residence.publicVisualUrl, listing.publicVisualUrl);
    if (url.startsWith('http')) {
      return pass(
        'public_visual_url',
        'Visuel public disponible (image générique)',
        'Public visual available (generic image)'
      );
    }
    return fail(
      'public_visual_url',
      'Visuel public disponible (image générique)',
      'Public visual available (generic image)',
      'Générez ou téléversez une image publique (Imagen 3 ou banque maison).',
      'Generate or upload a public image (Imagen 3 or stock library).'
    );
  },

  // 6 — Description ≥ 200 caractères
  ({ residence, listing }) => {
    const desc = pickString(residence.publicDescription, listing.publicDescription);
    if (desc.length >= MIN_PUBLIC_DESCRIPTION_CHARS) {
      return pass(
        'public_description_length',
        `Description publique ≥ ${MIN_PUBLIC_DESCRIPTION_CHARS} caractères`,
        `Public description ≥ ${MIN_PUBLIC_DESCRIPTION_CHARS} characters`
      );
    }
    return fail(
      'public_description_length',
      `Description publique ≥ ${MIN_PUBLIC_DESCRIPTION_CHARS} caractères`,
      `Public description ≥ ${MIN_PUBLIC_DESCRIPTION_CHARS} characters`,
      `Longueur actuelle : ${desc.length} caractères.`,
      `Current length: ${desc.length} characters.`
    );
  },

  // 7 — Titre marketing public
  ({ residence, listing }) => {
    const title = pickString(residence.publicTitle, listing.publicTitle);
    if (title.length >= 8) {
      return pass(
        'public_title_present',
        'Titre marketing public renseigné',
        'Public marketing title provided'
      );
    }
    return fail(
      'public_title_present',
      'Titre marketing public renseigné',
      'Public marketing title provided',
      'Le titre public doit être distinct du nom commercial réel.',
      'Public title must differ from the actual commercial name.'
    );
  },

  // 8 — Titre ≠ nom commercial (anti-fuite)
  ({ residence, listing }) => {
    const title = pickString(residence.publicTitle, listing.publicTitle).toLowerCase();
    const commercial = pickString(
      residence.nomCommercial,
      residence.name
    ).toLowerCase();
    if (!commercial || !title || title !== commercial) {
      return pass(
        'title_not_commercial_name',
        'Titre public distinct du nom commercial',
        'Public title distinct from commercial name'
      );
    }
    return fail(
      'title_not_commercial_name',
      'Titre public distinct du nom commercial',
      'Public title distinct from commercial name',
      'Le titre public ne doit pas reproduire le nom commercial (Loi 25).',
      'Public title must not copy the commercial name (Law 25).'
    );
  },

  // 9 — Unités
  ({ residence, listing }) => {
    const units = pickPositiveNumber(
      residence.nombreUnites,
      residence.nombreUnitesTotal,
      residence.unitsCount,
      listing.nombreUnites
    );
    if (units != null && units > 0) {
      return pass('units_count', 'Nombre d’unités renseigné', 'Unit count on file');
    }
    return fail(
      'units_count',
      'Nombre d’unités renseigné',
      'Unit count on file',
      'Indiquez la capacité (unités/lits) pour l’anonymisation.',
      'Provide capacity (units/beds) for anonymization.'
    );
  },

  // 10 — Fourchette de prix anonymisée
  ({ listing }) => {
    if (listing.fourchettePrix && listing.fourchettePrix !== PRICE_RANGE_UNKNOWN) {
      return pass(
        'price_range_anonymized',
        'Fourchette de prix anonymisée calculée',
        'Anonymized price range computed'
      );
    }
    return fail(
      'price_range_anonymized',
      'Fourchette de prix anonymisée calculée',
      'Anonymized price range computed',
      'Fourchette indisponible — vérifiez le prix demandé.',
      'Range unavailable — verify asking price.'
    );
  },

  // 11 — Région publique
  ({ listing }) => {
    if (pickString(listing.region)) {
      return pass(
        'public_region_present',
        'Région administrative publiée (anonymisée)',
        'Administrative region published (anonymized)'
      );
    }
    return warn(
      'public_region_present',
      'Région administrative publiée (anonymisée)',
      'Administrative region published (anonymized)',
      'Région absente — complétez l’identité géographique.',
      'Region missing — complete geographic identity.'
    );
  },

  // 12 — Secteur large (ville jamais publiée)
  ({ listing }) => {
    if (pickString(listing.secteur)) {
      return pass(
        'public_sector_mapped',
        'Secteur large mappé (ville non exposée)',
        'Broad sector mapped (city not exposed)'
      );
    }
    return warn(
      'public_sector_mapped',
      'Secteur large mappé (ville non exposée)',
      'Broad sector mapped (city not exposed)',
      'Ville non reconnue — le secteur public sera omis (conforme).',
      'City not mapped — public sector will be omitted (compliant).'
    );
  },

  // 13 — Syndication RPAaVendre
  ({ residence, listing }) => {
    if (!isRpaAsset(residence)) {
      return pass(
        'syndication_rpa_portal',
        'Syndication RPAaVendre.com activée',
        'RPAaVendre.com syndication enabled'
      );
    }
    if (listing.syndication.rpaAVendre === true || residence.syndication?.rpaAVendre === true) {
      return pass(
        'syndication_rpa_portal',
        'Syndication RPAaVendre.com activée',
        'RPAaVendre.com syndication enabled'
      );
    }
    return fail(
      'syndication_rpa_portal',
      'Syndication RPAaVendre.com activée',
      'RPAaVendre.com syndication enabled',
      'Activez le pavé RPAaVendre.com avant la publication.',
      'Enable the RPAaVendre.com tile before publishing.'
    );
  },

  // 14 — Type de résidence
  ({ residence, listing }) => {
    if (pickString(residence.residenceType, listing.residenceType)) {
      return pass('residence_type', 'Type de résidence défini', 'Residence type defined');
    }
    return warn(
      'residence_type',
      'Type de résidence défini',
      'Residence type defined',
      'Type manquant — défaut RPA appliqué.',
      'Type missing — RPA default applied.'
    );
  },

  // 15 — Courtier responsable
  ({ residence }) => {
    if (pickString(residence.courtiersResponsables, residence.courtierResponsable)) {
      return pass(
        'broker_of_record',
        'Courtier responsable identifié',
        'Listing broker identified'
      );
    }
    return warn(
      'broker_of_record',
      'Courtier responsable identifié',
      'Listing broker identified',
      'Courtier responsable absent — requis pour la conformité OACIQ.',
      'Responsible broker missing — required for OACIQ compliance.'
    );
  },

  // 16 — Adresse civique (privée, complétude)
  ({ residence }) => {
    if (pickString(residence.address, residence.adresse)) {
      return pass(
        'private_address_on_file',
        'Adresse civique complète (privée)',
        'Full civic address on file (private)'
      );
    }
    return warn(
      'private_address_on_file',
      'Adresse civique complète (privée)',
      'Full civic address on file (private)',
      'Adresse incomplète — non publiée, mais requise en dossier.',
      'Address incomplete — not published, but required in file.'
    );
  },

  // 17 — Ville (privée)
  ({ residence }) => {
    if (pickString(residence.ville, residence.municipalite, residence.city)) {
      return pass('private_city_on_file', 'Ville renseignée (privée)', 'City on file (private)');
    }
    return warn(
      'private_city_on_file',
      'Ville renseignée (privée)',
      'City on file (private)',
      'Ville manquante — nécessaire au mapping secteur.',
      'City missing — required for sector mapping.'
    );
  },

  // 18 — Contrat de courtage
  ({ residence }) => {
    if (residence.contratCourtageSigne === true) {
      return pass(
        'listing_agreement',
        'Contrat de courtage confirmé',
        'Listing agreement confirmed'
      );
    }
    if (pickString(residence.contratCourtage)) {
      return pass(
        'listing_agreement',
        'Contrat de courtage confirmé',
        'Listing agreement confirmed'
      );
    }
    return warn(
      'listing_agreement',
      'Contrat de courtage confirmé',
      'Listing agreement confirmed',
      'Référence contrat absente — vérifiez l’espace Documents.',
      'Agreement reference missing — check Documents space.'
    );
  },

  // 19 — Annexe G
  ({ residence }) => {
    if (residence.annexeGActive === true) {
      return pass(
        'annexe_g_confidentiality',
        'Annexe G — mode confidentiel',
        'Schedule G — confidential mode'
      );
    }
    return warn(
      'annexe_g_confidentiality',
      'Annexe G — mode confidentiel',
      'Schedule G — confidential mode',
      'Annexe G non activée — recommandé pour la vente confidentielle.',
      'Schedule G not active — recommended for confidential sale.'
    );
  },

  // 20 — Téléphone contact
  ({ residence }) => {
    if (pickString(residence.telephone)) {
      return pass('seller_phone', 'Téléphone vendeur (privé)', 'Seller phone (private)');
    }
    return warn(
      'seller_phone',
      'Téléphone vendeur (privé)',
      'Seller phone (private)',
      'Coordonnée téléphonique manquante.',
      'Phone contact missing.'
    );
  },

  // 21 — Courriel contact
  ({ residence }) => {
    if (pickString(residence.courriel, residence.email)) {
      return pass('seller_email', 'Courriel vendeur (privé)', 'Seller email (private)');
    }
    return warn(
      'seller_email',
      'Courriel vendeur (privé)',
      'Seller email (private)',
      'Courriel vendeur manquant.',
      'Seller email missing.'
    );
  },

  // 22 — Taux d’occupation anonymisé
  ({ listing }) => {
    if (listing.tauxOccupation != null && listing.tauxOccupation >= 0) {
      return pass(
        'occupancy_anonymized',
        'Taux d’occupation arrondi (public)',
        'Rounded occupancy rate (public)'
      );
    }
    return warn(
      'occupancy_anonymized',
      'Taux d’occupation arrondi (public)',
      'Rounded occupancy rate (public)',
      'Taux d’occupation absent — recommandé pour la performance.',
      'Occupancy rate missing — recommended for performance.'
    );
  },

  // 23 — Catégorie visuelle
  ({ listing }) => {
    if (pickString(listing.categorieVisuelle)) {
      return pass(
        'visual_category',
        'Catégorie visuelle dérivée (Imagen 3)',
        'Visual category derived (Imagen 3)'
      );
    }
    return warn(
      'visual_category',
      'Catégorie visuelle dérivée (Imagen 3)',
      'Visual category derived (Imagen 3)',
      'Catégorie visuelle non calculée.',
      'Visual category not computed.'
    );
  },

  // 24 — Profil acheteur
  ({ listing }) => {
    if (pickString(listing.buyerTargetProfile)) {
      return pass('buyer_target_profile', 'Profil acheteur cible défini', 'Buyer target profile set');
    }
    return warn(
      'buyer_target_profile',
      'Profil acheteur cible défini',
      'Buyer target profile set',
      'Profil acheteur par défaut « OUVERT ».',
      'Default buyer profile « OPEN ».'
    );
  },

  // 25 — Inclusions renseignées (recommandé)
  ({ residence, listing }) => {
    if (pickString(residence.publicInclusions, listing.publicInclusions)) {
      return pass(
        'sale_inclusions',
        'Inclusions de la vente documentées',
        'Sale inclusions documented'
      );
    }
    return warn(
      'sale_inclusions',
      'Inclusions de la vente documentées',
      'Sale inclusions documented',
      'Inclusions non précisées.',
      'Inclusions not specified.'
    );
  },

  // 26 — Exclusions renseignées (recommandé)
  ({ residence, listing }) => {
    if (pickString(residence.publicExclusions, listing.publicExclusions)) {
      return pass(
        'sale_exclusions',
        'Exclusions de la vente documentées',
        'Sale exclusions documented'
      );
    }
    return warn(
      'sale_exclusions',
      'Exclusions de la vente documentées',
      'Sale exclusions documented',
      'Exclusions non précisées.',
      'Exclusions not specified.'
    );
  },

  // 27 — Aucune ville dans le listing public (invariant structurel)
  () =>
    pass(
      'no_city_in_public_listing',
      'Aucune adresse civique dans le silo public',
      'No civic address in public silo'
    ),

  // 28 — Whitelist silo public complète
  ({ listing }) => {
    if (pickString(listing.publicId) && pickString(listing.fourchettePrix)) {
      return pass(
        'public_listing_whitelist_ready',
        'Document public_listings prêt (whitelist)',
        'public_listings document ready (whitelist)'
      );
    }
    return fail(
      'public_listing_whitelist_ready',
      'Document public_listings prêt (whitelist)',
      'public_listings document ready (whitelist)',
      'Anonymisation incomplète — regénérez l’aperçu public.',
      'Incomplete anonymization — regenerate public preview.'
    );
  },
];

/**
 * Évalue les 28 garde-fous de publication.
 *
 * `isPublishable` est faux dès qu’une règle **bloquante** est en échec (`FAIL`).
 * Les avertissements (`WARN`) n’empêchent pas la publication mais réduisent le score.
 */
export function evaluatePublicationGuardrails(
  residence: ResidenceForPublicationGuardrails,
  publicListing: PublicListing
): PublicationGuardrailsEvaluation {
  const results = RULES.map((rule) => rule({ residence, listing: publicListing }));
  const score = results.filter((r) => r.status === PUBLICATION_GUARDRAIL_STATUS.PASS).length;
  const maxScore = PUBLICATION_GUARDRAIL_MAX_SCORE;
  const isPublishable = !results.some(
    (r) => r.blocking && r.status === PUBLICATION_GUARDRAIL_STATUS.FAIL
  );
  const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    isPublishable,
    score,
    maxScore,
    scorePercent,
    results,
  };
}
