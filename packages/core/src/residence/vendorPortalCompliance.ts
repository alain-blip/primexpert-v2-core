/**
 * Conformité portail vendeur — calcul basé sur le catalogue exhaustif (SSOT).
 */

import {
  isVendorPortalHorsListeEntry,
  resolveVendorPortalCatalogueEntry,
  vendorPortalRequiredEntries,
  VENDOR_PORTAL_CANONICAL_DOCUMENT_COUNT,
  type VendorPortalCatalogueEntry,
} from './vendorPortalCatalogue';

export interface VendorPortalUploadedDocLike {
  extractedData?: { documentType?: string | null; vendorPortalTypeId?: string | null } | null;
  promesseScope?: boolean;
  promesseDocLabel?: string | null;
  fileName?: string | null;
  vendorPortalTypeId?: string | null;
  vendorPortalLabelFr?: string | null;
}

export interface VendorPortalComplianceResult {
  percent: number;
  receivedCount: number;
  requiredCount: number;
  canonicalCount: number;
  missingRequired: VendorPortalCatalogueEntry[];
  receivedTypeIds: string[];
}

function resolveDocCatalogueId(doc: VendorPortalUploadedDocLike): string | null {
  const explicit = doc.vendorPortalTypeId ?? doc.extractedData?.vendorPortalTypeId;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  const label =
    doc.vendorPortalLabelFr ??
    doc.promesseDocLabel ??
    (typeof doc.extractedData?.documentType === 'string' ? doc.extractedData.documentType : null);
  const entry = resolveVendorPortalCatalogueEntry(label);
  return entry?.id ?? null;
}

/**
 * Pourcentage de conformité : part des types **requis** du catalogue présents au dossier.
 * Les téléversements « hors liste » comptent comme reçus optionnels (n'augmentent pas le dénominateur requis).
 */
export function assessVendorPortalCatalogueCompliance(
  docs: readonly VendorPortalUploadedDocLike[]
): VendorPortalComplianceResult {
  const required = vendorPortalRequiredEntries();
  const receivedTypeIds = new Set<string>();

  for (const doc of docs) {
    const id = resolveDocCatalogueId(doc);
    if (id) receivedTypeIds.add(id);
    else if (doc.vendorPortalLabelFr?.trim() || doc.fileName?.trim()) {
      receivedTypeIds.add(`adhoc_${doc.fileName ?? 'unknown'}`);
    }
  }

  const missingRequired = required.filter((e) => !receivedTypeIds.has(e.id));
  const requiredCount = required.length;
  const receivedRequired = requiredCount - missingRequired.length;
  const percent =
    requiredCount === 0
      ? 100
      : Math.round((receivedRequired / requiredCount) * 100);

  return {
    percent: Math.max(0, Math.min(100, percent)),
    receivedCount: receivedTypeIds.size,
    requiredCount,
    canonicalCount: VENDOR_PORTAL_CANONICAL_DOCUMENT_COUNT,
    missingRequired,
    receivedTypeIds: [...receivedTypeIds].filter((id) => !id.startsWith('adhoc_') && !isVendorPortalHorsListeEntry(id)),
  };
}

export function vendorPortalCataloguePercent(docs: readonly VendorPortalUploadedDocLike[]): number {
  return assessVendorPortalCatalogueCompliance(docs).percent;
}
