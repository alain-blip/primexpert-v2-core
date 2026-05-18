import React from 'react';
import { Landmark, Scale, Wrench } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  PROPERTY_DOCUMENT_CATEGORIES,
  type PropertyDocumentCategory,
} from '../../../types/propertyDocument';

const CATEGORY_ICONS = {
  financier: Landmark,
  technique: Wrench,
  legal: Scale,
} as const;

export interface DocumentCategorySidebarProps {
  activeCategory: PropertyDocumentCategory;
  onCategoryChange: (category: PropertyDocumentCategory) => void;
  counts: Record<PropertyDocumentCategory, number>;
  locale: 'fr' | 'en';
  title: string;
}

export function DocumentCategorySidebar({
  activeCategory,
  onCategoryChange,
  counts,
  locale,
  title,
}: DocumentCategorySidebarProps) {
  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{title}</p>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label={title}>
        {PROPERTY_DOCUMENT_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id];
          const active = activeCategory === cat.id;
          const count = counts[cat.id] ?? 0;
          const label = locale === 'fr' ? cat.labelFr : cat.labelEn;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                active
                  ? 'border border-[#D4AF37]/40 bg-amber-50 text-[#000000]'
                  : 'border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#D4AF37]' : 'text-slate-400')} />
              <span className="min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-[0.12em]">
                {label}
              </span>
              {count > 0 ? (
                <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-600">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
