import type { CollectionReference, DocumentSnapshot } from 'firebase-admin/firestore';

/** Identifiant Firestore stable pour un message Nylas (évite les requêtes indexées). */
export function nylasMessageDocId(nylasMessageId: string): string {
  const trimmed = nylasMessageId.trim();
  if (!trimmed) return `msg_${Date.now()}`;
  const safe = trimmed.replace(/\//g, '_').replace(/[^\w.-]/g, '_');
  if (safe.length > 0 && safe.length <= 128) return safe;
  const b64 = Buffer.from(trimmed, 'utf8').toString('base64url').slice(0, 120);
  return `msg_${b64}`;
}

/** Recherche un message existant par `nylasMessageId` sans index composite. */
export async function findMessageByNylasId(
  col: CollectionReference,
  nylasMessageId: string
): Promise<DocumentSnapshot | null> {
  const primary = await col.doc(nylasMessageDocId(nylasMessageId)).get();
  if (primary.exists && primary.data()?.nylasMessageId === nylasMessageId) {
    return primary;
  }

  const legacy = await col.select('nylasMessageId').limit(200).get();
  for (const doc of legacy.docs) {
    if (doc.get('nylasMessageId') === nylasMessageId) return doc;
  }
  return null;
}
