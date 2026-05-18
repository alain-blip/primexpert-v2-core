/** Dossiers courriel standard (alignés Nylas / Gmail). */

export type MailboxFolder = 'INBOX' | 'SENT' | 'DRAFT' | 'TRASH' | 'ARCHIVE';

export const MAILBOX_FOLDERS: MailboxFolder[] = [
  'INBOX',
  'SENT',
  'DRAFT',
  'TRASH',
  'ARCHIVE',
];

export function normalizeMailboxFolder(raw: unknown): MailboxFolder {
  const v = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (
    v === 'INBOX' ||
    v === 'SENT' ||
    v === 'DRAFT' ||
    v === 'TRASH' ||
    v === 'ARCHIVE'
  ) {
    return v;
  }
  return 'INBOX';
}

/** Déduit le dossier à partir des libellés Nylas (`folders`) ou du sens du message. */
export function resolveMailboxFolderFromNylas(
  folders: unknown,
  direction?: 'inbound' | 'outbound'
): MailboxFolder {
  const tags = Array.isArray(folders)
    ? folders.map((f) => String(f).trim().toUpperCase())
    : [];

  const has = (token: string) => tags.some((t) => t === token || t.includes(token));

  if (has('TRASH')) return 'TRASH';
  if (has('DRAFT')) return 'DRAFT';
  if (has('SENT')) return 'SENT';
  if (has('ARCHIVE')) return 'ARCHIVE';
  if (has('INBOX')) return 'INBOX';

  return direction === 'outbound' ? 'SENT' : 'INBOX';
}

export function folderLabel(folder: MailboxFolder, locale: 'fr' | 'en'): string {
  const labels: Record<MailboxFolder, { fr: string; en: string }> = {
    INBOX: { fr: 'Boîte de réception', en: 'Inbox' },
    SENT: { fr: 'Envoyés', en: 'Sent' },
    DRAFT: { fr: 'Brouillons', en: 'Drafts' },
    TRASH: { fr: 'Corbeille', en: 'Trash' },
    ARCHIVE: { fr: 'Archives', en: 'Archive' },
  };
  return locale === 'fr' ? labels[folder].fr : labels[folder].en;
}
