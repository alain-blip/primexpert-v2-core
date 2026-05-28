/**
 * IA Mailbox / Hub omnicanal — types partagés (Phase E-2 + messagerie unifiée)
 * SSOT Firestore : users/{uid}/email_threads (alias canonique communication_threads)
 */

export type MailContactIntent = 'buyer' | 'seller' | 'peer' | 'agency' | 'unknown';

export type MailUrgency = 'low' | 'medium' | 'high';

export type ResidenceMatchConfidence = 'high' | 'medium' | 'low' | 'none';

/** Canaux supportés dans le fil unifié (SSOT message.channel). */
export type CommunicationChannel = 'email' | 'sms' | 'facebook' | 'instagram';

/**
 * Alias documentaire — la collection Firestore reste `email_threads` (Règle #0).
 * Utiliser cette constante dans le code nouveau pour clarifier l'intention.
 */
export const COMMUNICATION_THREADS_COLLECTION = 'email_threads' as const;
export const COMMUNICATION_MESSAGES_SUBCOLLECTION = 'messages' as const;

/** @deprecated Utiliser COMMUNICATION_THREADS_COLLECTION — rétrocompatibilité. */
export const EMAIL_THREADS_COLLECTION = COMMUNICATION_THREADS_COLLECTION;

export interface CommunicationMessageMetadata {
  /** Identifiant expéditeur côté plateforme (PSID Meta, numéro E.164, etc.). */
  externalSenderId?: string | null;
  externalRecipientId?: string | null;
  twilioMessageSid?: string | null;
  metaMessageId?: string | null;
  metaPageId?: string | null;
  fromPhone?: string | null;
  toPhone?: string | null;
}

/**
 * Message canonique omnicanal — aligné sur email_threads/{id}/messages/{id}.
 */
export interface CommunicationMessage {
  id: string;
  threadId: string;
  channel: CommunicationChannel;
  body: string;
  sentAtMillis: number;
  direction: 'inbound' | 'outbound';
  authorName?: string;
  authorId?: string;
  metadata?: CommunicationMessageMetadata;
  /** Alerte mobile — analyse urgence (SMS / Meta entrants). */
  isCritical?: boolean;
  matchedContactId?: string | null;
  matchedResidenceId?: string | null;
  summaryOneLine?: string;
  mailUrgency?: MailUrgency;
}

export interface CommunicationThread {
  id: string;
  brokerId: string;
  subject: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  lastMessageSnippet: string;
  lastMessageAtMillis: number;
  isUnread: boolean;
  matchedContactId?: string | null;
  propertyId?: string | null;
  /** Canal dominant du fil (dernier message entrant). */
  primaryChannel?: CommunicationChannel;
  /** Clé stable pour regrouper SMS/Meta (ex. crm_contactId, sms_15145551234). */
  externalThreadKey?: string | null;
}

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

export interface InboundUrgencyAnalysis {
  isCritical: boolean;
  urgency: MailUrgency;
  summaryOneLine: string;
}

const CHANNELS: readonly CommunicationChannel[] = ['email', 'sms', 'facebook', 'instagram'];

export function parseCommunicationChannel(raw: unknown): CommunicationChannel {
  if (typeof raw !== 'string') return 'email';
  const v = raw.trim().toLowerCase();
  if (v === 'sms' || v === 'text') return 'sms';
  if (v === 'facebook' || v === 'messenger' || v === 'fb') return 'facebook';
  if (v === 'instagram' || v === 'ig') return 'instagram';
  return CHANNELS.includes(v as CommunicationChannel) ? (v as CommunicationChannel) : 'email';
}

export function buildCrmThreadId(contactId: string): string {
  return `crm_${contactId.trim()}`;
}

export function buildSmsThreadId(normalizedPhone: string): string {
  const digits = normalizedPhone.replace(/\D/g, '');
  return `sms_${digits || 'unknown'}`;
}
