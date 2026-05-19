/**
 * Client Nylas — appels Cloud Functions (OAuth + envoi).
 * Secrets NYLAS_* restent côté Functions uniquement.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';

const region = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';
const functions = getFunctions(app, region);

export function isNylasConfigured(): boolean {
  return import.meta.env.VITE_NYLAS_ENABLED === 'true';
}

export async function fetchNylasAuthUrl(input: {
  accountId: string;
  label: string;
  provider: 'gmail' | 'outlook';
  returnUrl?: string;
}): Promise<string> {
  const fn = httpsCallable<
    typeof input,
    { url: string }
  >(functions, 'nylasGetAuthUrl');
  const { data } = await fn({
    ...input,
    returnUrl: input.returnUrl ?? window.location.origin,
  });
  if (!data?.url) throw new Error('URL OAuth Nylas indisponible.');
  return data.url;
}

export async function sendViaNylas(input: {
  threadId: string;
  body: string;
  accountId: string;
}): Promise<void> {
  const fn = httpsCallable<typeof input, { ok: boolean }>(functions, 'nylasSendMessage');
  await fn(input);
}

export type DocumentSelectionTargetRole = 'buyer' | 'notary' | 'banker' | 'custom';

export async function sendDocumentSelectionViaNylas(input: {
  documentIds: string[];
  targetRole: DocumentSelectionTargetRole;
  recipientEmail: string;
  subject: string;
  message: string;
  accountId: string;
  propertyId?: string;
  contactId?: string;
}): Promise<{ sentCount: number; threadId: string }> {
  const fn = httpsCallable<
    typeof input,
    { ok: boolean; sentCount: number; threadId: string }
  >(functions, 'sendDocumentSelection');
  const { data } = await fn(input);
  if (!data?.threadId) throw new Error('Envoi Prime-Mail sans identifiant de fil.');
  return { sentCount: data.sentCount ?? 0, threadId: data.threadId };
}

export async function sendSellerUpdateViaNylas(input: {
  toEmail: string;
  toName?: string;
  subject: string;
  body: string;
  accountId: string;
  propertyId?: string;
  propertyLabel?: string;
}): Promise<{ threadId: string }> {
  const fn = httpsCallable<
    typeof input,
    { ok: boolean; threadId: string }
  >(functions, 'nylasSendSellerUpdate');
  const { data } = await fn(input);
  if (!data?.threadId) throw new Error('Envoi Nylas sans identifiant de fil.');
  return { threadId: data.threadId };
}

export type NylasThreadFolderMove = 'ARCHIVE' | 'TRASH';

export async function moveThreadViaNylas(input: {
  threadId: string;
  accountId: string;
  folder: NylasThreadFolderMove;
}): Promise<void> {
  const fn = httpsCallable<typeof input, { ok: boolean }>(
    functions,
    'nylasUpdateThreadFolder'
  );
  await fn(input);
}
