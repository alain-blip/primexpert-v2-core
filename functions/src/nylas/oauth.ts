import * as crypto from 'crypto';
import { getDb } from '../lib/firestore';
import type { OAuthStatePayload } from './types';
import {
  appReturnUrl,
  nylasApiBase,
  oauthRedirectUri,
  requireNylasApiKey,
  requireNylasClientId,
} from './config';

function oauthSecret(): string {
  return (
    process.env.NYLAS_OAUTH_STATE_SECRET?.trim() ||
    process.env.NYLAS_API_KEY?.trim() ||
    'primexpert-oauth-dev'
  );
}

export function encodeOAuthState(payload: OAuthStatePayload): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', oauthSecret()).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

export function decodeOAuthState(state: string): OAuthStatePayload | null {
  const [b64, sig] = state.split('.');
  if (!b64 || !sig) return null;
  const expected = crypto.createHmac('sha256', oauthSecret()).update(b64).digest('base64url');
  if (sig !== expected) return null;
  try {
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    const data = JSON.parse(json) as OAuthStatePayload;
    if (!data.uid || !data.accountId) return null;
    return data;
  } catch {
    return null;
  }
}

export function buildNylasAuthUrl(state: OAuthStatePayload): string {
  const clientId = requireNylasClientId();
  const redirect = encodeURIComponent(oauthRedirectUri());
  const provider = state.provider === 'outlook' ? 'microsoft' : 'google';
  const stateParam = encodeURIComponent(encodeOAuthState(state));
  return `${nylasApiBase()}/v3/connect/auth?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&access_type=online&provider=${provider}&state=${stateParam}`;
}

export async function exchangeCodeForGrant(code: string): Promise<{
  grantId: string;
  email: string;
}> {
  const apiKey = requireNylasApiKey();
  const clientId = requireNylasClientId();
  const clientSecret = process.env.NYLAS_CLIENT_SECRET?.trim();
  if (!clientSecret) throw new Error('NYLAS_CLIENT_SECRET manquant.');

  const res = await fetch(`${nylasApiBase()}/v3/connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: oauthRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nylas token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { grant_id?: string; email?: string };
  if (!data.grant_id) throw new Error('grant_id absent dans la réponse Nylas.');
  return { grantId: data.grant_id, email: data.email || '' };
}

export async function attachGrantToUserAccount(
  uid: string,
  accountId: string,
  grantId: string,
  email: string
): Promise<void> {
  const ref = getDb().collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Utilisateur introuvable.');
  const accounts = Array.isArray(snap.data()?.emailAccounts)
    ? [...(snap.data()!.emailAccounts as Record<string, unknown>[])]
    : [];

  let found = false;
  const next = accounts.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const acc = raw as Record<string, unknown>;
    if (acc.id !== accountId) return acc;
    found = true;
    return {
      ...acc,
      emailAddress: email || acc.emailAddress,
      nylasGrantId: grantId,
      syncStatus: 'connected',
      connectedAt: new Date().toISOString(),
    };
  });

  if (!found) {
    next.push({
      id: accountId,
      emailAddress: email,
      label: email,
      isDefault: next.length === 0,
      syncStatus: 'connected',
      provider: 'gmail',
      nylasGrantId: grantId,
      connectedAt: new Date().toISOString(),
    });
  }

  await ref.update({ emailAccounts: next });
}

export function oauthSuccessRedirect(accountId: string): string {
  const base = appReturnUrl();
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}tab=settings&nylas=connected&accountId=${encodeURIComponent(accountId)}`;
}

export function oauthErrorRedirect(message: string): string {
  const base = appReturnUrl().replace(/\/$/, '');
  return `${base}?tab=settings&nylas=error&msg=${encodeURIComponent(message.slice(0, 120))}`;
}
