import React from 'react';
import { Archive, FilePenLine, Inbox, Send, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  MAILBOX_FOLDERS,
  folderLabel,
  type MailboxFolder,
} from '../../lib/mailboxFolders';

const FOLDER_ICONS: Record<
  MailboxFolder,
  React.ComponentType<{ className?: string }>
> = {
  INBOX: Inbox,
  SENT: Send,
  DRAFT: FilePenLine,
  TRASH: Trash2,
  ARCHIVE: Archive,
};

export interface MailboxFolderSidebarProps {
  activeFolder: MailboxFolder;
  onFolderChange: (folder: MailboxFolder) => void;
  accountEmail?: string;
  accountLabel?: string;
  counts: Record<MailboxFolder, number>;
  locale: 'fr' | 'en';
  foldersTitle: string;
}

export function MailboxFolderSidebar({
  activeFolder,
  onFolderChange,
  accountEmail,
  accountLabel,
  counts,
  locale,
  foldersTitle,
}: MailboxFolderSidebarProps) {
  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-primexpert-light p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-700">
          {foldersTitle}
        </p>
        {accountEmail ? (
          <p className="mt-2 truncate text-[11px] font-semibold text-slate-900" title={accountEmail}>
            {accountLabel || accountEmail}
          </p>
        ) : null}
        {accountEmail && accountLabel && accountLabel !== accountEmail ? (
          <p className="truncate font-mono text-[10px] text-slate-700">{accountEmail}</p>
        ) : null}
      </div>

      <nav className="custom-scrollbar flex-1 space-y-1 p-3" aria-label={foldersTitle}>
        {MAILBOX_FOLDERS.map((folder) => {
          const Icon = FOLDER_ICONS[folder];
          const active = activeFolder === folder;
          const count = counts[folder] ?? 0;
          return (
            <button
              key={folder}
              type="button"
              onClick={() => onFolderChange(folder)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                active
                  ? 'border border-primexpert-dark/35 bg-primexpert-light shadow-sm'
                  : 'border border-transparent text-slate-700 hover:border-slate-300 hover:bg-primexpert-light/70 hover:text-slate-900'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  active ? 'text-primexpert-dark' : 'text-slate-700'
                )}
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-[0.14em]',
                  active ? 'text-black' : 'text-slate-900'
                )}
              >
                {folderLabel(folder, locale)}
              </span>
              {count > 0 ? (
                <span
                  className={cn(
                    'shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold',
                    active ? 'bg-white text-slate-900 border border-slate-300' : 'bg-primexpert-light text-slate-900'
                  )}
                >
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
              {active && folder === 'INBOX' && count > 0 ? (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: '#047857' }}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
