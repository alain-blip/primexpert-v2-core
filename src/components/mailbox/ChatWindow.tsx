import React from 'react';
import { Archive, ChevronLeft, Home, Inbox, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { EmailMessage, EmailThread } from '../../types/emailSync';
import type { EmailAccount } from '../../types/emailAccount';
import { MessageComposer, type SendFromSelection } from './MessageComposer';
import { MessageBody } from './MessageBody';
import { MessageReadReceipt } from './MessageReadReceipt';
import { visibleEmailTextLength } from '../../lib/emailHtml';

function formatMessageDate(ms: number, locale: string): string {
  return new Date(ms).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ChatWindowProps {
  thread: EmailThread | null;
  messages: EmailMessage[];
  messagesLoading: boolean;
  sending: boolean;
  locale: 'fr' | 'en';
  onBack?: () => void;
  onOpenProperty?: (propertyId: string) => void;
  accounts: EmailAccount[];
  fromAccountId: string | null;
  onFromAccountChange: (accountId: string) => void;
  onSend: (body: string, from: SendFromSelection) => Promise<void>;
  onArchive?: () => void;
  onDelete?: () => void;
  folderActionPending?: boolean;
  labels: {
    selectThread: string;
    secureMode: string;
    radarBadge: string;
    composerPlaceholder: string;
    send: string;
    fromLabel: string;
    loadingMessages: string;
    syncingThread: string;
    loadingMessageBody: string;
    messageBodyUnavailable: string;
    archive: string;
    delete: string;
    deliveredReceipt: string;
    readReceipt: string;
    noMessagesInThread: string;
  };
  /** Corps hydratés via Nylas (messageId → HTML/texte). */
  resolvedBodies?: Record<string, string>;
  hydratingMessageIds?: Set<string>;
  /** Hydratation fil Nylas en cours (sans bloquer l’affichage de l’extrait). */
  threadHydrating?: boolean;
  /** Barre rattachement CRM (Phase 2 messagerie). */
  contactLinkBar?: React.ReactNode;
}

export function ChatWindow({
  thread,
  messages,
  messagesLoading,
  sending,
  locale,
  onBack,
  onOpenProperty,
  accounts,
  fromAccountId,
  onFromAccountChange,
  onSend,
  onArchive,
  onDelete,
  folderActionPending = false,
  resolvedBodies = {},
  hydratingMessageIds = new Set(),
  threadHydrating = false,
  labels,
  contactLinkBar,
}: ChatWindowProps) {
  if (!thread) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-vault p-12 text-center opacity-40">
        <Inbox className="mb-6 h-28 w-28 text-slate-500" />
        <h3 className="text-3xl font-black italic uppercase tracking-tighter text-slate-300">
          {labels.selectThread}
        </h3>
        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
          {labels.secureMode}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-vault">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-2 hover:bg-white/[0.06] lg:hidden"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5 text-slate-300" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black italic uppercase tracking-tighter text-slate-200">
            {thread.contactName}
          </p>
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {thread.subject}
          </p>
        </div>
        {thread.propertyId && onOpenProperty ? (
          <button
            type="button"
            onClick={() => onOpenProperty(thread.propertyId!)}
            className="inline-flex max-w-[min(100%,14rem)] items-center gap-1.5 rounded-lg border border-blue-400/35 bg-blue-500/15 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-blue-200 transition hover:bg-blue-500/25"
          >
            <Home className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{thread.propertyLabel ?? labels.radarBadge}</span>
          </button>
        ) : null}
      </header>

      {contactLinkBar}

      {threadHydrating ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-blue-400/20 bg-blue-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-200">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {labels.syncingThread}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-vault">
        {messagesLoading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[11px] font-black uppercase tracking-widest">
              {labels.loadingMessages}
            </span>
          </div>
        ) : messages.length === 0 ? (
          <div className="m-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-white">
            <p>{labels.noMessagesInThread}</p>
            <p className="mt-2 font-mono text-[10px] text-amber-200/80">
              threadId={thread.id} · messages={messages.length}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              'custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto',
              messages.length === 1 && 'min-h-0'
            )}
          >
            {messages.map((msg) => {
              const outbound = msg.direction === 'outbound';
              const hydrating = hydratingMessageIds.has(msg.id);
              const displayBody = (resolvedBodies[msg.id] ?? msg.body ?? '').trim();
              const showBodyLoading = hydrating && visibleEmailTextLength(displayBody) < 80;
              const fillPane = messages.length === 1;

              return (
                <article
                  key={msg.id}
                  className={cn(
                    'flex w-full flex-col border-b border-white/10',
                    fillPane && 'min-h-0 flex-1'
                  )}
                >
                  <div className="shrink-0 border-b border-slate-200/80 bg-slate-100 px-6 py-2.5">
                    <p className="text-[11px] font-bold text-slate-700">
                      {outbound && msg.fromEmailAddress
                        ? msg.fromEmailAddress
                        : msg.authorName ?? (outbound ? 'Moi' : thread.contactName)}
                      <span className="font-normal text-slate-500">
                        {' '}
                        · {formatMessageDate(msg.sentAtMillis, locale)}
                      </span>
                      {outbound ? (
                        <span className="ml-2 inline-flex align-middle">
                          <MessageReadReceipt
                            isOpened={msg.isOpened}
                            openedAtMillis={msg.openedAtMillis}
                            locale={locale}
                            deliveredLabel={labels.deliveredReceipt}
                            readLabel={labels.readReceipt}
                          />
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div
                    className={cn(
                      'flex w-full flex-col bg-white',
                      fillPane ? 'min-h-0 flex-1' : 'min-h-[320px]'
                    )}
                  >
                    <MessageBody
                      body={displayBody}
                      loading={showBodyLoading}
                      className="min-h-0 flex-1"
                      emptyLabel={
                        showBodyLoading
                          ? labels.loadingMessageBody
                          : labels.messageBodyUnavailable
                      }
                    />
                  </div>

                  {msg.attachments?.length ? (
                    <ul className="shrink-0 space-y-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
                      {msg.attachments.map((att) => (
                        <li key={`${msg.id}-${att.name}`}>
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-3 transition hover:border-slate-400"
                          >
                            <Paperclip className="h-4 w-4 shrink-0 text-slate-500" />
                            <div className="min-w-0 text-left">
                              <p className="truncate text-[11px] font-black uppercase tracking-tight text-slate-800">
                                {att.name}
                              </p>
                              {att.sizeBytes ? (
                                <p className="text-[9px] font-bold text-slate-500">
                                  {formatFileSize(att.sizeBytes)}
                                </p>
                              ) : null}
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {onArchive || onDelete ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-3 lg:px-8">
          {onArchive ? (
            <button
              type="button"
              onClick={onArchive}
              disabled={folderActionPending || messagesLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-slate-100 disabled:opacity-40"
            >
              <Archive className="h-4 w-4 shrink-0 text-slate-400" />
              {labels.archive}
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={folderActionPending || messagesLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-transparent px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              {labels.delete}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="shrink-0">
        <MessageComposer
          disabled={messagesLoading}
          sending={sending}
          accounts={accounts}
          fromAccountId={fromAccountId}
          onFromAccountChange={onFromAccountChange}
          placeholder={labels.composerPlaceholder}
          sendLabel={labels.send}
          fromLabel={labels.fromLabel}
          onSend={onSend}
        />
      </div>
    </div>
  );
}
