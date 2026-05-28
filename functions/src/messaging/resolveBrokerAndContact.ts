/**
 * Résolution courtier (numéro Twilio) et contact CRM (téléphone / réseau).
 */

import { getDb } from '../lib/firestore';
import { findContactsByPhone, normalizePhoneDigits } from '../nylas/_vendored/mail';

export interface BrokerTelephonyRef {
  uid: string;
  orgId: string;
}

function normalizeE164ish(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return value.startsWith('+') ? value : `+${digits}`;
}

export async function resolveBrokerByTwilioNumber(
  toNumber: string
): Promise<BrokerTelephonyRef | null> {
  const normalized = normalizeE164ish(toNumber);
  const db = getDb();
  const snap = await db.collection('users').limit(500).get();
  for (const doc of snap.docs) {
    const telephony = doc.data().telephony as Record<string, unknown> | undefined;
    const twilioNumber =
      typeof telephony?.twilioNumber === 'string' ? telephony.twilioNumber : '';
    if (!twilioNumber) continue;
    if (normalizeE164ish(twilioNumber) === normalized) {
      const orgId = String(doc.data().orgId ?? '');
      if (!orgId) continue;
      return { uid: doc.id, orgId };
    }
  }
  return null;
}

export interface ResolvedCrmContact {
  id: string;
  displayName: string;
  phone?: string | null;
}

export async function findBrokerContactByPhone(
  brokerId: string,
  orgId: string,
  phoneRaw: string
): Promise<ResolvedCrmContact | null> {
  const needle = normalizePhoneDigits(phoneRaw);
  if (!needle || !orgId) return null;

  const snap = await getDb()
    .collection('organizations')
    .doc(orgId)
    .collection('contacts')
    .limit(400)
    .get();

  const candidates = snap.docs.map((d) => {
    const data = d.data();
    const nom = typeof data.nom === 'string' ? data.nom : '';
    const prenom = typeof data.prenom === 'string' ? data.prenom : '';
    const displayName = [prenom, nom].filter(Boolean).join(' ').trim() || nom || 'Contact';
    return {
      id: d.id,
      displayName,
      phone: typeof data.telephone === 'string' ? data.telephone : data.phone,
      mobile: typeof data.mobile === 'string' ? data.mobile : data.cellulaire,
      ownerId: data.ownerId,
      visibility: data.visibility,
    };
  });

  const owned = candidates.filter(
    (c) => c.ownerId === brokerId || c.visibility === 'AGENCY_SHARED'
  );

  const matches = findContactsByPhone(owned, phoneRaw);
  const hit = matches[0];
  if (!hit) return null;
  return { id: hit.id, displayName: hit.displayName, phone: hit.phone ?? null };
}
