import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Link2, Loader2, UserPlus, UserRound } from 'lucide-react';
import { cn } from '../../lib/utils';
import { buildContactDisplayName, type OrganizationContact } from '@primexpert/core/crm';

export interface MailContactLinkBarProps {
  partyEmail: string | null;
  linkedContact: OrganizationContact | null;
  suggestedContacts: OrganizationContact[];
  allContacts: OrganizationContact[];
  linking: boolean;
  locale: 'fr' | 'en';
  onLink: (contactId: string) => void;
  onCreateContact: () => void;
  onOpenContact: (contact: OrganizationContact) => void;
  labels: {
    linkedTo: string;
    viewDossier: string;
    linkToDossier: string;
    createContact: string;
    suggested: string;
    searchPlaceholder: string;
    noMatch: string;
    partyEmail: string;
  };
}

export function MailContactLinkBar({
  partyEmail,
  linkedContact,
  suggestedContacts,
  allContacts,
  linking,
  onLink,
  onCreateContact,
  onOpenContact,
  labels,
}: MailContactLinkBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? allContacts : suggestedContacts.length ? suggestedContacts : allContacts;
    if (!q) return pool.slice(0, 12);
    return pool
      .filter((c) => {
        const name = buildContactDisplayName(c).toLowerCase();
        const email = (c.email ?? '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 12);
  }, [allContacts, suggestedContacts, query]);

  if (linkedContact) {
    const name = buildContactDisplayName(linkedContact);
    return (
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-emerald-400/25 bg-emerald-500/10 px-4 py-2"
      >
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-100">
          <Check className="h-3.5 w-3.5 shrink-0" />
          {labels.linkedTo} · {name}
        </span>
        <button
          type="button"
          onClick={() => onOpenContact(linkedContact)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-200 transition hover:bg-white/[0.1]"
        >
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          {labels.viewDossier}
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative shrink-0 border-b border-white/10 bg-white/[0.02] px-4 py-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        {partyEmail ? (
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            {labels.partyEmail}:{' '}
            <span className="font-mono text-slate-400">{partyEmail}</span>
          </span>
        ) : null}
        <div className="relative ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={linking || allContacts.length === 0}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/35 bg-indigo-500/15 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-indigo-100 transition hover:bg-indigo-500/25 disabled:opacity-40"
          >
            {linking ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <Link2 className="h-3.5 w-3.5 shrink-0" />
            )}
            {labels.linkToDossier}
            <ChevronDown className={cn('h-3 w-3 transition', open && 'rotate-180')} />
          </button>
          <button
            type="button"
            disabled={linking}
            onClick={onCreateContact}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-200 transition hover:bg-white/[0.1] disabled:opacity-40"
          >
            <UserPlus className="h-3.5 w-3.5 shrink-0" />
            {labels.createContact}
          </button>
        </div>
      </div>

      {open ? (
        <div className="absolute right-4 top-full z-50 mt-1 w-[min(100vw-2rem,20rem)] rounded-xl border border-white/10 bg-[#0f172a] p-2 shadow-2xl">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="mb-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-slate-200 placeholder:text-slate-500 focus:border-indigo-400/40 focus:outline-none"
            autoFocus
          />
          {suggestedContacts.length > 0 && !query.trim() ? (
            <p className="px-2 pb-1 text-[9px] font-black uppercase tracking-widest text-indigo-300/80">
              {labels.suggested}
            </p>
          ) : null}
          <ul className="max-h-52 overflow-y-auto custom-scrollbar">
            {filteredContacts.length === 0 ? (
              <li className="px-3 py-4 text-center text-[11px] text-slate-500">{labels.noMatch}</li>
            ) : (
              filteredContacts.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.06]"
                    onClick={() => {
                      onLink(c.id);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span className="text-[11px] font-bold text-slate-100">
                      {buildContactDisplayName(c)}
                    </span>
                    {c.email ? (
                      <span className="truncate text-[10px] text-slate-500">{c.email}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
