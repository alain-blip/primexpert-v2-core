import React from 'react';
import { FileSignature, FolderOpen, Handshake, Scale } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  TRANSACTION_DOCUMENT_TABS,
  type TransactionDocumentTab,
} from '../../../lib/propertyDocumentTaxonomy';

const TAB_ICONS = {
  acheteurs: FolderOpen,
  contrats: Scale,
  actes: FileSignature,
  promesses: Handshake,
} as const;

export interface DocumentTabsProps {
  activeTab: TransactionDocumentTab;
  onTabChange: (tab: TransactionDocumentTab) => void;
  counts: Record<TransactionDocumentTab, number>;
  locale: 'fr' | 'en';
}

export function DocumentTabs({ activeTab, onTabChange, counts, locale }: DocumentTabsProps) {
  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
          {locale === 'fr' ? 'Onglets transactionnels' : 'Transaction tabs'}
        </p>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label={locale === 'fr' ? 'Onglets documents' : 'Document tabs'}>
        {TRANSACTION_DOCUMENT_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          const active = activeTab === tab.id;
          const count = counts[tab.id] ?? 0;
          const label = locale === 'fr' ? tab.labelFr : tab.labelEn;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex w-full flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition',
                active
                  ? 'border-[#D4AF37]/40 bg-amber-50 text-[#142c6a]'
                  : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
              )}
            >
              <span className="flex w-full items-center gap-2">
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#D4AF37]' : 'text-slate-400')} />
                <span className="min-w-0 flex-1 text-[10px] font-black uppercase leading-snug tracking-[0.08em]">
                  {label}
                </span>
                {count > 0 ? (
                  <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-600">
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
