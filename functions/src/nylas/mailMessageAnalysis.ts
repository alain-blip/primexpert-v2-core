import { getDb } from '../lib/firestore';
import {
  buildMailParseResult,
  type InventoryResidenceRef,
  type MailParseResult,
} from './_vendored/mail';

const RESIDENCES = 'residences';

/** Inventaire courtier pour matching adresse (SSOT @primexpert/core/mail). */
export async function loadBrokerResidenceInventory(
  brokerId: string
): Promise<InventoryResidenceRef[]> {
  const snap = await getDb()
    .collection(RESIDENCES)
    .where('courtiersResponsables', '==', brokerId)
    .select('address', 'city')
    .limit(250)
    .get();

  const rows: InventoryResidenceRef[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    rows.push({
      id: doc.id,
      address: String(d.address ?? ''),
      city: String(d.city ?? ''),
    });
  }
  return rows;
}

export interface BuildInboundMailAnalysisInput {
  brokerId: string;
  body: string;
  subject?: string;
  sender?: string;
  contactEmail?: string;
  residences?: readonly InventoryResidenceRef[];
}

/** Analyse heuristique (Gemini optionnel — hors scope Phase 1 webhook). */
export function buildInboundMailAnalysis(
  input: BuildInboundMailAnalysisInput
): MailParseResult {
  return buildMailParseResult(input.body, {
    subject: input.subject,
    sender: input.sender,
    residences: input.residences,
  });
}

/** Champs Firestore injectés sur `email_threads/{id}/messages/{id}`. */
export function mailAnalysisToFirestoreFields(
  brokerId: string,
  parse: MailParseResult,
  opts: { contactEmail?: string; analyzedAtMillis: number }
): Record<string, unknown> {
  const matched =
    parse.residence.matchedResidenceId?.trim() ||
    null;
  const email =
    parse.lead.email?.trim().toLowerCase() ||
    opts.contactEmail?.trim().toLowerCase() ||
    null;

  return {
    brokerId,
    mailAnalysisAtMillis: opts.analyzedAtMillis,
    matchedResidenceId: matched,
    mailContactEmail: email,
    mailContactName: parse.lead.contactName,
    mailIntent: parse.lead.intent,
    summaryOneLine: parse.summaryOneLine,
    mailUrgency: parse.urgency,
    mailAnalysisSource: 'heuristic',
  };
}
