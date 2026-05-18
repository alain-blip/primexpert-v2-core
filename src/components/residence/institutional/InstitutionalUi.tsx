/**
 * Kit UI institutionnel — étalon Identité (CPA / conformité OACIQ).
 * Styles uniquement — aucune logique métier.
 */

import React, { type ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export const inst = {
  page: 'font-sans text-slate-800',
  section: 'rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden',
  sectionHeader: 'px-5 py-3 border-b border-slate-200 bg-slate-50',
  sectionTitle: 'text-[11px] font-black uppercase tracking-[0.16em] text-[#000000]',
  kpi: 'rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm',
  kpiLabel: 'text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 leading-snug',
  kpiSublabel: 'text-[9px] text-slate-500 mt-0.5 font-medium normal-case',
  kpiValue: 'text-2xl font-black text-[#000000] tabular-nums tracking-tight',
  tableWrap: 'overflow-x-auto bg-white',
  table: 'w-full text-sm',
  th: 'text-left px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 bg-slate-50',
  thRight: 'text-right px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 bg-slate-50',
  tr: 'border-b border-slate-100 hover:bg-slate-50/80',
  td: 'px-4 py-2.5 text-slate-600',
  tdValue: 'px-4 py-2.5 text-right font-black text-[#000000] tabular-nums',
  tdValueMono: 'px-4 py-2.5 text-right font-mono font-semibold text-[#000000] tabular-nums',
  pageTitle: 'text-[11px] font-black uppercase tracking-[0.18em] text-[#000000]',
  pageMeta: 'text-[10px] text-slate-600 font-mono',
  alertAmber: 'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-[#000000]',
  alertRed: 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900',
  alertBlue: 'rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700',
  loading: 'rounded-xl border border-slate-200 bg-white px-8 py-16 text-center',
  loadingText: 'text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600',
  note: 'text-[10px] text-slate-600 leading-relaxed border border-slate-200 rounded-xl bg-white px-4 py-2',
} as const;

export function InstitutionalPageHeader({
  icon,
  title,
  meta,
}: {
  icon?: ReactNode;
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
      {icon}
      <div>
        <p className={inst.pageTitle}>{title}</p>
        {meta ? <p className={cn(inst.pageMeta, 'mt-0.5')}>{meta}</p> : null}
      </div>
    </div>
  );
}

export function InstitutionalKpi({
  label,
  sublabel,
  value,
  className,
}: {
  label: string;
  sublabel?: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn(inst.kpi, className)}>
      <p className={inst.kpiLabel}>{label}</p>
      {sublabel ? <p className={inst.kpiSublabel}>{sublabel}</p> : null}
      <p className={cn(inst.kpiValue, 'mt-2')}>{value}</p>
    </div>
  );
}

export function InstitutionalSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(inst.section, className)}>
      <header className={inst.sectionHeader}>
        <h3 className={inst.sectionTitle}>{title}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function InstitutionalPlaceholder({
  phase,
  title,
  subtitle,
}: {
  phase: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-8 py-12 text-center shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">{phase}</p>
      <h3 className="mt-3 text-xl font-black text-[#000000] tracking-tight">{title}</h3>
      <p className="mt-3 max-w-lg mx-auto text-sm text-slate-600 leading-relaxed">{subtitle}</p>
    </div>
  );
}
