import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { useWorkhubNav } from '../../lib/workhubNav';
import { stashListingsFocusResidenceId } from '../../lib/listingsFocus';
import type { EmailMessage, EmailThread } from '../../types/emailSync';
import type { MailboxFolder } from '../../lib/mailboxFolders';
import {
  applyMailboxFolderFilter,
  countThreadsByFolder,
  markThreadRead,
  seedDemoEmailThreadsIfEmpty,
  sendMessage,
  subscribeEmailThreads,
  subscribeThreadMessages,
  updateThreadMailboxFolder,
} from '../../services/emailSyncService';
import type { NylasThreadFolderMove } from '../../services/nylasClient';
import { isNylasConfigured, moveThreadViaNylas } from '../../services/nylasClient';
import { MailboxFolderSidebar } from './MailboxFolderSidebar';
import {
  resolveDefaultEmailAccount,
  resolveEmailAccountsFromProfile,
} from '../../lib/emailAccounts';
import { ThreadList } from './ThreadList';
import { ChatWindow } from './ChatWindow';
import type { SendFromSelection } from './MessageComposer';

export function MailboxContainer() {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const { profile } = useAuth();
  const workhubNav = useWorkhubNav();
  const brokerId = profile?.uid;

  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [pendingOutbound, setPendingOutbound] = useState<EmailMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [folderActionPending, setFolderActionPending] = useState(false);
  const [search, setSearch] = useState('');
  /** `null` = vue unifiée « Toutes les boîtes ». */
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<MailboxFolder>('INBOX');
  const [composerFromAccountId, setComposerFromAccountId] = useState<string | null>(null);

  const emailAccounts = useMemo(
    () =>
      resolveEmailAccountsFromProfile({
        emailAccounts: profile?.emailAccounts,
        email: profile?.email,
        displayName: profile?.displayName,
      }),
    [profile?.emailAccounts, profile?.email, profile?.displayName]
  );

  useEffect(() => {
    const def = resolveDefaultEmailAccount(emailAccounts);
    setComposerFromAccountId((prev) => {
      if (prev && emailAccounts.some((a) => a.id === prev)) return prev;
      return def?.id ?? null;
    });
  }, [emailAccounts]);

  useEffect(() => {
    if (!selectedThread?.accountId) return;
    setComposerFromAccountId(selectedThread.accountId);
  }, [selectedThread?.id, selectedThread?.accountId]);

  const useDemoSeed = import.meta.env.VITE_USE_FICTITIOUS_DATA === 'true';

  useEffect(() => {
    if (!brokerId) {
      setThreads([]);
      setThreadsLoading(false);
      return;
    }

    let cancelled = false;
    setThreadsLoading(true);
    setThreadsError(null);

    (async () => {
      if (useDemoSeed) {
        try {
          await seedDemoEmailThreadsIfEmpty(
            brokerId,
            profile?.displayName,
            resolveDefaultEmailAccount(emailAccounts)?.id
          );
        } catch (e) {
          console.error('[MailboxContainer] demo seed failed', e);
        }
      }
      if (cancelled) return;
    })();

    const unsub = subscribeEmailThreads(
      brokerId,
      (rows) => {
        if (cancelled) return;
        setThreads(rows);
        setThreadsLoading(false);
        setSelectedThread((prev) => {
          const inFolder = applyMailboxFolderFilter(rows, activeFolder);
          if (!prev) return inFolder[0] ?? null;
          const still = inFolder.find((r) => r.id === prev.id);
          return still ?? inFolder[0] ?? null;
        });
      },
      () => {
        if (cancelled) return;
        setThreadsError(
          t(
            'Impossible de charger les conversations. Vérifiez vos règles Firestore.',
            'Could not load conversations. Check Firestore rules.'
          )
        );
        setThreadsLoading(false);
      },
      activeAccountId
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [brokerId, profile?.displayName, useDemoSeed, t, activeAccountId, emailAccounts, activeFolder]);

  const folderCounts = useMemo(
    () => countThreadsByFolder(threads, activeAccountId),
    [threads, activeAccountId]
  );

  const threadsInFolder = useMemo(
    () => applyMailboxFolderFilter(threads, activeFolder),
    [threads, activeFolder]
  );

  const activeAccount = useMemo(
    () =>
      activeAccountId
        ? emailAccounts.find((a) => a.id === activeAccountId)
        : resolveDefaultEmailAccount(emailAccounts),
    [activeAccountId, emailAccounts]
  );

  const handleFolderChange = useCallback((folder: MailboxFolder) => {
    setActiveFolder(folder);
    setSelectedThread(null);
  }, []);

  const displayMessages = useMemo(() => {
    if (!selectedThread) return [];
    const pending = pendingOutbound.filter((m) => m.threadId === selectedThread.id);
    return [...messages, ...pending].sort((a, b) => a.sentAtMillis - b.sentAtMillis);
  }, [messages, pendingOutbound, selectedThread]);

  useEffect(() => {
    if (!brokerId || !selectedThread?.id) {
      setMessages([]);
      setPendingOutbound([]);
      setMessagesLoading(false);
      return;
    }

    setMessagesLoading(true);
    const threadId = selectedThread.id;
    const unsub = subscribeThreadMessages(
      brokerId,
      threadId,
      (rows) => {
        setMessages(rows);
        setPendingOutbound((prev) =>
          prev.filter(
            (p) =>
              p.threadId !== threadId ||
              !rows.some(
                (r) =>
                  r.direction === 'outbound' &&
                  r.body.trim() === p.body.trim() &&
                  r.sentAtMillis >= p.sentAtMillis - 10_000
              )
          )
        );
        setMessagesLoading(false);
      },
      () => setMessagesLoading(false)
    );

    return () => unsub();
  }, [brokerId, selectedThread?.id]);

  const handleSelectThread = useCallback(
    async (thread: EmailThread) => {
      setSelectedThread(thread);
      if (thread.accountId) setComposerFromAccountId(thread.accountId);
      if (thread.isUnread && brokerId) {
        try {
          await markThreadRead(brokerId, thread.id);
        } catch (e) {
          console.error('[MailboxContainer] mark read failed', e);
        }
      }
    },
    [brokerId]
  );

  const handleSend = useCallback(
    async (body: string, from: SendFromSelection) => {
      if (!brokerId || !selectedThread) return;
      const trimmed = body.trim();
      if (!trimmed) return;

      const fromAccount = emailAccounts.find((a) => a.id === from.accountId);
      const optimisticId = `opt-${Date.now()}`;
      const optimisticMessage: EmailMessage = {
        id: optimisticId,
        threadId: selectedThread.id,
        body: trimmed,
        sentAtMillis: Date.now(),
        direction: 'outbound',
        authorName: profile?.displayName ?? 'Moi',
        authorId: brokerId,
        fromAccountId: from.accountId,
        fromEmailAddress: from.emailAddress,
        isOpened: false,
      };

      setPendingOutbound((prev) => [...prev, optimisticMessage]);
      setSending(true);
      try {
        await sendMessage(brokerId, selectedThread.id, trimmed, {
          authorName: profile?.displayName ?? 'Moi',
          fromAccountId: from.accountId,
          fromEmailAddress: from.emailAddress,
          useNylas: isNylasConfigured(),
          nylasGrantId: fromAccount?.nylasGrantId,
        });
      } catch (e) {
        console.error('[MailboxContainer] send failed', e);
        setPendingOutbound((prev) => prev.filter((m) => m.id !== optimisticId));
        setThreadsError(
          t("Échec de l'envoi. Réessayez.", 'Send failed. Please try again.')
        );
      } finally {
        setSending(false);
      }
    },
    [brokerId, selectedThread, profile?.displayName, emailAccounts, t]
  );

  const handleOpenProperty = useCallback(
    (propertyId: string) => {
      stashListingsFocusResidenceId(propertyId);
      workhubNav?.setActiveTab('listings');
    },
    [workhubNav]
  );

  const handleMoveThreadToFolder = useCallback(
    async (folder: NylasThreadFolderMove) => {
      if (!brokerId || !selectedThread) return;
      const threadId = selectedThread.id;
      const accountId = selectedThread.accountId ?? composerFromAccountId;
      if (!accountId) {
        setThreadsError(
          t('Compte courriel introuvable.', 'Email account not found.')
        );
        return;
      }

      const fromAccount = emailAccounts.find((a) => a.id === accountId);
      const snapshot = threads;
      const prevSelected = selectedThread;

      setFolderActionPending(true);
      setThreads((prev) =>
        prev.map((row) => (row.id === threadId ? { ...row, mailboxFolder: folder } : row))
      );
      setSelectedThread(null);

      try {
        if (isNylasConfigured() && fromAccount?.nylasGrantId) {
          await moveThreadViaNylas({ threadId, accountId, folder });
        } else {
          await updateThreadMailboxFolder(brokerId, threadId, folder);
        }
      } catch (e) {
        console.error('[MailboxContainer] move thread failed', e);
        setThreads(snapshot);
        setSelectedThread(prevSelected);
        setThreadsError(
          t(
            "Impossible de déplacer la conversation. Réessayez.",
            'Could not move the conversation. Please try again.'
          )
        );
      } finally {
        setFolderActionPending(false);
      }
    },
    [brokerId, selectedThread, composerFromAccountId, emailAccounts, threads, t]
  );

  if (!brokerId) {
    return (
      <div className="flex h-[calc(100vh-160px)] items-center justify-center rounded-[32px] border border-white/10 bg-vault-bright">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-160px)] overflow-hidden rounded-[32px] border border-white/10 bg-vault-bright shadow-sm">
      <div
        className={cn(
          'hidden h-full shrink-0 md:flex',
          selectedThread && 'max-md:hidden'
        )}
      >
        <MailboxFolderSidebar
          activeFolder={activeFolder}
          onFolderChange={handleFolderChange}
          accountEmail={activeAccount?.emailAddress}
          accountLabel={activeAccount?.label}
          counts={folderCounts}
          locale={locale}
          foldersTitle={t('Dossiers', 'Folders')}
        />
      </div>

      <div
        className={cn(
          'flex h-full shrink-0',
          selectedThread ? 'hidden lg:flex' : 'flex w-full lg:w-auto'
        )}
      >
        {threadsLoading ? (
          <div className="flex w-full items-center justify-center gap-2 p-8 text-slate-400 lg:w-[380px]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[11px] font-black uppercase tracking-widest">
              {t('Chargement…', 'Loading…')}
            </span>
          </div>
        ) : (
          <ThreadList
            threads={threadsInFolder}
            selectedId={selectedThread?.id ?? null}
            search={search}
            onSearchChange={setSearch}
            onSelect={handleSelectThread}
            title={t('MESSAGERIE SYNCHRONISÉE', 'SYNCED MESSAGING')}
            searchPlaceholder={t('Rechercher une conversation…', 'Search conversations…')}
            emptyLabel={t('Aucune conversation.', 'No conversations yet.')}
            accounts={emailAccounts}
            activeAccountId={activeAccountId}
            onAccountChange={setActiveAccountId}
            locale={locale}
            allInboxesLabel={t('Toutes les boîtes', 'All inboxes')}
            inboxLabel={t('Boîte active', 'Active inbox')}
          />
        )}
      </div>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          !selectedThread && 'hidden lg:flex'
        )}
      >
        {threadsError ? (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{threadsError}</span>
          </div>
        ) : null}
        <ChatWindow
          thread={selectedThread}
          messages={displayMessages}
          messagesLoading={messagesLoading}
          sending={sending}
          locale={locale}
          accounts={emailAccounts}
          fromAccountId={composerFromAccountId}
          onFromAccountChange={setComposerFromAccountId}
          onBack={() => setSelectedThread(null)}
          onOpenProperty={handleOpenProperty}
          onSend={handleSend}
          onArchive={() => handleMoveThreadToFolder('ARCHIVE')}
          onDelete={() => handleMoveThreadToFolder('TRASH')}
          folderActionPending={folderActionPending}
          labels={{
            selectThread: t('Sélectionnez une conversation', 'Select a conversation'),
            secureMode: t('Mode sécurisé chiffré activé', 'Encrypted secure mode'),
            radarBadge: t('Voir fiche Radar', 'Open Radar listing'),
            composerPlaceholder: t('Écrire un message…', 'Write a message…'),
            send: t('Envoyer', 'Send'),
            fromLabel: t('Expéditeur', 'From'),
            loadingMessages: t('Chargement des messages…', 'Loading messages…'),
            archive: t('Archiver', 'Archive'),
            delete: t('Supprimer', 'Delete'),
            deliveredReceipt: t('Reçu par le serveur', 'Delivered to server'),
            readReceipt: t('Lu', 'Read'),
          }}
        />
      </div>
    </div>
  );
}
