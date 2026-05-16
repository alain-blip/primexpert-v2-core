/** Messagerie synchronisée — fils et messages (Firestore). */

export type EmailMessageDirection = 'inbound' | 'outbound';

export interface EmailAttachment {
  name: string;
  url: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  body: string;
  sentAtMillis: number;
  direction: EmailMessageDirection;
  authorName?: string;
  authorId?: string;
  /** Boîte expéditrice (`EmailAccount.id`). */
  fromAccountId?: string;
  /** Adresse expéditrice affichée. */
  fromEmailAddress?: string;
  attachments?: EmailAttachment[];
}

export interface EmailThread {
  id: string;
  brokerId: string;
  /** Compte courriel source (`EmailAccount.id`). */
  accountId: string;
  subject: string;
  contactName: string;
  contactEmail?: string;
  lastMessageSnippet: string;
  lastMessageAtMillis: number;
  isUnread: boolean;
  /** Lien Radar — fiche résidence / inscription. */
  propertyId?: string;
  propertyLabel?: string;
  createdAtMillis: number;
  /** Fil Nylas source (webhook / envoi). */
  nylasThreadId?: string;
}
