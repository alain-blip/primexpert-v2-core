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
