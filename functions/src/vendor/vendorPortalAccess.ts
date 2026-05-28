/**
 * Portail vendeur autonome — invitation par jeton et notification téléversement.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { randomBytes } from 'node:crypto';
import { getDb } from '../lib/firestore';
import { createVendorPortalUploadBrokerTask } from '../messaging/ingestOmnichannelMessage';

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function buildPropertyLabel(data: Record<string, unknown>, fallback: string): string {
  const address = typeof data.address === 'string' ? data.address.trim() : '';
  const city = typeof data.city === 'string' ? data.city.trim() : '';
  if (address && city) return `${address}, ${city}`;
  return address || fallback;
}

/** Courtier — crée un jeton d'accès vendeur (30 jours). */
export const createVendorPortalInvite = onCall({ invoker: 'public' }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Connexion requise.');
  }
  const orgId = String(request.data?.orgId ?? '').trim();
  const contactId = String(request.data?.contactId ?? '').trim();
  const residenceId = String(request.data?.residenceId ?? '').trim();
  if (!orgId || !contactId || !residenceId) {
    throw new HttpsError('invalid-argument', 'orgId, contactId et residenceId requis.');
  }

  const db = getDb();
  const contactSnap = await db.collection('organizations').doc(orgId).collection('contacts').doc(contactId).get();
  if (!contactSnap.exists) {
    throw new HttpsError('not-found', 'Contact introuvable.');
  }
  const residenceSnap = await db.collection('residences').doc(residenceId).get();
  if (!residenceSnap.exists) {
    throw new HttpsError('not-found', 'Résidence introuvable.');
  }

  const brokerId = request.auth.uid;
  const token = randomBytes(24).toString('hex');
  const now = Date.now();
  await db.collection('vendor_portal_invites').doc(token).set({
    token,
    orgId,
    contactId,
    residenceId,
    brokerId,
    createdBy: brokerId,
    createdAtMillis: now,
    expiresAtMillis: now + INVITE_TTL_MS,
    active: true,
  });

  return {
    ok: true,
    token,
    expiresAtMillis: now + INVITE_TTL_MS,
    path: `/acces-vendeur?token=${token}`,
  };
});

/** Vendeur — valide le jeton et retourne le contexte de session (sans auth Firebase). */
export const validateVendorPortalToken = onCall({ invoker: 'public' }, async (request) => {
  const token = String(request.data?.token ?? '').trim();
  if (!token) throw new HttpsError('invalid-argument', 'token requis.');

  const db = getDb();
  const inviteSnap = await db.collection('vendor_portal_invites').doc(token).get();
  if (!inviteSnap.exists) {
    throw new HttpsError('not-found', 'Lien invalide ou expiré.');
  }
  const invite = inviteSnap.data() as Record<string, unknown>;
  const expiresAtMillis = Number(invite.expiresAtMillis) || 0;
  if (invite.active !== true || expiresAtMillis < Date.now()) {
    throw new HttpsError('failed-precondition', 'Invitation expirée.');
  }

  const orgId = String(invite.orgId ?? '');
  const contactId = String(invite.contactId ?? '');
  const residenceId = String(invite.residenceId ?? '');
  const brokerId = String(invite.brokerId ?? '');

  const [contactSnap, residenceSnap] = await Promise.all([
    db.collection('organizations').doc(orgId).collection('contacts').doc(contactId).get(),
    db.collection('residences').doc(residenceId).get(),
  ]);

  if (!contactSnap.exists || !residenceSnap.exists) {
    throw new HttpsError('not-found', 'Dossier introuvable.');
  }

  const contact = contactSnap.data() as Record<string, unknown>;
  const residence = residenceSnap.data() as Record<string, unknown>;
  const contactName =
    [contact.firstName, contact.lastName].filter((x) => typeof x === 'string' && x.trim()).join(' ').trim() ||
    String(contact.company ?? contact.displayName ?? 'Vendeur');

  const vendorUid = `vendor_portal_${contactId}`;
  const customToken = await getAdminAuth().createCustomToken(vendorUid, {
    vendorPortal: true,
    orgId,
    contactId,
    residenceId,
    brokerId,
  });

  return {
    ok: true,
    orgId,
    contactId,
    residenceId,
    brokerId,
    contactName,
    propertyLabel: buildPropertyLabel(residence, residenceId),
    mode: 'client' as const,
    customToken,
  };
});

/** Après téléversement (client ou courtier) — notifie le courtier via tâche CRM. */
export const notifyVendorPortalDocumentUpload = onCall({ invoker: 'public' }, async (request) => {
  const orgId = String(request.data?.orgId ?? '').trim();
  const brokerId = String(request.data?.brokerId ?? '').trim();
  const residenceId = String(request.data?.residenceId ?? '').trim();
  const documentId = String(request.data?.documentId ?? '').trim();
  const documentLabel = String(request.data?.documentLabel ?? 'Document').trim();
  const contactName = String(request.data?.contactName ?? 'Vendeur').trim();
  const contactId = request.data?.contactId ? String(request.data.contactId) : null;
  const token = String(request.data?.token ?? '').trim();

  if (!orgId || !brokerId || !residenceId || !documentId) {
    throw new HttpsError('invalid-argument', 'Champs requis manquants.');
  }

  if (token) {
    const inviteSnap = await getDb().collection('vendor_portal_invites').doc(token).get();
    if (!inviteSnap.exists) throw new HttpsError('permission-denied', 'Jeton invalide.');
    const invite = inviteSnap.data() as Record<string, unknown>;
    if (String(invite.orgId) !== orgId || String(invite.residenceId) !== residenceId) {
      throw new HttpsError('permission-denied', 'Jeton non autorisé pour ce dossier.');
    }
  } else if (request.auth?.uid !== brokerId) {
    throw new HttpsError('permission-denied', 'Non autorisé.');
  }

  const residenceSnap = await getDb().collection('residences').doc(residenceId).get();
  const propertyLabel = residenceSnap.exists
    ? buildPropertyLabel(residenceSnap.data() as Record<string, unknown>, residenceId)
    : residenceId;

  const now = Date.now();
  await createVendorPortalUploadBrokerTask({
    orgId,
    brokerId,
    residenceId,
    documentId,
    contactId,
    contactName,
    propertyLabel,
    documentLabel,
    uploadedAtMillis: now,
  });

  await getDb()
    .collection('residences')
    .doc(residenceId)
    .set(
      {
        vendorPortalLastUploadAtMillis: now,
        vendorPortalLastUploadLabel: documentLabel,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return { ok: true };
});
