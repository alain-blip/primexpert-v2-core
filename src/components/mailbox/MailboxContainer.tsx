import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  linkEmailThreadToContact,
  markThreadRead,
  seedDemoEmailThreadsIfEmpty,
  sendMessage,
  subscribeEmailThreads,
  subscribeThreadMessages,
  updateThreadMailboxFolder,
} from '../../services/emailSyncService';
import type { NylasThreadFolderMove } from '../../services/nylasClient';
import {
  fetchNylasMessageBody,
  hydrateNylasThread,
  isNylasConfigured,
  moveThreadViaNylas,
} from '../../services/nylasClient';
import { MailboxFolderSidebar } from './MailboxFolderSidebar';
import {
  resolveDefaultEmailAccount,
  resolveEmailAccountsFromProfile,
} from '../../lib/emailAccounts';
import { messageBodyNeedsHydration } from '../../lib/emailHtml';
import { ThreadList } from './ThreadList';
import { ChatWindow } from './ChatWindow';
import type { SendFromSelection } from './MessageComposer';
import { useInstitutionalToast } from '../../hooks/useInstitutionalToast';
import { InstitutionalToastBanner } from '../residence/diffusion/InstitutionalToastBanner';
import { MailContactLinkBar } from './MailContactLinkBar';
import {
  findContactsByEmail,
  resolveThreadPartyEmail,
} from '@primexpert/core/mail';
import { buildContactDisplayName, type OrganizationContact } from '@primexpert/core/crm';
import {
  getOrganizationContactById,
  listOrganizationContacts,
  type ContactServiceContext,
} from '../../services/contacts';
import {
  ContactFormDrawer,
  type ContactFormInitialDraft,
} from '../contacts/ContactFormDrawer';

const HYDRATE_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutError: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(timeoutError)), ms);
    }),
  ]);
}

export function MailboxContainer() {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const { profile } = useAuth();
  const workhubNav = useWorkhubNav();
  const { toast, showError, showSuccess, dismiss: dismissToast } = useInstitutionalToast();
  const brokerId = profile?.uid;

  const contactCtx = useMemo<ContactServiceContext | null>(() => {
    if (!profile?.uid || !profile.orgId) return null;
    return { uid: profile.uid, orgId: profile.orgId, role: profile.role };
  }, [profile?.uid, profile?.orgId, profile?.role]);

  const [contacts, setContacts] = useState<OrganizationContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactLinkPending, setContactLinkPending] = useState(false);
  const [optimisticContactId, setOptimisticContactId] = useState<string | null>(null);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [contactDrawerEditing, setContactDrawerEditing] = useState<OrganizationContact | null>(
    null
  );
  const [contactDrawerInitialDraft, setContactDrawerInitialDraft] =
    useState<ContactFormInitialDraft | null>(null);
  const [linkedContactOverride, setLinkedContactOverride] = useState<OrganizationContact | null>(
    null
  );

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
  const [resolvedBodies, setResolvedBodies] = useState<Record<string, string>>({});
  const [hydratingMessageIds, setHydratingMessageIds] = useState<Set<string>>(new Set());
  const [threadHydrating, setThreadHydrating] = useState(false);
  const hydrateAttemptedRef = useRef<Set<string>>(new Set());
  const threadHydrateAttemptedRef = useRef<Set<string>>(new Set());

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
    if (!contactCtx) {
      setContacts([]);
      return;
    }
    let cancelled = false;
    setContactsLoading(true);
    void listOrganizationContacts(contactCtx)
      .then((rows) => {
        if (!cancelled) setContacts(rows);
      })
      .catch((e) => {
        console.error('[MailboxContainer] load contacts failed', e);
      })
      .finally(() => {
        if (!cancelled) setContactsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactCtx]);

  const linkAfterCreateRef = useRef(false);
  const autoLinkAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setOptimisticContactId(null);
    setLinkedContactOverride(null);
  }, [selectedThread?.id]);

  const partyEmail = useMemo(() => {
    if (!selectedThread) return null;
    return resolveThreadPartyEmail(selectedThread, messages);
  }, [selectedThread, messages]);

  const suggestedContacts = useMemo(() => {
    if (!partyEmail) return [];
    return findContactsByEmail(
      contacts.map((c) => ({
        ...c,
        displayName: buildContactDisplayName(c),
      })),
      partyEmail
    );
  }, [contacts, partyEmail]);

  const effectiveMatchedContactId = useMemo(() => {
    if (optimisticContactId) return optimisticContactId;
    const fromThread = selectedThread?.matchedContactId;
    if (typeof fromThread === 'string' && fromThread.trim()) return fromThread;
    const fromMessage = [...messages]
      .reverse()
      .map((m) => m.matchedContactId)
      .find((id) => typeof id === 'string' && id.trim());
    return typeof fromMessage === 'string' ? fromMessage : null;
  }, [optimisticContactId, selectedThread?.matchedContactId, messages]);

  const linkedContact = useMemo(() => {
    if (!effectiveMatchedContactId) return null;
    return (
      contacts.find((c) => c.id === effectiveMatchedContactId) ??
      (linkedContactOverride?.id === effectiveMatchedContactId ? linkedContactOverride : null)
    );
  }, [contacts, effectiveMatchedContactId, linkedContactOverride]);

  useEffect(() => {
    if (!contactCtx || !effectiveMatchedContactId || linkedContact) return;
    let cancelled = false;
    void getOrganizationContactById(contactCtx, effectiveMatchedContactId).then((row) => {
      if (!cancelled && row) setLinkedContactOverride(row);
    });
    return () => {
      cancelled = true;
    };
  }, [contactCtx, effectiveMatchedContactId, linkedContact]);

  const persistThreadContactLink = useCallback(
    async (contactId: string) => {
      if (!brokerId || !selectedThread) return;
      const realMessageIds = messages
        .map((m) => m.id)
        .filter((id) => !id.startsWith('snippet-') && !id.startsWith('opt-'));
      if (realMessageIds.length === 0) return;

      setContactLinkPending(true);
      setOptimisticContactId(contactId);
      setSelectedThread((prev) => (prev ? { ...prev, matchedContactId: contactId } : prev));
      setThreads((prev) =>
        prev.map((row) =>
          row.id === selectedThread.id ? { ...row, matchedContactId: contactId } : row
        )
      );

      try {
        await linkEmailThreadToContact(
          brokerId,
          selectedThread.id,
          contactId,
          realMessageIds,
          {
            contactEmail: partyEmail ?? selectedThread.contactEmail,
            contactName: selectedThread.contactName,
            messages: messages.filter((m) => realMessageIds.includes(m.id)),
          }
        );
        showSuccess(
          t(
            'Courriel lié au dossier client.',
            'Email linked to client file.'
          )
        );
      } catch (e) {
        console.error('[MailboxContainer] link contact failed', e);
        setOptimisticContactId(null);
        setSelectedThread((prev) =>
          prev ? { ...prev, matchedContactId: selectedThread.matchedContactId ?? null } : prev
        );
        showError(
          t(
            'Impossible de lier ce courriel au dossier client.',
            'Could not link this email to the client file.'
          )
        );
      } finally {
        setContactLinkPending(false);
      }
    },
    [brokerId, selectedThread, messages, partyEmail, showSuccess, showError, t]
  );

  useEffect(() => {
    if (
      !selectedThread ||
      effectiveMatchedContactId ||
      contactLinkPending ||
      contactsLoading ||
      suggestedContacts.length !== 1
    ) {
      return;
    }
    const key = selectedThread.id;
    if (autoLinkAttemptedRef.current.has(key)) return;
    autoLinkAttemptedRef.current.add(key);
    void persistThreadContactLink(suggestedContacts[0]!.id);
  }, [
    selectedThread,
    effectiveMatchedContactId,
    contactLinkPending,
    contactsLoading,
    suggestedContacts,
    persistThreadContactLink,
  ]);

  const handleLinkToContact = useCallback(
    (contactId: string) => {
      void persistThreadContactLink(contactId);
    },
    [persistThreadContactLink]
  );

  const handleOpenCreateContact = useCallback(() => {
    const nameParts = (selectedThread?.contactName ?? '').trim().split(/\s+/);
    const prenom = nameParts.length > 1 ? nameParts[0] : '';
    const nom = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0] ?? '';
    setContactDrawerEditing(null);
    setContactDrawerInitialDraft({
      email: partyEmail ?? selectedThread?.contactEmail,
      prenom: prenom || undefined,
      nom: nom || undefined,
    });
    linkAfterCreateRef.current = true;
    setContactDrawerOpen(true);
  }, [partyEmail, selectedThread?.contactEmail, selectedThread?.contactName]);

  const handleOpenContact = useCallback(
    async (contact: OrganizationContact) => {
      if (!contactCtx) return;
      setContactDrawerEditing(contact);
      setContactDrawerInitialDraft(null);
      linkAfterCreateRef.current = false;
      setContactDrawerOpen(true);
    },
    [contactCtx]
  );

  const handleContactSaved = useCallback(
    (contactId?: string) => {
      if (!contactCtx) return;
      void listOrganizationContacts(contactCtx).then(setContacts);
      if (linkAfterCreateRef.current && contactId) {
        linkAfterCreateRef.current = false;
        void persistThreadContactLink(contactId);
      }
    },
    [contactCtx, persistThreadContactLink]
  );

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
    const rows = [...messages, ...pending].sort((a, b) => a.sentAtMillis - b.sentAtMillis);
    if (rows.length > 0 || messagesLoading) return rows;

    const snippet = selectedThread.lastMessageSnippet?.trim();
    if (snippet) {
      return [
        {
          id: `snippet-${selectedThread.id}`,
          threadId: selectedThread.id,
          body: snippet,
          sentAtMillis: selectedThread.lastMessageAtMillis,
          direction: 'inbound' as const,
          authorName: selectedThread.contactName,
        },
      ];
    }
    return rows;
  }, [messages, pendingOutbound, selectedThread, messagesLoading]);

  useEffect(() => {
    setResolvedBodies({});
    setHydratingMessageIds(new Set());
    setThreadHydrating(false);
    hydrateAttemptedRef.current = new Set();
    threadHydrateAttemptedRef.current = new Set();
  }, [selectedThread?.id]);

  useEffect(() => {
    if (!brokerId || !selectedThread?.id) {
      setMessages([]);
      setPendingOutbound([]);
      setMessagesLoading(false);
      return;
    }

    setMessagesLoading(true);
    const threadId = selectedThread.id;
    const listenerFailsafe = window.setTimeout(() => {
      setMessagesLoading(false);
    }, HYDRATE_TIMEOUT_MS);

    const unsub = subscribeThreadMessages(
      brokerId,
      threadId,
      (rows) => {
        window.clearTimeout(listenerFailsafe);
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
      () => {
        window.clearTimeout(listenerFailsafe);
        setMessagesLoading(false);
      }
    );

    return () => {
      window.clearTimeout(listenerFailsafe);
      unsub();
    };
  }, [brokerId, selectedThread?.id]);

  useEffect(() => {
    if (
      !brokerId ||
      !selectedThread ||
      messagesLoading ||
      messages.length > 0 ||
      !isNylasConfigured()
    ) {
      return;
    }

    const accountId = selectedThread.accountId ?? composerFromAccountId;
    if (!accountId || !selectedThread.nylasThreadId) return;

    const attemptKey = `${selectedThread.id}:${accountId}`;
    if (threadHydrateAttemptedRef.current.has(attemptKey)) return;
    threadHydrateAttemptedRef.current.add(attemptKey);

    const threadId = selectedThread.id;
    let cancelled = false;
    setThreadHydrating(true);

    void (async () => {
      try {
        const result = await withTimeout(
          hydrateNylasThread({ threadId, accountId }),
          HYDRATE_TIMEOUT_MS,
          'HYDRATE_TIMEOUT'
        );
        if (cancelled) return;
        if (result.synced === 0 && !result.skipped) {
          console.warn('[MailboxContainer] thread hydrate returned no messages', {
            threadId,
            nylasThreadId: selectedThread.nylasThreadId,
          });
        }
      } catch (e) {
        if (cancelled) return;
        const isTimeout = e instanceof Error && e.message === 'HYDRATE_TIMEOUT';
        showError(
          isTimeout
            ? t(
                'Délai d’attente dépassé pour la récupération du message.',
                'Timed out while retrieving the message.'
              )
            : t(
                'Impossible de récupérer le fil depuis Nylas.',
                'Could not retrieve the thread from Nylas.'
              )
        );
        console.warn('[MailboxContainer] hydrate thread failed', e);
      } finally {
        setThreadHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
      setThreadHydrating(false);
    };
  }, [
    brokerId,
    selectedThread?.id,
    selectedThread?.nylasThreadId,
    selectedThread?.accountId,
    messages.length,
    messagesLoading,
    composerFromAccountId,
    showError,
    t,
  ]);

  useEffect(() => {
    if (!brokerId || !selectedThread || messagesLoading || !isNylasConfigured()) return;

    const accountId = selectedThread.accountId ?? composerFromAccountId;
    if (!accountId) return;

    let cancelled = false;

    for (const msg of messages) {
      if (msg.id.startsWith('snippet-') || !messageBodyNeedsHydration(msg.body, msg.nylasMessageId)) {
        continue;
      }
      if (hydrateAttemptedRef.current.has(msg.id)) continue;
      hydrateAttemptedRef.current.add(msg.id);

      setHydratingMessageIds((prev) => new Set(prev).add(msg.id));

      void (async () => {
        try {
          const { body } = await withTimeout(
            fetchNylasMessageBody({
              threadId: selectedThread.id,
              messageId: msg.id,
              accountId,
            }),
            HYDRATE_TIMEOUT_MS,
            'HYDRATE_BODY_TIMEOUT'
          );
          if (cancelled) return;
          const trimmed = body.trim();
          if (trimmed) {
            setResolvedBodies((prev) => ({ ...prev, [msg.id]: trimmed }));
          }
        } catch (e) {
          if (!cancelled) {
            const isTimeout = e instanceof Error && e.message === 'HYDRATE_BODY_TIMEOUT';
            if (isTimeout) {
              showError(
                t(
                  'Délai d’attente dépassé pour la récupération du message.',
                  'Timed out while retrieving the message.'
                )
              );
            }
            console.warn('[MailboxContainer] hydrate message body failed', e);
          }
        } finally {
          setHydratingMessageIds((prev) => {
            const next = new Set(prev);
            next.delete(msg.id);
            return next;
          });
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [brokerId, selectedThread, messages, messagesLoading, composerFromAccountId, showError, t]);

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
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          !selectedThread && 'hidden lg:flex'
        )}
      >
        {threadsError ? (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{threadsError}</span>
          </div>
        ) : null}
        {toast ? (
          <div className="mx-4 mt-4">
            <InstitutionalToastBanner toast={toast} onDismiss={dismissToast} />
          </div>
        ) : null}
        <ChatWindow
          thread={selectedThread}
          messages={displayMessages}
          messagesLoading={messagesLoading}
          threadHydrating={threadHydrating}
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
          resolvedBodies={resolvedBodies}
          hydratingMessageIds={hydratingMessageIds}
          contactLinkBar={
            selectedThread && contactCtx ? (
              <MailContactLinkBar
                partyEmail={partyEmail}
                linkedContact={linkedContact}
                suggestedContacts={suggestedContacts}
                allContacts={contacts}
                linking={contactLinkPending || contactsLoading}
                locale={locale}
                onLink={handleLinkToContact}
                onCreateContact={handleOpenCreateContact}
                onOpenContact={handleOpenContact}
                labels={{
                  linkedTo: t('Lié au dossier', 'Linked to file'),
                  viewDossier: t('Voir dossier client', 'View client file'),
                  linkToDossier: t('Lier au dossier client', 'Link to client file'),
                  createContact: t('Créer un contact', 'Create contact'),
                  suggested: t('Correspondance courriel', 'Email match'),
                  searchPlaceholder: t('Rechercher un contact…', 'Search contacts…'),
                  noMatch: t('Aucun contact trouvé.', 'No contacts found.'),
                  partyEmail: t('Courriel', 'Email'),
                }}
              />
            ) : null
          }
          labels={{
            selectThread: t('Sélectionnez une conversation', 'Select a conversation'),
            secureMode: t('Mode sécurisé chiffré activé', 'Encrypted secure mode'),
            radarBadge: t('Voir fiche Radar', 'Open Radar listing'),
            composerPlaceholder: t('Écrire un message…', 'Write a message…'),
            send: t('Envoyer', 'Send'),
            fromLabel: t('Expéditeur', 'From'),
            loadingMessages: t('Chargement des messages…', 'Loading messages…'),
            syncingThread: t(
              'Synchronisation du fil depuis Nylas…',
              'Syncing thread from Nylas…'
            ),
            loadingMessageBody: t(
              'Chargement du contenu du courriel…',
              'Loading email content…'
            ),
            messageBodyUnavailable: t(
              'Contenu du message non disponible.',
              'Message content unavailable.'
            ),
            archive: t('Archiver', 'Archive'),
            delete: t('Supprimer', 'Delete'),
            deliveredReceipt: t('Reçu par le serveur', 'Delivered to server'),
            readReceipt: t('Lu', 'Read'),
            noMessagesInThread: t(
              'Aucun message trouvé dans ce fil.',
              'No messages found in this thread.'
            ),
          }}
        />
      </div>
      {contactCtx ? (
        <ContactFormDrawer
          open={contactDrawerOpen}
          onClose={() => {
            setContactDrawerOpen(false);
            setContactDrawerEditing(null);
            setContactDrawerInitialDraft(null);
            linkAfterCreateRef.current = false;
          }}
          ctx={contactCtx}
          editing={contactDrawerEditing}
          initialDraft={contactDrawerInitialDraft}
          onSaved={handleContactSaved}
        />
      ) : null}
    </div>
  );
}
