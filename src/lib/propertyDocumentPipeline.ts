/**
 * Pipeline Espace Documents — transitions côté serveur (extension scan Firebase + parseur IA).
 *
 * 1. Upload client → virusScanStatus: "pending", parsingStatus: "not_applicable"
 * 2. Extension antivirus (Storage trigger) → "clean" | "infected"
 *    - infected : bloquer téléchargement (déjà côté UI)
 *    - clean + parsingEligible → parsingStatus: "pending"
 * 3. Cloud Function parseur IA → extractedData rempli, parsingStatus: "completed" | "failed"
 */

import type { ParsingStatus, VirusScanStatus } from '../types/propertyDocument';
import { resolveParsingStatusAfterVirusScan } from './propertyDocumentValidation';

export interface PropertyDocumentPipelinePatch {
  virusScanStatus?: VirusScanStatus;
  parsingStatus?: ParsingStatus;
  extractedData?: Record<string, unknown>;
  virusScannedAtMillis?: number;
  parsedAtMillis?: number;
}

/** Patch Firestore après scan antivirus réussi ou échec. */
export function buildVirusScanPatch(
  virusScanStatus: 'clean' | 'infected',
  parsingEligible: boolean,
  scannedAtMillis = Date.now()
): PropertyDocumentPipelinePatch {
  const parsingStatus = resolveParsingStatusAfterVirusScan(virusScanStatus, parsingEligible);
  return {
    virusScanStatus,
    parsingStatus,
    virusScannedAtMillis: scannedAtMillis,
  };
}

/** Patch Firestore après parseur IA. */
export function buildParsingCompletePatch(
  extractedData: Record<string, unknown>,
  success: boolean,
  parsedAtMillis = Date.now()
): PropertyDocumentPipelinePatch {
  return {
    parsingStatus: success ? 'completed' : 'failed',
    extractedData,
    parsedAtMillis,
  };
}
