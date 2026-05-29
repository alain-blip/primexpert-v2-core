/**
 * Spécifications transactionnelles OACIQ & négociation commerciale hybride (V2.6).
 * Formulaires OACIQ (CPC, M, AM, N) ou contrats libres / lettre d'intention (LOI).
 */

/** Codes formulaires OACIQ — trilogie réglementaire courtage. */
export type OaciqFormCode = 'CPC' | 'M' | 'AM' | 'N';

/**
 * CPC — Contre-proposition commerciale
 * M  — Modifications (ex. section M3)
 * AM — Annexe
 * N  — Notice
 */
export const OACIQ_FORM_LABELS: Record<
  OaciqFormCode,
  { labelFr: string; labelEn: string }
> = {
  CPC: {
    labelFr: 'Contre-proposition commerciale (CPC)',
    labelEn: 'Commercial counter-proposal (CPC)',
  },
  M: {
    labelFr: 'Modifications (M)',
    labelEn: 'Amendments (M)',
  },
  AM: {
    labelFr: 'Annexe (AM)',
    labelEn: 'Schedule (AM)',
  },
  N: {
    labelFr: 'Notice (N)',
    labelEn: 'Notice (N)',
  },
};

/** Mode de support contractuel — commercial RPA (5+ logements) : OACIQ optionnel. */
export type ContractSupportType =
  | 'OACIQ_FORM'
  | 'CUSTOM_CONTRACT'
  | 'LETTER_OF_INTENT';

/** Statut HITL — aucune clause ne part sans validation humaine. */
export const MANUAL_VERIFICATION_HITL_STATUS = 'pending_human_review' as const;

export type ManualVerificationHitlStatus = typeof MANUAL_VERIFICATION_HITL_STATUS;

/** États de transaction reconnus par le routeur de clauses. */
export type NegotiationTransactionState =
  | 'negotiation'
  | 'accepted_pipeline'
  | 'promise'
  | 'due_diligence'
  | string;

/** Sortie hybride — formulaire OACIQ, contrat personnalisé ou LOI. */
export interface CommercialNegotiationOutput {
  contractSupportType: ContractSupportType;
  /** Présent seulement si contractSupportType === 'OACIQ_FORM'. */
  oaciqFormCode?: OaciqFormCode;
  /** Ex. « Section 2 », « Section M3 » — absent si contrat libre ou LOI. */
  targetSectionIdentifier?: string;
  /** Texte juridique proposé (formulaire OACIQ ou clause autonome). */
  generatedClauseText: string;
  /** Message vulgarisé pour le client (courriel d'accompagnement). */
  commercialEmailDraft: string;
  /** Conseil déontologique — invitation à consulter un juriste. */
  requiredBrokerWarning: string;
  /** Référence Guide des pratiques professionnelles OACIQ (si mode formulaire). */
  complianceJustification?: string;
}

/** Mapping transactionnel OACIQ (mode formulaire strict). */
export interface OaciqTransactionalMapping {
  oaciqFormCode: OaciqFormCode;
  targetSectionIdentifier: string;
  clauseInsertionTemplate: string;
  requiredBrokerWarning: string;
  complianceJustification: string;
}

/** Brouillon persisté — collection / sous-objet manualVerifications (HITL). */
export interface ManualVerificationClauseDraft {
  kind: 'commercial_negotiation_clause';
  status: ManualVerificationHitlStatus;
  frictionContext: string;
  transactionState: string;
  output: CommercialNegotiationOutput;
  createdAt: string;
}

/** Résultat complet après génération + persistance HITL. */
export interface CommercialNegotiationResult {
  output: CommercialNegotiationOutput;
  verification: ManualVerificationClauseDraft;
}

export const DEFAULT_BROKER_LEGAL_WARNING_FR =
  'Cette proposition est un brouillon généré par assistance numérique. Vous devez la réviser et consulter un juriste ou notaire avant toute transmission à une contrepartie.';

export const DEFAULT_BROKER_LEGAL_WARNING_EN =
  'This draft was produced with digital assistance. You must review it and consult legal counsel before sharing it with any counterparty.';

export const OACIQ_COMPLIANCE_GUIDE_REF_FR =
  'Guide des pratiques professionnelles de l\'OACIQ — diligence raisonnable et rédaction des engagements.';
