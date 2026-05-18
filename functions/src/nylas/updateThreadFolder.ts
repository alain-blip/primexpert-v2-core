import { userThreadsCol } from '../lib/firestore';
import type { MailboxFolder } from './mailboxFolder';
import { nylasApiBase, requireNylasApiKey } from './config';
import { resolveNylasFolderId } from './resolveNylasFolderId';

export type ThreadFolderMove = 'ARCHIVE' | 'TRASH';

export interface UpdateThreadFolderInput {
  brokerId: string;
  grantId: string;
  /** ID Firestore du fil PrimeXpert. */
  threadId: string;
  folder: ThreadFolderMove;
}

/** Déplace le fil Nylas + met à jour `mailboxFolder` dans Firestore. */
export async function moveNylasThreadToFolder(input: UpdateThreadFolderInput): Promise<void> {
  const { brokerId, grantId, threadId, folder } = input;

  const threadSnap = await userThreadsCol(brokerId).doc(threadId).get();
  if (!threadSnap.exists) throw new Error('Fil introuvable.');

  const thread = threadSnap.data()!;
  const nylasThreadId = thread.nylasThreadId as string | undefined;
  if (!nylasThreadId) {
    throw new Error('Ce fil n’est pas lié à Nylas.');
  }

  const folderId = await resolveNylasFolderId(grantId, folder);
  const apiKey = requireNylasApiKey();
  const encodedThreadId = encodeURIComponent(nylasThreadId);

  const res = await fetch(
    `${nylasApiBase()}/v3/grants/${grantId}/threads/${encodedThreadId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ folders: [folderId] }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nylas thread update failed: ${res.status} ${text}`);
  }

  await userThreadsCol(brokerId).doc(threadId).update({
    mailboxFolder: folder satisfies MailboxFolder,
  });
}
