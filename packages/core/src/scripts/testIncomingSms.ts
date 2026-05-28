/**
 * Simulation SMS entrant (format Twilio) → SSOT email_threads / messages
 *
 * Usage :
 *   npx tsx packages/core/src/scripts/testIncomingSms.ts --broker-id=UID --org-id=org_XXX --contact-id=CONTACT_ID
 *   npm run test:incoming-sms -- --broker-id=... --org-id=... --contact-id=...
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCrmThreadId } from '../mail/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../..');

const SAMPLE_BODY =
  'Bonjour Alain, visite complétée hier. Tremblay veut une baisse pour la toiture — planifier un suivi ce vendredi svp.';

const KRISTEL_NAME = 'Kristel Tremblay';

function parseArgv(argv: string[]) {
  return {
    brokerId:
      argv.find((a) => a.startsWith('--broker-id='))?.slice('--broker-id='.length)?.trim() ||
      process.env.TEST_BROKER_ID?.trim(),
    orgId:
      argv.find((a) => a.startsWith('--org-id='))?.slice('--org-id='.length)?.trim() ||
      process.env.TEST_ORG_ID?.trim(),
    contactId:
      argv.find((a) => a.startsWith('--contact-id='))?.slice('--contact-id='.length)?.trim() ||
      process.env.TEST_CONTACT_ID?.trim(),
    phone:
      argv.find((a) => a.startsWith('--from-phone='))?.slice('--from-phone='.length)?.trim() ||
      '+15145550199',
  };
}

async function main() {
  const opts = parseArgv(process.argv.slice(2));
  if (!opts.brokerId || !opts.orgId || !opts.contactId) {
    throw new Error('Requis : --broker-id, --org-id, --contact-id');
  }

  const saPath = resolve(ROOT, 'serviceAccountNew.json');
  if (!existsSync(saPath)) {
    throw new Error('serviceAccountNew.json requis à la racine du dépôt.');
  }

  process.env.FIRESTORE_DATABASE_ID =
    process.env.FIRESTORE_DATABASE_ID || 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'primexpert-app-v2';

  const { cert, initializeApp, getApps, deleteApp } = await import('firebase-admin/app');
  const sa = JSON.parse(readFileSync(saPath, 'utf8'));
  while (getApps().length) await deleteApp(getApps()[0]);
  initializeApp({ credential: cert(sa) });

  const { ingestOmnichannelMessage } = await import(
    '../../../../functions/src/messaging/ingestOmnichannelMessage.ts'
  );

  const messageSid = `SM_sim_${Date.now()}`;
  const threadId = buildCrmThreadId(opts.contactId);

  console.log('\n=== Simulation SMS Twilio → Firestore ===');
  console.log('Contact    :', KRISTEL_NAME, `(${opts.contactId})`);
  console.log('Courtier   :', opts.brokerId);
  console.log('Fil SSOT   :', `users/${opts.brokerId}/email_threads/${threadId}`);
  console.log('Corps      :', SAMPLE_BODY);

  const result = await ingestOmnichannelMessage({
    brokerId: opts.brokerId,
    orgId: opts.orgId,
    channel: 'sms',
    direction: 'inbound',
    body: SAMPLE_BODY,
    contactName: KRISTEL_NAME,
    contactPhone: opts.phone,
    matchedContactId: opts.contactId,
    externalThreadKey: threadId,
    externalMessageId: messageSid,
    analyzeUrgency: false,
    metadata: {
      externalSenderId: opts.phone,
      fromPhone: opts.phone,
      twilioMessageSid: messageSid,
    },
  });

  console.log('\n✅ Message injecté');
  console.log('  threadId   :', result.threadId);
  console.log('  messageId  :', result.messageId);
  console.log('  isCritical :', result.isCritical);
  console.log('\nOuvrez le CRM → contact Kristel → Intelligence pour valider le fil unifié.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
