import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { EmailThread } from '../../types/emailSync';
import type { EmailAccount } from '../../types/emailAccount';
import { AccountSelector } from './AccountSelector';
import { emailHtmlToPlainText } from '../../lib/emailHtml';

const LIME = '#deff9a';

export interface ThreadListProps {
  threads: EmailThread[];
  selectedId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (thread: EmailThread) => void;
  title: string;
  searchPlaceholder: string;
  emptyLabel: string;
  accounts: EmailAccount[];
  activeAccountId: string | null;
  onAccountChange: (accountId: string | null) => void;
  locale: 'fr' | 'en';
  allInboxesLabel: string;
  inboxLabel: string;
}

function formatThreadTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase();
}

export function ThreadList({
  threads,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  title,
  searchPlaceholder,
  emptyLabel,
  accounts,
  activeAccountId,
  onAccountChange,
  locale,
  allInboxesLabel,
  inboxLabel,
}: ThreadListProps) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? threads.filter((t) => {
        const snippetPlain = emailHtmlToPlainText(t.lastMessageSnippet).toLowerCase();
        return (
          t.contactName.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          snippetPlain.includes(q)
        );
      })
    : threads;

  return (
    <div className="flex h-full w-full flex-col border-r border-white/10 lg:w-[380px]">
      <div className="border-b border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-100">
          {title}
        </h2>
        {accounts.length > 0 ? (
          <div className="mt-4">
            <AccountSelector
              accounts={accounts}
              activeAccountId={activeAccountId}
              onChange={onAccountChange}
              locale={locale}
              allInboxesLabel={allInboxesLabel}
              inboxLabel={inboxLabel}
            />
          </div>
        ) : null}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-white/10 bg-vault py-2 pl-10 pr-3 text-[10px] font-black uppercase tracking-widest text-slate-200 placeholder:text-slate-500 focus:border-[#deff9a]/50 focus:outline-none focus:ring-1 focus:ring-[#deff9a]/30"
          />
        </div>
      </div>

      <div className="custom-scrollbar flex-1 divide-y divide-white/[0.06] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-[11px] font-semibold text-slate-500">{emptyLabel}</p>
        ) : (
          filtered.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelect(thread)}
              className={cn(
                'relative w-full p-5 text-left transition-colors hover:bg-white/[0.04]',
                selectedId === thread.id && 'bg-blue-500/10'
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[10px] font-black italic text-slate-400">
                    {initials(thread.contactName)}
                  </div>
                  <span
                    className={cn(
                      'truncate text-xs font-black uppercase tracking-tighter',
                      thread.isUnread ? 'text-slate-100' : 'text-slate-400'
                    )}
                  >
                    {thread.contactName}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-mono text-[9px] font-bold text-slate-500">
                    {formatThreadTime(thread.lastMessageAtMillis)}
                  </span>
                  {thread.isUnread ? (
                    <span
                      className="h-2.5 w-2.5 rounded-full shadow-[0_0_8px_rgba(222,255,154,0.65)]"
                      style={{ backgroundColor: LIME }}
                      aria-label="Non lu"
                    />
                  ) : null}
                </div>
              </div>
              <h4
                className={cn(
                  'mb-1 truncate text-sm font-black italic tracking-tighter',
                  thread.isUnread ? 'text-[#deff9a]' : 'text-slate-300'
                )}
              >
                {thread.subject}
              </h4>
              <p className="line-clamp-2 text-[10px] font-medium leading-snug text-slate-500">
                {emailHtmlToPlainText(thread.lastMessageSnippet)}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
