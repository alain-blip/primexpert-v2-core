import React, { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { EmailAccount } from '../../types/emailAccount';
import { resolveDefaultEmailAccount } from '../../lib/emailAccounts';
import { institutionalListingsInlineInputClass } from '../../lib/institutionalTheme';

export interface SendFromSelection {
  accountId: string;
  emailAddress: string;
}

export interface MessageComposerProps {
  disabled?: boolean;
  sending?: boolean;
  accounts: EmailAccount[];
  fromAccountId: string | null;
  onFromAccountChange: (accountId: string) => void;
  placeholder: string;
  sendLabel: string;
  fromLabel: string;
  onSend: (body: string, from: SendFromSelection) => Promise<void>;
}

export function MessageComposer({
  disabled,
  sending,
  accounts,
  fromAccountId,
  onFromAccountChange,
  placeholder,
  sendLabel,
  fromLabel,
  onSend,
}: MessageComposerProps) {
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!accounts.length) return;
    if (fromAccountId && accounts.some((a) => a.id === fromAccountId)) return;
    const def = resolveDefaultEmailAccount(accounts);
    if (def) onFromAccountChange(def.id);
  }, [accounts, fromAccountId, onFromAccountChange]);

  const activeFrom = accounts.find((a) => a.id === fromAccountId) ?? resolveDefaultEmailAccount(accounts);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || disabled || sending || !activeFrom) return;
    await onSend(text, {
      accountId: activeFrom.id,
      emailAddress: activeFrom.emailAddress,
    });
    setBody('');
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <label className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-700">
          {fromLabel}
        </label>
        <select
          value={activeFrom?.id ?? ''}
          onChange={(e) => onFromAccountChange(e.target.value)}
          disabled={disabled || sending || accounts.length <= 1}
          className={cn(
            institutionalListingsInlineInputClass,
            'min-w-0 flex-1 px-3 py-2 font-mono text-[11px] text-slate-900',
            accounts.length <= 1 && 'opacity-80'
          )}
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.label} &lt;{acc.emailAddress}&gt;
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={disabled || sending || !activeFrom}
          rows={2}
          placeholder={placeholder}
          className={cn(
            institutionalListingsInlineInputClass,
            'min-h-[52px] flex-1 resize-none px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-500'
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={disabled || sending || !body.trim() || !activeFrom}
          className={cn(
            'inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-primexpert-dark bg-white px-5 py-3',
            'text-[10px] font-black uppercase tracking-[0.18em] text-black transition',
            'disabled:cursor-not-allowed disabled:opacity-40'
          )}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sendLabel}
        </button>
      </div>
    </form>
  );
}
