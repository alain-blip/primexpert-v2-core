import type { LegalVaultDocumentType } from '@primexpert/core/security';
import type { PropertyDocumentRecord } from '../types/propertyDocument';

/** Identifiant Firestore déterministe — 1 entrée legal_vault par pièce résidence. */
export function buildLegalVaultDocumentId(
  propertyId: string,
  propertyDocumentId: string
): string {
  return `${propertyId}__${propertyDocumentId}`;
}

export function buildLegalVaultStorageUrl(storagePath: string, bucket?: string): string {
  const path = storagePath.trim();
  if (path.startsWith('gs://') || path.startsWith('https://')) return path;
  const b = bucket?.trim() || 'primexpert-app-v2.firebasestorage.app';
  return `gs://${b}/${path.replace(/^\/+/, '')}`;
}

export function resolveLegalVaultDocumentType(
  doc: PropertyDocumentRecord
): LegalVaultDocumentType {
  const taxonomy = doc.extractedData?.documentType?.toLowerCase() ?? '';
  const name = doc.fileName.toLowerCase();

  if (doc.promesseScope || doc.category === 'legal') {
    if (name.includes('promesse') || name.includes('promise')) {
      return 'PROMESSE_ACHAT';
    }
    return 'CONTRAT_COURTAGE';
  }

  if (
    taxonomy.includes('acm') ||
    taxonomy.includes('rapport_evaluation') ||
    taxonomy.includes('evaluation') ||
    name.includes('acm') ||
    name.includes('évaluation') ||
    name.includes('evaluation')
  ) {
    return 'ACM_REPORT';
  }

  return 'FICHE_DESCRIPTIVE';
}

export function resolveLicenseTypeLabel(title?: string, locale: 'fr' | 'en' = 'fr'): string {
  const t = title?.trim();
  if (t) return t;
  return locale === 'fr' ? 'Courtier immobilier' : 'Real estate broker';
}
