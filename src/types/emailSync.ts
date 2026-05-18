/** Messagerie synchronisée — fils et messages (Firestore). */

import type { MailboxFolder } from '../lib/mailboxFolders';

export type EmailMessageDirection = 'inbound' | 'outbound';

export type { MailboxFolder };

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
  /** Accusé de lecture Nylas (messages sortants). */
  isOpened?: boolean;
  /** Horodatage d’ouverture (ms). */
  openedAtMillis?: number;
  nylasMessageId?: string;
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
  /** Dossier courriel (INBOX, SENT, …) — aligné Nylas. */
  mailboxFolder?: MailboxFolder;
}
