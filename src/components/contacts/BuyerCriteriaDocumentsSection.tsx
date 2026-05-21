import type {
  ContactBuyerCriteria,
  ContactBuyerDocumentKind,
  ContactCriteriaDocumentRef,
} from '@primexpert/core/crm';
import { uploadContactBuyerDocument, type ContactServiceContext } from '../../services/contacts';
import {
  ContactCriteriaDocumentsSection,
  type CriteriaDocumentRowConfig,
} from './ContactCriteriaDocumentsSection';

export type BuyerDocumentRowConfig = CriteriaDocumentRowConfig<ContactBuyerDocumentKind>;

export interface BuyerCriteriaDocumentsSectionProps {
  ctx: ContactServiceContext;
  contactId: string | undefined;
  rows: BuyerDocumentRowConfig[];
  onDocumentUploaded: (kind: ContactBuyerDocumentKind, ref: ContactCriteriaDocumentRef) => void;
  className?: string;
}

export function BuyerCriteriaDocumentsSection(props: BuyerCriteriaDocumentsSectionProps) {
  return (
    <ContactCriteriaDocumentsSection<ContactBuyerDocumentKind>
      ctx={props.ctx}
      contactId={props.contactId}
      rows={props.rows}
      uploadDocument={uploadContactBuyerDocument}
      onDocumentUploaded={props.onDocumentUploaded}
      className={props.className}
    />
  );
}

/** Lignes standard des 4 pièces de qualification acheteur. */
export function buildStandardBuyerDocumentRows(
  criteria: ContactBuyerCriteria | undefined
): BuyerDocumentRowConfig[] {
  return [
    {
      kind: 'nda',
      labelFr: 'Entente de confidentialité signée (NDA)',
      labelEn: 'Signed non-disclosure agreement (NDA)',
      file: criteria?.ndaFile,
    },
    {
      kind: 'proof_of_funds',
      labelFr: 'Preuve de mise de fonds',
      labelEn: 'Proof of funds',
      file: criteria?.proofOfFundsFile,
    },
    {
      kind: 'bank_letter',
      labelFr: 'Lettre bancaire validée',
      labelEn: 'Validated bank letter',
      file: criteria?.bankLetterFile,
    },
    {
      kind: 'mortgage_pre_approval',
      labelFr: 'Préapprobation hypothécaire',
      labelEn: 'Mortgage pre-approval',
      file: criteria?.mortgagePreApprovalFile,
    },
  ];
}
