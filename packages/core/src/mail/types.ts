/**
 * IA Mailbox — types partagés (Phase E-2)
 * Aucune dépendance runtime hors ce package.
 */

export type MailContactIntent = 'buyer' | 'seller' | 'peer' | 'agency' | 'unknown';

export type MailUrgency = 'low' | 'medium' | 'high';

export type ResidenceMatchConfidence = 'high' | 'medium' | 'low' | 'none';

/** Référence minimale inventaire pour matching texte (Firestore / UI). */
export interface InventoryResidenceRef {
  id: string;
  address: string;
  city: string;
}

export interface MailLeadExtraction {
  contactName: string | null;
  phone: string | null;
  email: string | null;
  intent: MailContactIntent;
}

export interface MailResidenceHint {
  matchedResidenceId: string | null;
  mentionedAddress: string | null;
  matchConfidence: ResidenceMatchConfidence;
}

/**
 * Résultat structuré du triage courriel (heuristique +/ou IA).
 */
export interface MailParseResult {
  lead: MailLeadExtraction;
  residence: MailResidenceHint;
  urgency: MailUrgency;
  summaryOneLine: string;
}
