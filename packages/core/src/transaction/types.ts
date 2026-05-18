/** Promesse d'achat — types transactionnels (OACIQ / registre agence). */

export type PromesseStatus =
  | 'draft'
  | 'received'
  | 'accepted'
  | 'refused'
  | 'cancelled';

export interface PromesseDelayDays {
  visiteLieuxJours?: number;
  verificationDocumentsJours?: number;
  inspectionJours?: number;
  financementJours?: number;
  permisJours?: number;
}

export interface PromesseCommissionInput {
  totalePct?: number;
  inscripteurPct?: number;
  collaborateurPct?: number;
}

export interface PromesseCollaborator {
  nom?: string;
  telephone?: string;
  courriel?: string;
  partCommissionPct?: number;
}

export interface PromesseBuyerContact {
  contactId?: string;
  fullName: string;
  email?: string;
  phone?: string;
  company?: string;
  internal: boolean;
}

export interface PromesseAchatInput {
  status: PromesseStatus;
  prixOffert?: number;
  prixAccepte?: number;
  /** ISO yyyy-mm-dd */
  dateReception?: string;
  delaiReponseJours?: number;
  dateAcceptation?: string;
  dateNotairePrevue?: string;
  delais?: PromesseDelayDays;
  commission?: PromesseCommissionInput;
  courtierCollaborateur?: PromesseCollaborator;
  buyer?: PromesseBuyerContact | null;
}

export interface PromesseComputedDeadlines {
  dateLimiteReponse?: string;
  dateLimiteVisiteLieux?: string;
  dateLimiteVerificationDocuments?: string;
  dateLimiteInspection?: string;
  dateLimiteFinancement?: string;
  dateLimitePermis?: string;
}

export interface PromesseCommissionView {
  prixBase?: number;
  montantCommissionTotale?: number;
  montantInscripteur?: number;
  montantCollaborateur?: number;
}

export interface PromesseAchatViewModel {
  input: PromesseAchatInput;
  deadlines: PromesseComputedDeadlines;
  commission: PromesseCommissionView;
  isWormLocked: boolean;
}

/** Ligne du tableau récapitulatif des offres. */
export interface PromesseOfferSummaryRow {
  id: string;
  status: PromesseStatus;
  prixOffert?: number;
  prixAccepte?: number;
  dateReception?: string;
  buyerName?: string;
  savedAtMillis: number;
}
