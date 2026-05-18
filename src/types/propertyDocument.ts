/** Diligence raisonnable — documents rattachés à une fiche résidence. */

export type PropertyDocumentCategory = 'financier' | 'technique' | 'legal';

export type VirusScanStatus = 'pending' | 'clean' | 'infected';

export type ParsingStatus = 'not_applicable' | 'pending' | 'completed' | 'failed';

/** Données extraites par le parseur IA (structure évolutive). */
export interface PropertyDocumentExtractedData {
  /** Montants détectés (ex. taxes, loyers). */
  amounts?: Array<{ label: string; value: number; currency?: string }>;
  /** Dates clés extraites. */
  dates?: Array<{ label: string; isoDate: string }>;
  /** Taxes / impôts identifiés. */
  taxes?: Array<{ label: string; amount?: number; year?: number }>;
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
