import React from 'react';
import { ChevronLeft, Home, Inbox, Loader2, Paperclip } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { EmailMessage, EmailThread } from '../../types/emailSync';
import type { EmailAccount } from '../../types/emailAccount';
import { MessageComposer, type SendFromSelection } from './MessageComposer';

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
  labels: {
    selectThread: string;
    secureMode: string;
    radarBadge: string;
    composerPlaceholder: string;
    send: string;
    fromLabel: string;
    loadingMessages: string;
  };
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
  labels,
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
    <div className="flex h-full flex-1 flex-col bg-vault">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
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

      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-6 lg:px-8">
        {messagesLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[11px] font-black uppercase tracking-widest">{labels.loadingMessages}</span>
          </div>
        ) : (
          messages.map((msg) => {
            const outbound = msg.direction === 'outbound';
            return (
              <div
                key={msg.id}
                className={cn('flex flex-col gap-1', outbound ? 'items-end' : 'items-start')}
              >
                <p className="px-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  {outbound && msg.fromEmailAddress
                    ? msg.fromEmailAddress
                    : msg.authorName ?? (outbound ? 'Moi' : thread.contactName)}{' '}
                  · {formatMessageDate(msg.sentAtMillis, locale)}
                </p>
                <div
                  className={cn(
                    'max-w-[min(100%,520px)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                    outbound
                      ? 'rounded-br-md border border-[#deff9a]/25 bg-[#deff9a]/10 text-slate-100'
                      : 'rounded-bl-md border border-white/10 bg-white/[0.06] text-slate-200'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  {msg.attachments?.length ? (
                    <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      {msg.attachments.map((att) => (
                        <li key={`${msg.id}-${att.name}`}>
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-lg border border-dashed border-white/15 bg-black/30 p-3 transition hover:border-[#deff9a]/40"
                          >
                            <Paperclip className="h-4 w-4 shrink-0 text-[#deff9a]" />
                            <div className="min-w-0 text-left">
                              <p className="truncate text-[11px] font-black uppercase tracking-tight text-slate-200">
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
                </div>
              </div>
            );
          })
        )}
      </div>

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
  );
}
