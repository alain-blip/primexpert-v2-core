/**
 * Promesse d'achat d'actifs — gabarit structurel immuable (sans OpenXML).
 * Texte juridique statique + jetons SSOT injectés au rendu.
 */

export type PaActifsBlockKind = 'heading' | 'static' | 'dynamic';

export interface PaActifsTemplateBlock {
  id: string;
  kind: PaActifsBlockKind;
  /** Texte fixe (kind heading | static) */
  text?: string;
  /** Clé logique pour paragraphes assemblés côté render (kind dynamic) */
  dynamicKey?: keyof typeof PA_ACTIFS_DYNAMIC_KEYS;
}

export interface PaActifsTemplateSection {
  id: string;
  number: string;
  titleFr: string;
  titleEn: string;
  blocks: PaActifsTemplateBlock[];
}

/** Clés des paragraphes dynamiques — implémentés dans renderPaActifsToHtml. */
export const PA_ACTIFS_DYNAMIC_KEYS = {
  partiesHeader: 'partiesHeader',
  preamble: 'preamble',
  designationEntreprise: 'designationEntreprise',
  prixEtPaiement: 'prixEtPaiement',
  referenceAcmFinanciere: 'referenceAcmFinanciere',
  maintienOperations72: 'maintienOperations72',
  periodeTransition90: 'periodeTransition90',
  nonConcurrence100: 'nonConcurrence100',
  delaiAcceptation: 'delaiAcceptation',
  blocSignatures: 'blocSignatures',
} as const;

/** Texte légal § 7.2 — immuable (extrait gabarit ACTIFS v3). */
export const PA_ACTIFS_CLAUSE_7_2_MAINTIEN_FR = `Maintien des opérations et interdiction de changements majeurs — Entre la date de signature de la présente promesse d'achat et la date de signature de l'acte de vente notarié, le vendeur s'engage à maintenir les opérations de l'entreprise dans le cours normal des affaires, en adoptant les mêmes pratiques de gestion et d'exploitation qu'avant la présente date. Sans l'accord écrit préalable de l'acheteur, le vendeur s'interdit d'apporter des changements majeurs, y compris, mais sans s'y limiter : toute modification significative des prix, des politiques de crédit client, des campagnes marketing ou de la structure des contrats clients existants; toute augmentation substantielle des dépenses d'exploitation non prévue au budget courant; toute vente, cession ou location d'actifs essentiels à l'exploitation de la résidence pour personnes âgées (RPA).`;

/** § 9.0 — squelette avec paramètres heures/jours. */
export const PA_ACTIFS_CLAUSE_9_0_TRANSITION_FR =
  `Période de transition — Le vendeur s'engage à offrir une période de transition à l'acheteur afin de faciliter le transfert des connaissances et des opérations. Cette période est fixée à un maximum de {{transitionHeuresMax}} heures, réparties sur une durée maximale de {{transitionJoursMax}} jours consécutifs suivant la date de signature de l'acte de vente notarié. Ces heures de transition seront fournies par le vendeur ou ses représentants désignés, sans frais supplémentaires pour l'acheteur. Toute heure au-delà de ce plafond fera l'objet d'une entente distincte entre les parties.`;

/** § 10.0 — non-concurrence. */
export const PA_ACTIFS_CLAUSE_10_0_NON_CONCURRENCE_FR =
  `Clause de non-concurrence — Le vendeur s'engage, pour une période de {{nonConcurrenceAnnees}} ans à compter de la date de signature de l'acte de vente notarié, à ne pas, directement ou indirectement, exploiter, posséder, gérer, financer ou participer à une entreprise dont les activités sont concurrentes à celles de l'entreprise vendue à l'acheteur, dans un rayon de {{nonConcurrenceRayonKm}} kilomètres autour de la résidence. Ce territoire et cette durée sont considérés comme raisonnables et nécessaires à la protection des intérêts légitimes de l'acheteur.`;

export const PA_ACTIFS_TEMPLATE_SECTIONS: PaActifsTemplateSection[] = [
  {
    id: 'identification',
    number: '1',
    titleFr: 'Identification des parties et désignation de la RPA',
    titleEn: 'Party identification and RPA designation',
    blocks: [
      { id: 'h1', kind: 'heading', text: 'PROMESSE D\'ACHAT D\'ACTIFS' },
      { id: 'parties', kind: 'dynamic', dynamicKey: 'partiesHeader' },
      { id: 'pre', kind: 'dynamic', dynamicKey: 'preamble' },
      { id: 'des', kind: 'dynamic', dynamicKey: 'designationEntreprise' },
    ],
  },
  {
    id: 'financier',
    number: '2',
    titleFr: 'Conditions financières',
    titleEn: 'Financial terms',
    blocks: [
      { id: 'prix', kind: 'dynamic', dynamicKey: 'prixEtPaiement' },
      { id: 'acm', kind: 'dynamic', dynamicKey: 'referenceAcmFinanciere' },
    ],
  },
  {
    id: 'affaires',
    number: '3',
    titleFr: 'Clauses d\'affaires',
    titleEn: 'Business covenants',
    blocks: [
      { id: 'c72', kind: 'dynamic', dynamicKey: 'maintienOperations72' },
      { id: 'c90', kind: 'dynamic', dynamicKey: 'periodeTransition90' },
      { id: 'c100', kind: 'dynamic', dynamicKey: 'nonConcurrence100' },
    ],
  },
  {
    id: 'cloture',
    number: '4',
    titleFr: 'Acceptation et signatures',
    titleEn: 'Acceptance and signatures',
    blocks: [
      { id: 'delai', kind: 'dynamic', dynamicKey: 'delaiAcceptation' },
      { id: 'sig', kind: 'dynamic', dynamicKey: 'blocSignatures' },
    ],
  },
];
