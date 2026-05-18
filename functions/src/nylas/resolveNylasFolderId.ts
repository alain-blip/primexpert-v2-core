import { nylasApiBase, requireNylasApiKey } from './config';
import type { MailboxFolder } from './mailboxFolder';

interface NylasFolderRow {
  id?: string;
  name?: string;
  attributes?: string[];
}

const FOLDER_ATTR: Partial<Record<MailboxFolder, string>> = {
  TRASH: '\\Trash',
  ARCHIVE: '\\Archive',
};

const FOLDER_NAME_RE: Partial<Record<MailboxFolder, RegExp>> = {
  TRASH: /trash|corbeille|deleted|supprim/i,
  ARCHIVE: /archive/i,
};

const cache = new Map<string, { at: number; ids: Partial<Record<MailboxFolder, string>> }>();
const CACHE_MS = 5 * 60 * 1000;

/** Résout l’ID dossier Nylas via attributs système (`\Trash`, `\Archive`). */
export async function resolveNylasFolderId(
  grantId: string,
  folder: MailboxFolder
): Promise<string> {
  const attr = FOLDER_ATTR[folder];
  if (!attr) throw new Error(`Dossier Nylas non supporté: ${folder}`);

  const now = Date.now();
  const hit = cache.get(grantId);
  if (hit && now - hit.at < CACHE_MS && hit.ids[folder]) {
    return hit.ids[folder]!;
  }

  const apiKey = requireNylasApiKey();
  const res = await fetch(`${nylasApiBase()}/v3/grants/${grantId}/folders?limit=200`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nylas folders list failed: ${res.status} ${text}`);
  }

  const body = (await res.json()) as { data?: NylasFolderRow[] };
  const rows = body.data ?? [];
  const ids: Partial<Record<MailboxFolder, string>> = { ...hit?.ids };

  for (const row of rows) {
    if (!row.id) continue;
    const attrs = row.attributes ?? [];
    const name = String(row.name ?? '');
    if (attrs.some((a) => a === '\\Trash' || a.includes('Trash'))) ids.TRASH = row.id;
    if (attrs.some((a) => a === '\\Archive' || a.includes('Archive'))) ids.ARCHIVE = row.id;
    if (FOLDER_NAME_RE.TRASH?.test(name) && !ids.TRASH) ids.TRASH = row.id;
    if (FOLDER_NAME_RE.ARCHIVE?.test(name) && !ids.ARCHIVE) ids.ARCHIVE = row.id;
  }

  cache.set(grantId, { at: now, ids });

  const id = ids[folder];
  if (!id) throw new Error(`Dossier ${folder} introuvable sur ce compte.`);
  return id;
}
