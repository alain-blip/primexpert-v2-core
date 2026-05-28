/**
 * Catalogue documentaire portail vendeur — SSOT (aligné legacy documentTypes.js, v2026.2).
 * 82 types canoniques + 3 lignes « Hors liste » (une par catégorie parente) = 85 exigences UI.
 */

import catalogueData from './vendorPortalCatalogue.generated.json';

export type VendorPortalParentCategory =
  | 'documents_a_partager'
  | 'contrat_mandat_titres'
  | 'promesse_achat';

export type VendorPortalStorageCategory = 'financier' | 'legal' | 'technique';

export type VendorPortalCataloguePriority = 'required' | 'optional';

export interface VendorPortalCatalogueEntry {
  id: string;
  labelFr: string;
  labelEn: string;
  parentCategory: VendorPortalParentCategory;
  storageCategory: VendorPortalStorageCategory;
  priority: VendorPortalCataloguePriority;
}

export interface VendorPortalParentCategoryDef {
  id: VendorPortalParentCategory;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
  horsListeId: string;
}

export const VENDOR_PORTAL_PARENT_CATEGORIES: readonly VendorPortalParentCategoryDef[] = [
  {
    id: 'documents_a_partager',
    labelFr: 'Documents à partager',
    labelEn: 'Documents to share',
    descriptionFr:
      'Baux, états financiers, certifications CIUSSS, permis MAPAQ, taxes, employés et exploitation.',
    descriptionEn:
      'Leases, financial statements, CIUSSS certifications, MAPAQ permits, taxes, payroll and operations.',
    horsListeId: 'hors_liste_documents_a_partager',
  },
  {
    id: 'contrat_mandat_titres',
    labelFr: 'Contrat de courtage, mandat et titres de propriété',
    labelEn: 'Brokerage contract, mandate and title',
    descriptionFr: 'Contrat exclusif (CCVE), annexes OACIQ, REQ, actes et hypothèques.',
    descriptionEn: 'Exclusive brokerage (CCVE), OACIQ schedules, REQ, deeds and mortgages.',
    horsListeId: 'hors_liste_contrat_mandat_titres',
  },
  {
    id: 'promesse_achat',
    labelFr: "Documents liés à la promesse d'achat",
    labelEn: 'Purchase promise documents',
    descriptionFr:
      "Lettres d'intention, promesses, contre-propositions, identité de l'acheteur et conditions.",
    descriptionEn: 'Letters of intent, promises, counter-proposals, buyer identity and conditions.',
    horsListeId: 'hors_liste_promesse_achat',
  },
] as const;

const HORS_LISTE_ENTRIES: VendorPortalCatalogueEntry[] = VENDOR_PORTAL_PARENT_CATEGORIES.map(
  (parent) => ({
    id: parent.horsListeId,
    labelFr: 'Hors liste (téléversement)',
    labelEn: 'Off-list (upload)',
    parentCategory: parent.id,
    storageCategory:
      parent.id === 'contrat_mandat_titres' ? ('legal' as const) : ('financier' as const),
    priority: 'optional' as const,
  })
);

const BASE_ENTRIES = (catalogueData as { entries: VendorPortalCatalogueEntry[] }).entries;

/** 82 types canoniques issus du référentiel legacy documentTypes. */
export const VENDOR_PORTAL_CATALOGUE_ENTRIES: readonly VendorPortalCatalogueEntry[] = BASE_ENTRIES;

/** 85 lignes UI (82 + 3 hors liste). */
export const VENDOR_PORTAL_UI_ENTRIES: readonly VendorPortalCatalogueEntry[] = [
  ...BASE_ENTRIES,
  ...HORS_LISTE_ENTRIES,
];

export const VENDOR_PORTAL_CANONICAL_DOCUMENT_COUNT = VENDOR_PORTAL_CATALOGUE_ENTRIES.length;
export const VENDOR_PORTAL_UI_ROW_COUNT = VENDOR_PORTAL_UI_ENTRIES.length;

const BY_ID = new Map(VENDOR_PORTAL_UI_ENTRIES.map((e) => [e.id, e]));

export function resolveVendorPortalCatalogueEntry(
  idOrLabel: string | null | undefined
): VendorPortalCatalogueEntry | undefined {
  if (!idOrLabel?.trim()) return undefined;
  const raw = idOrLabel.trim();
  const byId = BY_ID.get(raw);
  if (byId) return byId;
  const norm = raw.toLowerCase();
  return VENDOR_PORTAL_UI_ENTRIES.find(
    (e) => e.labelFr.toLowerCase() === norm || e.labelEn.toLowerCase() === norm
  );
}

export function vendorPortalEntriesForParent(
  parent: VendorPortalParentCategory
): VendorPortalCatalogueEntry[] {
  return VENDOR_PORTAL_UI_ENTRIES.filter((e) => e.parentCategory === parent);
}

export function vendorPortalRequiredEntries(): VendorPortalCatalogueEntry[] {
  return VENDOR_PORTAL_CATALOGUE_ENTRIES.filter((e) => e.priority === 'required');
}

export function isVendorPortalHorsListeEntry(id: string): boolean {
  return id.startsWith('hors_liste_');
}
