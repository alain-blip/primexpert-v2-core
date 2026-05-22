/**
 * Indexation virtuelle — Mes Documents (aucune copie Storage).
 * SSOT inscription : `residences/{propertyId}/documents` + chemins `primexpert/.../properties/...`.
 */

import { buildContactDisplayName } from '@primexpert/core/crm';
import type { OrganizationContact } from '@primexpert/core/crm';
import {
  PROPERTY_DOCUMENT_CATEGORIES,
  type PropertyDocumentCategory,
  type PropertyDocumentRecord,
  type VirusScanStatus,
} from '../types/propertyDocument';

export type UnifiedDocumentSource = 'property' | 'contact' | 'agency';

export interface VirtualMirrorFile {
  id: string;
  source: UnifiedDocumentSource;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAtMillis: number;
  folderKey: string;
  folderLabelFr: string;
  folderLabelEn: string;
  /** Inscription — référence Firestore SSOT */
  propertyId?: string;
  propertyDocumentId?: string;
  propertyCategory?: PropertyDocumentCategory;
  promesseScope?: boolean;
  virusScanStatus?: VirusScanStatus;
  contactId?: string;
  agencyDocumentId?: string;
}

export interface VirtualMirrorFolder {
  key: string;
  labelFr: string;
  labelEn: string;
  files: VirtualMirrorFile[];
}

export const RESIDENCE_MIRROR_PROMESSE_KEY = 'promesse';

/** Dossiers miroir inscription — alignés sur l’Espace Documents de la fiche. */
export function buildResidenceMirrorFolders(
  docs: PropertyDocumentRecord[]
): VirtualMirrorFolder[] {
  const promesseFiles: VirtualMirrorFile[] = [];
  const byCategory = new Map<PropertyDocumentCategory, VirtualMirrorFile[]>();
  for (const cat of PROPERTY_DOCUMENT_CATEGORIES) {
    byCategory.set(cat.id, []);
  }

  for (const doc of docs) {
    const virtual = propertyRecordToMirrorFile(doc);
    if (doc.promesseScope) {
      promesseFiles.push(virtual);
    } else {
      byCategory.get(doc.category)?.push(virtual);
    }
  }

  const folders: VirtualMirrorFolder[] = PROPERTY_DOCUMENT_CATEGORIES.map((cat) => ({
    key: cat.id,
    labelFr: cat.labelFr,
    labelEn: cat.labelEn,
    files: (byCategory.get(cat.id) ?? []).sort(sortByDateDesc),
  }));

  folders.push({
    key: RESIDENCE_MIRROR_PROMESSE_KEY,
    labelFr: 'Promesses d’achat',
    labelEn: 'Purchase promises',
    files: promesseFiles.sort(sortByDateDesc),
  });

  return folders;
}

export function propertyRecordToMirrorFile(doc: PropertyDocumentRecord): VirtualMirrorFile {
  const catDef = PROPERTY_DOCUMENT_CATEGORIES.find((c) => c.id === doc.category);
  const folderKey = doc.promesseScope ? RESIDENCE_MIRROR_PROMESSE_KEY : doc.category;
  const folderLabelFr = doc.promesseScope
    ? 'Promesses d’achat'
    : (catDef?.labelFr ?? doc.category);
  const folderLabelEn = doc.promesseScope
    ? 'Purchase promises'
    : (catDef?.labelEn ?? doc.category);

  return {
    id: `property:${doc.propertyId}:${doc.id}`,
    source: 'property',
    fileName: doc.promesseDocLabel?.trim() || doc.fileName,
    storagePath: doc.storagePath,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedAtMillis: doc.uploadedAtMillis,
    folderKey,
    folderLabelFr,
    folderLabelEn,
    propertyId: doc.propertyId,
    propertyDocumentId: doc.id,
    propertyCategory: doc.category,
    promesseScope: doc.promesseScope,
    virusScanStatus: doc.virusScanStatus,
  };
}

function sortByDateDesc(a: VirtualMirrorFile, b: VirtualMirrorFile): number {
  return b.uploadedAtMillis - a.uploadedAtMillis;
}

function pushContactFile(
  folders: Map<string, VirtualMirrorFile[]>,
  folderKey: string,
  labelFr: string,
  labelEn: string,
  contactId: string,
  fileName: string,
  storagePath: string,
  url: string,
  uploadedAtMillis?: string
): void {
  if (!storagePath?.trim() || !url?.trim()) return;
  const list = folders.get(folderKey) ?? [];
  list.push({
    id: `contact:${contactId}:${folderKey}:${storagePath}`,
    source: 'contact',
    fileName,
    storagePath,
    mimeType: guessMime(fileName),
    sizeBytes: 0,
    uploadedAtMillis: uploadedAtMillis
      ? Date.parse(uploadedAtMillis) || Date.now()
      : Date.now(),
    folderKey,
    folderLabelFr: labelFr,
    folderLabelEn: labelEn,
    contactId,
  });
  folders.set(folderKey, list);
}

/** Pièces CRM contact — lecture seule des chemins Storage existants (pas de copie). */
export function buildContactMirrorFolders(contact: OrganizationContact): VirtualMirrorFolder[] {
  const map = new Map<string, VirtualMirrorFile[]>();
  const id = contact.id;

  const bc = contact.buyerCriteria;
  if (bc?.ndaFile?.storagePath && bc.ndaFile.url) {
    pushContactFile(
      map,
      'buyer_nda',
      'Entente de confidentialité (NDA)',
      'Non-disclosure agreement (NDA)',
      id,
      'NDA',
      bc.ndaFile.storagePath,
      bc.ndaFile.url,
      bc.ndaFile.uploadedAt
    );
  }
  if (bc?.proofOfFundsFile?.storagePath && bc.proofOfFundsFile.url) {
    pushContactFile(
      map,
      'buyer_funds',
      'Preuve de mise de fonds',
      'Proof of funds',
      id,
      'Preuve de fonds',
      bc.proofOfFundsFile.storagePath,
      bc.proofOfFundsFile.url,
      bc.proofOfFundsFile.uploadedAt
    );
  }
  if (bc?.bankLetterFile?.storagePath && bc.bankLetterFile.url) {
    pushContactFile(
      map,
      'buyer_bank',
      'Lettre bancaire',
      'Bank letter',
      id,
      'Lettre bancaire',
      bc.bankLetterFile.storagePath,
      bc.bankLetterFile.url,
      bc.bankLetterFile.uploadedAt
    );
  }
  if (bc?.mortgagePreApprovalFile?.storagePath && bc.mortgagePreApprovalFile.url) {
    pushContactFile(
      map,
      'buyer_preapproval',
      'Préapprobation hypothécaire',
      'Mortgage pre-approval',
      id,
      'Préapprobation',
      bc.mortgagePreApprovalFile.storagePath,
      bc.mortgagePreApprovalFile.url,
      bc.mortgagePreApprovalFile.uploadedAt
    );
  }
  if (bc?.corporateMandate?.reqFile?.storagePath && bc.corporateMandate.reqFile.url) {
    pushContactFile(
      map,
      'buyer_req',
      'Fiche REQ (acheteur)',
      'REQ extract (buyer)',
      id,
      'REQ',
      bc.corporateMandate.reqFile.storagePath,
      bc.corporateMandate.reqFile.url,
      bc.corporateMandate.reqFile.uploadedAt
    );
  }

  const sc = contact.sellerCriteria;
  if (sc?.brokerageContractFile?.storagePath && sc.brokerageContractFile.url) {
    pushContactFile(
      map,
      'seller_brokerage',
      'Contrat de courtage',
      'Brokerage contract',
      id,
      'Contrat de courtage',
      sc.brokerageContractFile.storagePath,
      sc.brokerageContractFile.url,
      sc.brokerageContractFile.uploadedAt
    );
  }
  if (sc?.ownershipProofFile?.storagePath && sc.ownershipProofFile.url) {
    pushContactFile(
      map,
      'seller_title',
      'Titre de propriété',
      'Ownership proof',
      id,
      'Titre',
      sc.ownershipProofFile.storagePath,
      sc.ownershipProofFile.url,
      sc.ownershipProofFile.uploadedAt
    );
  }
  if (sc?.sellerDeclarationFile?.storagePath && sc.sellerDeclarationFile.url) {
    pushContactFile(
      map,
      'seller_declaration',
      'Déclaration du vendeur',
      'Seller declaration',
      id,
      'Déclaration vendeur',
      sc.sellerDeclarationFile.storagePath,
      sc.sellerDeclarationFile.url,
      sc.sellerDeclarationFile.uploadedAt
    );
  }
  if (sc?.corporateMandate?.reqFile?.storagePath && sc.corporateMandate.reqFile.url) {
    pushContactFile(
      map,
      'seller_req',
      'Fiche REQ (vendeur)',
      'REQ extract (seller)',
      id,
      'REQ',
      sc.corporateMandate.reqFile.storagePath,
      sc.corporateMandate.reqFile.url,
      sc.corporateMandate.reqFile.uploadedAt
    );
  }

  const lv = contact.legalVerification;
  if (lv?.idDocumentStoragePath && lv.idDocumentUrl) {
    pushContactFile(
      map,
      'id_proof',
      'Pièce d’identité',
      'Identity proof',
      id,
      'Identité',
      lv.idDocumentStoragePath,
      lv.idDocumentUrl,
      lv.verifiedAt
    );
  }

  return Array.from(map.entries()).map(([key, files]) => ({
    key,
    labelFr: files[0]?.folderLabelFr ?? key,
    labelEn: files[0]?.folderLabelEn ?? key,
    files: files.sort(sortByDateDesc),
  }));
}

export function contactMirrorTitle(contact: OrganizationContact): string {
  return buildContactDisplayName(contact);
}

function guessMime(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

export function mirrorFolderForPropertyUpload(
  folderKey: string
): { category: PropertyDocumentCategory; promesseScope?: boolean } | null {
  if (folderKey === RESIDENCE_MIRROR_PROMESSE_KEY) {
    return { category: 'financier', promesseScope: true };
  }
  if (folderKey === 'financier' || folderKey === 'legal' || folderKey === 'technique') {
    return { category: folderKey };
  }
  return null;
}
