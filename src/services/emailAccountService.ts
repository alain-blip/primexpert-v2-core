/**
 * Persistance des comptes courriel sur `users/{uid}.emailAccounts`.
 */

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ensureSingleDefault, normalizeEmailAccounts } from '../lib/emailAccounts';
import type { EmailAccount } from '../types/emailAccount';

export async function saveUserEmailAccounts(
  uid: string,
  accounts: EmailAccount[]
): Promise<void> {
  if (!uid) return;
  const normalized = ensureSingleDefault(accounts);
  await updateDoc(doc(db, 'users', uid), { emailAccounts: normalized });
}

export function parseEmailAccountsFromFirestore(raw: unknown): EmailAccount[] {
  return normalizeEmailAccounts(raw);
}
