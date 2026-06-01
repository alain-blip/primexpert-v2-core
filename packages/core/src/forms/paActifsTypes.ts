/**
 * Promesse d'achat d'actifs — données de rendu (SSOT, sans OpenXML).
 */

import type { PromesseAchatInput } from '../transaction/types';
import type { OffreTroncInput } from '../transaction/offreTronc';

/** Contexte territorial ACM V3.2 — aligné sur useTerritorialCompetition. */
export interface PaActifsTerritorialContext {
  medianTgaPct: number | null;
  sampleCount: number;
  regionAdministrative: string | null;
  classeImmeuble: string | null;
  filterScope?: 'REGION_CLASS' | 'REGION' | 'ALL';
}

export interface PaActifsBrokerProfile {
  displayName: string;
  licenseNumber: string;
  agencyName: string;
  email?: string;
  phone?: string;
}

export interface PaActifsVendorParty {
  legalName: string;
  address: string;
  presidentName?: string;
  secretaryName?: string;
}

export interface PaActifsBuyerParty {
  fullName: string;
  address?: string;
  authorizedSignatory?: string;
}

export interface PaActifsResidenceDesignation {
  commercialName: string;
  civicAddress: string;
  cadastralDesignation?: string;
  superficiePi2?: string;
  city?: string;
  regionAdministrative?: string;
}

/** Montants financiers — tronc offre V3.2 + référence ACM. */
export interface PaActifsFinancialTerms {
  prixTotal: number | null;
  miseDeFonds: number | null;
  balancePrixVente: number | null;
  soldeNouvelEmprunt: number | null;
  revenuNetExploitation: number | null;
  revenuBrutEffectif: number | null;
  /** Taux de capitalisation global (TGA) médian territorial dynamique (%) */
  tgaMedianTerritorialPct: number | null;
  /** Ajustement qualitatif appliqué (%) */
  tgaAjustementQualitatifPct: number;
  /** TGA retenu pour valeur indicative (%) */
  tgaAppliquePct: number | null;
  /** Valeur marchande indicative calculée par le module financier central. */
  valeurMarchandeIndicative: number | null;
  territorialSampleCount: number;
}

export interface PaActifsBusinessClauses {
  /** § 7.2 — Maintien des opérations (texte légal immuable) */
  maintienOperationsVersion: '7.2';
  /** § 9.0 — Heures de transition incluses */
  transitionHeuresMax: number;
  /** § 9.0 — Jours consécutifs max */
  transitionJoursMax: number;
  /** § 10.0 — Rayon non-concurrence (km) */
  nonConcurrenceRayonKm: number;
  /** § 10.0 — Durée (années) */
  nonConcurrenceAnnees: number;
}

export interface PaActifsSignatureBlock {
  lieu?: string;
  date?: string;
  heure?: string;
}

/** Payload complet pour renderPaActifsToHtml — immuable après build. */
export interface PaActifsRenderData {
  locale: 'fr' | 'en';
  generatedAtIso: string;
  referenceId?: string;
  buyer: PaActifsBuyerParty;
  vendor: PaActifsVendorParty;
  broker: PaActifsBrokerProfile;
  residence: PaActifsResidenceDesignation;
  financial: PaActifsFinancialTerms;
  clauses: PaActifsBusinessClauses;
  promesse: PromesseAchatInput;
  offre: OffreTroncInput;
  territorial: PaActifsTerritorialContext | null;
  signatures: PaActifsSignatureBlock;
}

export interface BuildPaActifsRenderDataInput {
  locale?: 'fr' | 'en';
  referenceId?: string;
  residence: Record<string, unknown>;
  residenceDoc?: Record<string, unknown> | null;
  financialData?: Record<string, unknown> | null;
  promesseDoc?: Record<string, unknown> | null;
  broker: PaActifsBrokerProfile;
  buyer?: Partial<PaActifsBuyerParty>;
  vendor?: Partial<PaActifsVendorParty>;
  territorial?: PaActifsTerritorialContext | null;
  qualitativeTgaAdjustmentPct?: number;
  clauses?: Partial<PaActifsBusinessClauses>;
  signatures?: PaActifsSignatureBlock;
}
