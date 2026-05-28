/** Messagerie synchronisée — fils et messages (Firestore SSOT email_threads). */

import type { CommunicationChannel, CommunicationMessageMetadata } from '@primexpert/core/mail';
import type { MailboxFolder } from '../lib/mailboxFolders';

export type EmailMessageDirection = 'inbound' | 'outbound';

export type { CommunicationChannel };

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
  /** Canal omnicanal (défaut courriel). */
  channel?: CommunicationChannel;
  /** Horodatage canonique omnicanal (ms) pour la timeline unifiée. */
  timestamp?: number;
  body: string;
  sentAtMillis: number;
  direction: EmailMessageDirection;
  metadata?: CommunicationMessageMetadata;
  /** Notification push — urgence détectée (SMS / Meta). */
  isCritical?: boolean;
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
  /** Métadonnées analyse OACIQ (ingestion Nylas — SSOT message). */
  mailAnalysisAtMillis?: number;
  matchedResidenceId?: string | null;
  mailContactEmail?: string | null;
  mailContactName?: string | null;
  mailIntent?: string;
  summaryOneLine?: string;
  mailUrgency?: string;
  /** Contact CRM lié explicitement (Phase 2 messagerie). */
  matchedContactId?: string | null;
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
  /** Contact CRM lié au fil (Phase 2 messagerie). */
  matchedContactId?: string | null;
  createdAtMillis: number;
  /** Fil Nylas source (webhook / envoi). */
  nylasThreadId?: string;
  /** Dossier courriel (INBOX, SENT, …) — aligné Nylas. */
  mailboxFolder?: MailboxFolder;
  /** Canal dominant du fil. */
  primaryChannel?: CommunicationChannel;
  contactPhone?: string | null;
  externalThreadKey?: string | null;
}
