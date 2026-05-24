/**
 * IA Mailbox — exports publics @primexpert/core/mail
 */

export type {
  InventoryResidenceRef,
  MailContactIntent,
  MailLeadExtraction,
  MailParseResult,
  MailResidenceHint,
  MailUrgency,
  ResidenceMatchConfidence,
} from './types';

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
  findContactsByEmail,
  normalizeMailAddress,
  resolveMessagePartyEmail,
  resolveThreadPartyEmail,
  type ContactEmailCandidate,
  type MessagePartyEmailSource,
  type ThreadPartyEmailSource,
} from './contactMatch';
