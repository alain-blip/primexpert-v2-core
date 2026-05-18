/** Diligence raisonnable — documents rattachés à une fiche résidence. */

export type PropertyDocumentCategory = 'financier' | 'technique' | 'legal';

export type VirusScanStatus = 'pending' | 'clean' | 'infected';

export type ParsingStatus =
  | 'not_applicable'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'verified';

/** Données extraites par le parseur IA (structure évolutive). */
export interface PropertyDocumentExtractedData {
  /** Montants détectés (ex. taxes, loyers). */
  amounts?: Array<{ label: string; value: number; currency?: string }>;
  /** Dates clés extraites. */
  dates?: Array<{ label: string; isoDate: string }>;
  /** Taxes / impôts identifiés. */
  taxes?: Array<{ label: string; amount?: number; year?: number }>;
  revenus?: Array<{ label: string; value: number }>;
  depenses?: Array<{ label: string; value: number }>;
  annee?: number;
  /** Immeubles comparables (rapport d'évaluation). */
  comparables?: Array<{
    label: string;
    salePrice?: number;
    capRatePct?: number;
    regionKey?: string;
  }>;
  /** Champs bruts non structurés (transition). */
  raw?: Record<string, unknown>;
}

export interface PropertyDocumentRecord {
  id: string;
  propertyId: string;
  category: PropertyDocumentCategory;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAtMillis: number;
  uploadedBy: string;
  virusScanStatus: VirusScanStatus;
  parsingStatus: ParsingStatus;
  /** true si PDF/tableur dans dossier Financier — déclenche le parseur après scan clean. */
  parsingEligible: boolean;
  extractedData: PropertyDocumentExtractedData;
  /** Courtier a validé et injecté les montants sélectionnés. */
  isValidated?: boolean;
  validatedAtMillis?: number;
  /** Pièce rattachée au dossier promesse d'achat. */
  promesseScope?: boolean;
  promesseDocLabel?: string;
}

export interface PropertyDocumentCategoryDef {
  id: PropertyDocumentCategory;
  labelFr: string;
  labelEn: string;
}

export const PROPERTY_DOCUMENT_CATEGORIES: PropertyDocumentCategoryDef[] = [
  {
    id: 'financier',
    labelFr: 'Financier',
    labelEn: 'Financial',
  },
  {
    id: 'technique',
    labelFr: 'Technique',
    labelEn: 'Technical',
  },
  {
    id: 'legal',
    labelFr: 'Légal',
    labelEn: 'Legal',
  },
];
