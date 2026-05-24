/**
 * Schéma Zod omnivore — validation HITL Statistiques du marché.
 */

import { z } from 'zod';
import type { MasterMarketExtraction } from './marketReportTypes';
import {
  getMacroRegions,
  masterExtractionHasData,
  type ComparableTransactionRow,
  type MarketReportRegionRow,
  type OperationalBenchmarkRow,
} from './marketReportTypes';

export type {
  ComparableTransactionRow,
  CoutRemplacement,
  MacroTrendsSection,
  MarketReportDocumentType,
  MarketReportExtraction,
  MarketReportRegionRow,
  MasterMarketExtraction,
  OperationalBenchmarkRow,
  ProjetChantier,
  RpaTypePenetration,
} from './marketReportTypes';
export { MARKET_REPORT_DOCUMENT_TYPES, getMacroRegions, marketReportLabelsForPrompt, masterExtractionHasData } from './marketReportTypes';

export const RpaTypePenetrationSchema = z.object({
  typeRpa: z.string().min(1),
  tauxPenetrationPct: z.number().nullable(),
  population75Plus: z.number().nullable().optional(),
  unitesInstallees: z.number().nullable().optional(),
});

export const CoutRemplacementSchema = z.object({
  unite: z.enum(['pi2', 'porte', 'unite']),
  montant: z.number().positive(),
  devise: z.string().default('CAD'),
  notes: z.string().optional(),
});

export const ProjetChantierSchema = z.object({
  nomProjet: z.string().optional(),
  ville: z.string().optional(),
  regionAdministrative: z.string().optional(),
  nouvellesUnites: z.number().nullable().optional(),
  typeProjet: z.string().optional(),
  statut: z.string().optional(),
  livraisonPrevue: z.string().optional(),
});

export const MarketReportRegionRowSchema = z.object({
  regionAdministrative: z.string().min(1),
  regionDisplayName: z.string().optional(),
  tauxPenetration: z.array(RpaTypePenetrationSchema).optional(),
  coutRemplacementNeuf: CoutRemplacementSchema.nullable().optional(),
  nouvellesUnitesEnChantier: z.number().nullable().optional(),
  projetsEnChantier: z.array(ProjetChantierSchema).optional(),
});

export const ComparableTransactionRowSchema = z.object({
  rowId: z.string().min(1),
  adresse: z.string().optional(),
  ville: z.string().min(1),
  regionAdministrative: z.string().optional(),
  dateTransaction: z.string().optional(),
  prixVente: z.number().nullable().optional(),
  nbPortes: z.number().nullable().optional(),
  nbUnites: z.number().nullable().optional(),
  prixParPorte: z.number().nullable().optional(),
  prixParUnite: z.number().nullable().optional(),
  tgaPct: z.number().nullable().optional(),
  superficiePi2: z.number().nullable().optional(),
  prixParPi2: z.number().nullable().optional(),
  vendeur: z.string().optional(),
  acheteur: z.string().optional(),
  typeImmeuble: z.string().optional(),
  anneeConstruction: z.number().nullable().optional(),
});

export const OperationalBenchmarkRowSchema = z.object({
  rowId: z.string().min(1),
  label: z.string().min(1),
  regionAdministrative: z.string().optional(),
  ratioPct: z.number().nullable().optional(),
  montantParPorte: z.number().nullable().optional(),
  montantParUnite: z.number().nullable().optional(),
  montantAnnuel: z.number().nullable().optional(),
  categorie: z.string().optional(),
});

export const MacroTrendsSectionSchema = z.object({
  regions: z.array(MarketReportRegionRowSchema).optional(),
});

export const MasterMarketExtractionSchema = z
  .object({
    documentCategory: z.literal('MARKET_REPORT'),
    documentType: z.string().min(1),
    sourcePublisher: z.string().optional(),
    anneePublication: z.number().int().min(1990).max(2100).optional(),
    anneeDonnees: z.number().int().min(1990).max(2100).optional(),
    macroTrends: MacroTrendsSectionSchema.optional(),
    comparableTransactions: z.array(ComparableTransactionRowSchema).optional(),
    operationalBenchmarks: z.array(OperationalBenchmarkRowSchema).optional(),
    regions: z.array(MarketReportRegionRowSchema).optional(),
  })
  .refine(
    (data) =>
      (data.macroTrends?.regions?.length ?? 0) > 0 ||
      (data.regions?.length ?? 0) > 0 ||
      (data.comparableTransactions?.length ?? 0) > 0 ||
      (data.operationalBenchmarks?.length ?? 0) > 0,
  );

/** @deprecated Alias */
export const MarketReportSchema = MasterMarketExtractionSchema;

export function parseMasterMarketExtraction(raw: unknown): MasterMarketExtraction | null {
  const parsed = MasterMarketExtractionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** @deprecated Alias */
export function parseMarketReportExtraction(raw: unknown): MasterMarketExtraction | null {
  return parseMasterMarketExtraction(raw);
}
