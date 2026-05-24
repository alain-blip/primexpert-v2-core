/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/documents/
 * Régénéré : functions/scripts/sync-core-documents.cjs (prebuild)
 */
/**
 * Types SSOT — extraction omnivore Statistiques du marché (sans Zod, sync functions).
 */

export interface RpaTypePenetration {
  typeRpa: string;
  tauxPenetrationPct: number | null;
  population75Plus?: number | null;
  unitesInstallees?: number | null;
}

export interface CoutRemplacement {
  unite: 'pi2' | 'porte' | 'unite';
  montant: number;
  devise: string;
  notes?: string;
}

export interface ProjetChantier {
  nomProjet?: string;
  ville?: string;
  regionAdministrative?: string;
  nouvellesUnites?: number | null;
  typeProjet?: string;
  statut?: string;
  livraisonPrevue?: string;
}

export interface MarketReportRegionRow {
  regionAdministrative: string;
  regionDisplayName?: string;
  tauxPenetration?: RpaTypePenetration[];
  coutRemplacementNeuf?: CoutRemplacement | null;
  nouvellesUnitesEnChantier?: number | null;
  projetsEnChantier?: ProjetChantier[];
}

/** Transaction comparable — rapport évaluateur, registre ventes, ACM. */
export interface ComparableTransactionRow {
  rowId: string;
  adresse?: string;
  ville: string;
  regionAdministrative?: string;
  dateTransaction?: string;
  prixVente?: number | null;
  /** @deprecated Préférer nbUnites — conservé pour rétrocompatibilité Firestore / extraction IA. */
  nbPortes?: number | null;
  nbUnites?: number | null;
  /** @deprecated Préférer prixParUnite */
  prixParPorte?: number | null;
  prixParUnite?: number | null;
  tgaPct?: number | null;
  superficiePi2?: number | null;
  prixParPi2?: number | null;
  anneeConstruction?: number | null;
  vendeur?: string;
  acheteur?: string;
  typeImmeuble?: string;
}

/** Ratios et benchmarks opérationnels (dépenses/unité, RDE, etc.). */
export interface OperationalBenchmarkRow {
  rowId: string;
  label: string;
  regionAdministrative?: string;
  ratioPct?: number | null;
  /** @deprecated Préférer montantParUnite */
  montantParPorte?: number | null;
  montantParUnite?: number | null;
  montantAnnuel?: number | null;
  categorie?: string;
}

export interface MacroTrendsSection {
  regions?: MarketReportRegionRow[];
}

/** Schéma omnivore — sections optionnelles (au moins une requise à la validation). */
export interface MasterMarketExtraction {
  documentCategory: 'MARKET_REPORT';
  documentType: string;
  sourcePublisher?: string;
  anneePublication?: number;
  anneeDonnees?: number;
  macroTrends?: MacroTrendsSection;
  comparableTransactions?: ComparableTransactionRow[];
  operationalBenchmarks?: OperationalBenchmarkRow[];
  /** Legacy — régions à la racine (rétrocompatibilité). */
  regions?: MarketReportRegionRow[];
}

/** @deprecated Alias — préférer MasterMarketExtraction */
export type MarketReportExtraction = MasterMarketExtraction;

export const MARKET_REPORT_DOCUMENT_TYPES = [
  'Guide Altus — coûts de remplacement et marché RPA',
  'Rapport Côté Mercier — marché des résidences pour aînés (RPA)',
  'Brief démographique — pénétration 75 ans et plus',
  'Rapport macro-économique — inventaire en construction RPA',
  "Rapport d'évaluation — transactions et comparables",
  'Registre de transactions immobilières — multilogement / RPA',
  'Analyse comparative de marché (ACM) — ventes récentes',
] as const;

export type MarketReportDocumentType = (typeof MARKET_REPORT_DOCUMENT_TYPES)[number];

export function marketReportLabelsForPrompt(): string {
  return MARKET_REPORT_DOCUMENT_TYPES.map((l) => `- "${l}"`).join('\n');
}

export function getMacroRegions(extraction: MasterMarketExtraction): MarketReportRegionRow[] {
  if (extraction.macroTrends?.regions?.length) return extraction.macroTrends.regions;
  return extraction.regions ?? [];
}

export function masterExtractionHasData(extraction: MasterMarketExtraction): boolean {
  return (
    getMacroRegions(extraction).length > 0 ||
    (extraction.comparableTransactions?.length ?? 0) > 0 ||
    (extraction.operationalBenchmarks?.length ?? 0) > 0
  );
}
