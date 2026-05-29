/**
 * Portail vendeur — jeton d'invitation et notifications (Cloud Functions).
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { app, auth } from '../lib/firebase';

const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';
const functions = getFunctions(app, functionsRegion);

export interface VendorBrokerContact {
  displayName: string;
  email?: string;
  phone?: string;
}

export interface VendorPortalClientSession {
  orgId: string;
  contactId: string;
  residenceId: string;
  brokerId: string;
  contactName: string;
  propertyLabel: string;
  token: string;
  brokerContact?: VendorBrokerContact;
}

export async function createVendorPortalInviteLink(input: {
  orgId: string;
  contactId: string;
  residenceId: string;
}): Promise<{ token: string; path: string; expiresAtMillis: number }> {
  const callable = httpsCallable<
    typeof input,
    { token: string; path: string; expiresAtMillis: number }
  >(functions, 'createVendorPortalInvite');
  const res = await callable(input);
  return res.data;
}

export async function redeemVendorPortalToken(
  token: string
): Promise<VendorPortalClientSession> {
  const callable = httpsCallable<
    { token: string },
    VendorPortalClientSession & { customToken: string; ok: boolean }
  >(functions, 'validateVendorPortalToken');
  const res = await callable({ token });
  const data = res.data;
  if (data.customToken) {
    await signInWithCustomToken(auth, data.customToken);
  }
  const brokerDisplayName = String(data.brokerDisplayName ?? '').trim();
  const brokerEmail = String(data.brokerEmail ?? '').trim();
  const brokerPhone = String(data.brokerPhone ?? '').trim();

  return {
    orgId: data.orgId,
    contactId: data.contactId,
    residenceId: data.residenceId,
    brokerId: data.brokerId,
    contactName: data.contactName,
    propertyLabel: data.propertyLabel,
    token,
    brokerContact: brokerDisplayName
      ? {
          displayName: brokerDisplayName,
          email: brokerEmail || undefined,
          phone: brokerPhone || undefined,
        }
      : undefined,
  };
}

export async function signOutVendorPortalSession(): Promise<void> {
  await signOut(auth);
}

export async function notifyVendorPortalDocumentUpload(input: {
  orgId: string;
  brokerId: string;
  residenceId: string;
  documentId: string;
  documentLabel: string;
  contactName: string;
  contactId?: string;
  token?: string;
}): Promise<void> {
  const callable = httpsCallable(functions, 'notifyVendorPortalDocumentUpload');
  await callable(input);
}

/** Patch résidence depuis le portail vendeur (déclaration, identité). */
export async function patchVendorPortalResidence(input: {
  residenceId: string;
  patch: Record<string, unknown>;
  token?: string;
}): Promise<void> {
  const callable = httpsCallable<
    typeof input,
    { ok: boolean }
  >(functions, 'patchVendorPortalResidence');
  await callable(input);
}
