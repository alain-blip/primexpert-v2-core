import type {
  ContactCriteriaDocumentRef,
  ContactSellerCriteria,
  ContactSellerDocumentKind,
} from '@primexpert/core/crm';
import { uploadContactSellerDocument, type ContactServiceContext } from '../../services/contacts';
import {
  ContactCriteriaDocumentsSection,
  type CriteriaDocumentRowConfig,
} from './ContactCriteriaDocumentsSection';

export type SellerDocumentRowConfig = CriteriaDocumentRowConfig<ContactSellerDocumentKind>;

export interface SellerCriteriaDocumentsSectionProps {
  ctx: ContactServiceContext;
  contactId: string | undefined;
  rows: SellerDocumentRowConfig[];
  onDocumentUploaded: (kind: ContactSellerDocumentKind, ref: ContactCriteriaDocumentRef) => void;
  className?: string;
}

export function SellerCriteriaDocumentsSection(props: SellerCriteriaDocumentsSectionProps) {
  return (
    <ContactCriteriaDocumentsSection<ContactSellerDocumentKind>
      ctx={props.ctx}
      contactId={props.contactId}
      rows={props.rows}
      uploadDocument={uploadContactSellerDocument}
      onDocumentUploaded={props.onDocumentUploaded}
      legendFr="Preuves documentaires (vendeur)"
      legendEn="Seller supporting documents"
      className={props.className}
    />
  );
}

export function buildStandardSellerDocumentRows(
  criteria: ContactSellerCriteria | undefined
): SellerDocumentRowConfig[] {
  return [
    {
      kind: 'brokerage_contract',
      labelFr: 'Contrat de courtage immobilier',
      labelEn: 'Real estate brokerage contract',
      file: criteria?.brokerageContractFile,
    },
    {
      kind: 'ownership_proof',
      labelFr: 'Titre de propriété',
      labelEn: 'Certificate of title / ownership proof',
      file: criteria?.ownershipProofFile,
    },
    {
      kind: 'seller_declaration',
      labelFr: 'Déclaration du vendeur',
      labelEn: 'Seller declaration',
      file: criteria?.sellerDeclarationFile,
    },
  ];
}
