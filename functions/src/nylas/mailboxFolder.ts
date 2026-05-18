export type MailboxFolder = 'INBOX' | 'SENT' | 'DRAFT' | 'TRASH' | 'ARCHIVE';

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
