/**
 * Résolution courriel ↔ contact CRM (Phase 2 messagerie).
 */

export function normalizeMailAddress(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const v = email.trim().toLowerCase();
  return v.includes('@') ? v : null;
}

export type MessagePartyEmailSource = {
  mailContactEmail?: string | null;
  fromEmailAddress?: string | null;
  direction?: 'inbound' | 'outbound';
};

export type ThreadPartyEmailSource = {
  contactEmail?: string | null;
};

/** Courriel de la partie (vendeur/acheteur) pour rattachement CRM. */
export function resolveMessagePartyEmail(message: MessagePartyEmailSource): string | null {
  return (
    normalizeMailAddress(message.mailContactEmail) ??
    normalizeMailAddress(message.fromEmailAddress)
  );
}

/** Priorité : dernier message entrant, puis fil.contactEmail. */
export function resolveThreadPartyEmail(
  thread: ThreadPartyEmailSource,
  messages: readonly MessagePartyEmailSource[]
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.direction === 'outbound') continue;
    const email = resolveMessagePartyEmail(msg);
    if (email) return email;
  }
  return normalizeMailAddress(thread.contactEmail);
}

export interface ContactEmailCandidate {
  id: string;
  email: string;
  displayName: string;
}

/** Filtre les contacts CRM par courriel exact (normalisé). */
export function findContactsByEmail<T extends ContactEmailCandidate>(
  contacts: readonly T[],
  emailRaw: unknown
): T[] {
  const email = normalizeMailAddress(emailRaw);
  if (!email) return [];
  return contacts.filter((c) => normalizeMailAddress(c.email) === email);
}
