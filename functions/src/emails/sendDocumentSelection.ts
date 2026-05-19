import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../lib/firestore';
import { sendNylasToRecipient } from '../nylas/sendToRecipient';

export type DocumentSelectionTargetRole = 'buyer' | 'notary' | 'banker' | 'custom';

export interface SendDocumentSelectionInput {
  brokerId: string;
  documentIds: string[];
  targetRole: DocumentSelectionTargetRole;
  recipientEmail: string;
  subject: string;
  message: string;
  accountId?: string;
  propertyId?: string;
  contactId?: string;
}

interface ResolvedDocumentLink {
  id: string;
  fileName: string;
  storagePath: string;
  url: string;
}

const DRIVE_DOCUMENTS = 'drive_documents';
const RESIDENCES = 'residences';
const DOCUMENTS = 'documents';
const SIGNED_URL_VALIDITY_DAYS = 21;

function adminStorage() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getStorage } = require('firebase-admin/storage') as typeof import('firebase-admin/storage');
  return getStorage();
}

async function signedUrlForPath(storagePath: string): Promise<string> {
  const [url] = await adminStorage().bucket().file(storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  });
  return url;
}

function parseDocumentId(raw: string): { scope: string; id: string } {
  const idx = raw.indexOf(':');
  if (idx > 0) {
    return { scope: raw.slice(0, idx), id: raw.slice(idx + 1) };
  }
  return { scope: 'property', id: raw };
}

async function resolveDriveDocument(id: string, brokerId: string): Promise<ResolvedDocumentLink | null> {
  const snap = await getDb().collection(DRIVE_DOCUMENTS).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  if (data.courtiersResponsables !== brokerId) return null;
  if (data.type === 'folder') return null;
  const storagePath = String(data.storagePath ?? '');
  if (!storagePath) return null;
  return {
    id,
    fileName: String(data.fileName ?? 'document'),
    storagePath,
    url: await signedUrlForPath(storagePath),
  };
}

async function resolvePropertyDocument(
  id: string,
  propertyId: string | undefined,
  brokerId: string
): Promise<ResolvedDocumentLink | null> {
  if (!propertyId) return null;
  const ref = getDb().collection(RESIDENCES).doc(propertyId).collection(DOCUMENTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  if (data.uploadedBy !== brokerId) return null;
  const storagePath = String(data.storagePath ?? '');
  if (!storagePath) return null;
  return {
    id,
    fileName: String(data.fileName ?? 'document'),
    storagePath,
    url: await signedUrlForPath(storagePath),
  };
}

async function resolveSelectedDocuments(input: SendDocumentSelectionInput): Promise<ResolvedDocumentLink[]> {
  const out: ResolvedDocumentLink[] = [];
  for (const raw of input.documentIds) {
    const parsed = parseDocumentId(raw);
    const doc =
      parsed.scope === 'property'
        ? await resolvePropertyDocument(parsed.id, input.propertyId, input.brokerId)
        : await resolveDriveDocument(parsed.id, input.brokerId);
    if (doc) out.push(doc);
  }
  return out;
}

function buildHtmlBody(message: string, docs: ResolvedDocumentLink[]): string {
  const links = docs
    .map(
      (d) =>
        `<li><a href="${d.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(d.fileName)}</a></li>`
    )
    .join('');
  return `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
      <p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0"/>
      <p><strong>Documents PrimeXpert sécurisés :</strong></p>
      <ul>${links}</ul>
      <p style="font-size:12px;color:#6b7280">Liens de téléchargement temporaires générés par Prime-Drive, disponibles de façon sécurisée pour une période de 21 jours.</p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resolveAccount(accounts: Record<string, unknown>[], accountId?: string): Record<string, unknown> {
  const acc = accountId
    ? accounts.find((a) => a.id === accountId)
    : accounts.find((a) => a.isDefault === true) ?? accounts[0];
  if (!acc) throw new Error('Aucun compte courriel configuré.');
  if (typeof acc.nylasGrantId !== 'string' || !acc.nylasGrantId) {
    throw new Error('Ce compte n’est pas relié à Nylas. Reconnectez la boîte dans Paramètres.');
  }
  return acc;
}

async function logActivity(input: SendDocumentSelectionInput, docs: ResolvedDocumentLink[]): Promise<void> {
  const payload = {
    type: 'document_selection_sent',
    targetRole: input.targetRole,
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    documentIds: input.documentIds,
    documentNames: docs.map((d) => d.fileName),
    sentAtMillis: Date.now(),
    sentAt: FieldValue.serverTimestamp(),
    brokerId: input.brokerId,
  };
  if (input.propertyId) {
    await getDb().collection(RESIDENCES).doc(input.propertyId).collection('activities').add(payload);
    return;
  }
  if (input.contactId) {
    await getDb()
      .collection('users')
      .doc(input.brokerId)
      .collection('contacts')
      .doc(input.contactId)
      .collection('activities')
      .add(payload);
    return;
  }
  await getDb().collection('users').doc(input.brokerId).collection('activities').add(payload);
}

export async function sendDocumentSelectionEmail(
  input: SendDocumentSelectionInput
): Promise<{ sentCount: number; threadId: string }> {
  if (!input.documentIds.length) throw new Error('Aucun document sélectionné.');
  if (!input.recipientEmail.includes('@')) throw new Error('Adresse courriel destinataire invalide.');

  const userSnap = await getDb().collection('users').doc(input.brokerId).get();
  const accounts = userSnap.data()?.emailAccounts;
  if (!Array.isArray(accounts)) throw new Error('Aucun compte courriel configuré.');
  const account = resolveAccount(accounts as Record<string, unknown>[], input.accountId);

  const docs = await resolveSelectedDocuments(input);
  if (!docs.length) throw new Error('Aucun document téléchargeable trouvé.');

  const { threadId } = await sendNylasToRecipient({
    brokerId: input.brokerId,
    accountId: String(account.id ?? ''),
    grantId: String(account.nylasGrantId),
    toEmail: input.recipientEmail,
    subject: input.subject,
    body: buildHtmlBody(input.message, docs),
    fromEmailAddress:
      typeof account.emailAddress === 'string' ? account.emailAddress : undefined,
    propertyId: input.propertyId,
  });

  await logActivity(input, docs);
  return { sentCount: docs.length, threadId };
}
