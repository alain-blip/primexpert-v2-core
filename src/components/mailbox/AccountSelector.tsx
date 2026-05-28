import React from 'react';
import { ChevronDown, Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { EmailAccount } from '../../types/emailAccount';
import { providerLabel, syncStatusLabel } from '../../lib/emailAccounts';
import { institutionalListingsInlineInputClass } from '../../lib/institutionalTheme';

export interface AccountSelectorProps {
  accounts: EmailAccount[];
  /** `null` = vue unifiée « Toutes les boîtes ». */
  activeAccountId: string | null;
  onChange: (accountId: string | null) => void;
  locale: 'fr' | 'en';
  allInboxesLabel: string;
  inboxLabel: string;
}

export function AccountSelector({
  accounts,
  activeAccountId,
  onChange,
  locale,
  allInboxesLabel,
  inboxLabel,
}: AccountSelectorProps) {
  const active = activeAccountId
    ? accounts.find((a) => a.id === activeAccountId)
    : null;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-700">
        <Inbox className="h-3 w-3" />
        {inboxLabel}
      </label>
      <div className="relative">
        <select
          value={activeAccountId ?? ''}
          onChange={(e) => onChange(e.target.value ? e.target.value : null)}
          className={cn(
            institutionalListingsInlineInputClass,
            'w-full appearance-none py-2.5 pl-3 pr-9 text-[11px] font-bold text-slate-900 shadow-none'
          )}
        >
          <option value="">{allInboxesLabel}</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.label} — {acc.emailAddress}
              {acc.isDefault ? (locale === 'fr' ? ' ★' : ' ★') : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
      </div>
      {active ? (
        <p className="text-[9px] font-semibold leading-snug">
          <span
            className={cn(
              active.syncStatus === 'connected' ? 'text-emerald-800' : 'text-slate-700'
            )}
            style={undefined}
          >
            {syncStatusLabel(active.syncStatus, locale)}
          </span>
          <span className="text-slate-600"> · </span>
          <span className="text-slate-700">{providerLabel(active.provider, locale)}</span>
        </p>
      ) : accounts.length > 0 ? (
        <p className="text-[9px] font-semibold text-slate-700">{allInboxesLabel}</p>
      ) : null}
    </div>
  );
}
