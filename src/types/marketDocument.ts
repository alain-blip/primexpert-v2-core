/**
 * Types — Vault global market_documents (rapports macro Altus, Côté Mercier, etc.).
 */

import type { MasterMarketExtraction, MarketReportRegionRow } from '@primexpert/core/documents';

export type MarketDocumentParsingStatus =
  | 'not_applicable'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'verified';

export type MarketDocumentVirusScanStatus = 'pending' | 'clean' | 'infected';

export interface MarketDocumentOpportunityScoring {
  score: number;
  criticalFactors: string[];
  evaluatedAt: string;
}

export interface MarketDocumentRecord {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: string;
  uploadedAtMillis: number;
  documentCategory: 'MARKET_REPORT';
  virusScanStatus: MarketDocumentVirusScanStatus;
  parsingStatus: MarketDocumentParsingStatus;
  parsingError?: string | null;
  parsedAtMillis?: number;
  isValidated?: boolean;
  validatedAtMillis?: number;
  iaOpportunityScoring?: MarketDocumentOpportunityScoring;
  extractedData?: MasterMarketExtraction | Record<string, unknown>;
  /** Pont CRM passif — document issu d'une fiche résidence. */
  bridgeOrigin?: 'residence_passive';
  sourcePropertyId?: string;
  sourcePropertyDocumentId?: string;
  sourcePropertyLabel?: string;
}

export interface MarketMacroStatsEntry {
  regionAdministrative: string;
  regionDisplayName?: string;
  documentType: string;
  sourcePublisher?: string;
  anneeDonnees: number;
  provenance: 'market_report';
  marketDocumentId: string;
  tauxPenetration?: MarketReportRegionRow['tauxPenetration'];
  coutRemplacementNeuf?: MarketReportRegionRow['coutRemplacementNeuf'];
  nouvellesUnitesEnChantier?: number | null;
  projetsEnChantier?: MarketReportRegionRow['projetsEnChantier'];
  injectedAtMillis: number;
  validatedBy: string;
}
