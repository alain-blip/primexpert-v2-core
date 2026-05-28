/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/mail/
 * Régénéré : functions/scripts/sync-core-mail.cjs (prebuild)
 */
/**
 * IA Mailbox — exports publics @primexpert/core/mail
 */

export type {
  CommunicationChannel,
  CommunicationMessage,
  CommunicationMessageMetadata,
  CommunicationThread,
  InboundUrgencyAnalysis,
  InventoryResidenceRef,
  MailContactIntent,
  MailLeadExtraction,
  MailParseResult,
  MailResidenceHint,
  MailUrgency,
  ResidenceMatchConfidence,
} from './types';

export {
  COMMUNICATION_MESSAGES_SUBCOLLECTION,
  COMMUNICATION_THREADS_COLLECTION,
  EMAIL_THREADS_COLLECTION,
  buildCrmThreadId,
  buildSmsThreadId,
  parseCommunicationChannel,
} from './types';

export {
  analyzeInboundUrgencyHeuristic,
  buildInboundUrgencySystemPrompt,
  buildInboundUrgencyUserPrompt,
  parseInboundUrgencyJson,
} from './messageUrgency';

export {
  buildMailParseResult,
  extractEmails,
  extractPhonesCa,
  matchResidenceInInventory,
  mergeMailboxParse,
  parseMailBodyHeuristic,
  safeNormalizeAiMailParse,
} from './mailParser';

export {
  contactPhoneDigits,
  findContactsByEmail,
  findContactsByPhone,
  normalizeMailAddress,
  normalizePhoneDigits,
  resolveMessagePartyEmail,
  resolveThreadPartyEmail,
  type ContactEmailCandidate,
  type ContactPhoneCandidate,
  type MessagePartyEmailSource,
  type ThreadPartyEmailSource,
} from './contactMatch';
