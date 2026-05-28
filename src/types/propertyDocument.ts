/** Diligence raisonnable — documents rattachés à une fiche résidence. */

export type PropertyDocumentCategory = 'financier' | 'technique' | 'legal';

export type VirusScanStatus = 'pending' | 'clean' | 'infected';

export type ParsingStatus =
  | 'not_applicable'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'verified';

/** Types d’extraction structurée (legacy + pipeline). */
export type StructuredExtractionKind =
  | 'certificat_localisation'
  | 'etats_financiers'
  | 'rapport_evaluation';

/** Données extraites par le parseur IA (structure évolutive). */
export interface PropertyDocumentExtractedData {
  /** Libellé nomenclature Alain (liste fermée) ou type structuré legacy. */
  documentType?: string;
  /** Montants détectés (ex. taxes, loyers). */
  amounts?: Array<{ label: string; value: number; currency?: string }>;
  /** Dates clés extraites. */
  dates?: Array<{ label: string; isoDate: string }>;
  /** Taxes / impôts identifiés. */
  taxes?: Array<{ label: string; amount?: number; year?: number }>;
  revenus?: Array<{ label: string; value: number }>;
  depenses?: Array<{ label: string; value: number }>;
  annee?: number;
  nombreUnites?: number;
  nbPortes?: number;
  /** Benchmarks d'exploitation dérivés des montants (Hub Finance). */
  operatingBenchmarks?: {
    revenuTotal?: number | null;
    depensesExploitation?: number | null;
    revenuNetExploitation?: number | null;
    depensesParCle?: Record<string, number>;
    nbPortes?: number | null;
  };
  /** Immeuble évalué — rapport d'évaluation agréé. */
  sujet?: {
    anneeConstruction?: number;
    superficieTotale?: number;
    tgaRetenu?: number;
    valeurAvaluee?: number;
  };
  /** Immeubles comparables (rapport d'évaluation). */
  comparables?: Array<{
    city: string;
    region?: string;
    units?: number;
    salePrice?: number;
    capRatePct?: number;
    netIncomePerUnit?: number;
    /** Legacy */
    label?: string;
    regionKey?: string;
  }>;
  /** Certificat de localisation — métadonnées arpentage. */
  metadataCL?: {
    dateCertificat?: string;
    arpenteur?: string;
    lotCadastral?: string;
    superficieTerrainMetres?: number;
  };
  /** Anomalies relevées sur le CL (texte libre). */
  irregularites?: string[];
  /** Clause suggérée — section D de la Déclaration du vendeur (OACIQ). */
  suggestionClauseDV?: string;
  /** Certificat datant de plus de 10 ans (règle transactionnelle). */
  isExpiredCL?: boolean;
  /** Champs bruts non structurés (transition). */
  raw?: Record<string, unknown>;
}

export interface PropertyDocumentRecord {
  id: string;
  scope?: 'property';
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
  /** Message d’échec serveur (tronqué) si parsingStatus === failed. */
  parsingError?: string;
  /** true si PDF — déclenche le parseur après scan clean. */
  parsingEligible: boolean;
  extractedData: PropertyDocumentExtractedData;
  /** Courtier a validé et injecté les montants sélectionnés. */
  isValidated?: boolean;
  validatedAtMillis?: number;
  /** Pièce rattachée au dossier promesse d'achat. */
  promesseScope?: boolean;
  promesseDocLabel?: string;
  vendorPortalTypeId?: string;
  vendorPortalLabelFr?: string;
  uploadSource?: 'vendor_portal' | 'broker';
}

export interface PropertyDocumentCategoryDef {
  id: PropertyDocumentCategory;
  labelFr: string;
  labelEn: string;
}

/** Libellés UI — alignés sur la matrice transactionnelle (stockage inchangé). */
export const PROPERTY_DOCUMENT_CATEGORIES: PropertyDocumentCategoryDef[] = [
  {
    id: 'financier',
    labelFr: 'Documents pour acheteurs',
    labelEn: 'Documents for buyers',
  },
  {
    id: 'legal',
    labelFr: 'Contrat et annexes',
    labelEn: 'Listing contract & schedules',
  },
  {
    id: 'technique',
    labelFr: 'Actes et autres documents',
    labelEn: 'Deeds & other documents',
  },
];
