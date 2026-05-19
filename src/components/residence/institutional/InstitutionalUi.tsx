/**
 * Kit UI institutionnel — étalon Identité (CPA / conformité OACIQ).
 * Tokens primexpert-dark · primexpert-blue · primexpert-gold (tailwind.config.js).
 */

import React, { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';
import {
  institutionalBadgeActionClass,
  institutionalBadgeProgressionClass,
  institutionalBadgeSuggestionClass,
  institutionalInkTextClass,
  institutionalPanelShellClass,
  institutionalPanelSubtitleClass,
  institutionalPanelTitleClass,
  institutionalSectionWhiteClass,
  institutionalWhiteCardClass,
  institutionalWhiteCardCompactClass,
  INSTITUTIONAL_INK,
} from '../../../lib/institutionalTheme';

export { INSTITUTIONAL_INK };

export const inst = {
  page: 'font-sans text-slate-800',
  section:
    'rounded-xl border-2 border-primexpert-dark bg-white shadow-xl overflow-hidden',
  sectionHeader: 'px-5 py-3 border-b border-primexpert-dark/20 bg-primexpert-light',
  sectionTitle:
    'text-[11px] font-black uppercase tracking-[0.16em] text-primexpert-dark',
  kpi: 'rounded-xl border-2 border-primexpert-dark bg-white px-5 py-4 shadow-md',
  kpiLabel: 'text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 leading-snug',
  kpiSublabel: 'text-[9px] text-slate-500 mt-0.5 font-medium normal-case',
  kpiValue: 'text-2xl font-black text-primexpert-dark tabular-nums tracking-tight',
  tableWrap: 'overflow-x-auto bg-white',
  table: 'w-full text-sm',
  th: 'text-left px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-primexpert-dark/15 bg-primexpert-light',
  thRight:
    'text-right px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-primexpert-dark/15 bg-primexpert-light',
  tr: 'border-b border-slate-100 hover:bg-primexpert-light/80',
  td: 'px-4 py-2.5 text-slate-600',
  tdValue: 'px-4 py-2.5 text-right font-black text-primexpert-dark tabular-nums',
  tdValueMono:
    'px-4 py-2.5 text-right font-mono font-semibold text-primexpert-dark tabular-nums',
  pageTitle:
    'text-[11px] font-black uppercase tracking-[0.18em] text-primexpert-dark',
  pageMeta: 'text-[10px] text-slate-600 font-mono',
  alertAmber:
    'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-primexpert-dark',
  alertRed: 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900',
  alertBlue:
    'rounded-xl border-2 border-primexpert-dark/30 bg-white px-4 py-3 text-sm text-primexpert-dark',
  loading:
    'rounded-xl border-2 border-primexpert-dark bg-white px-8 py-16 text-center shadow-md',
  loadingText: 'text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600',
  note: 'text-[10px] text-slate-600 leading-relaxed border-2 border-primexpert-dark/20 rounded-xl bg-white px-4 py-2',
} as const;

/** Onglets fiche résidence — panneau bleu + contenu (carte unique ou sections empilées). */
export function InstitutionalResidenceTabShell({
  title,
  subtitle,
  children,
  variant = 'stack',
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** card : une carte blanche (Hub Finance, Documents) · stack : sections sur fond bleu */
  variant?: 'card' | 'stack';
  className?: string;
}) {
  return (
    <InstitutionalWhitePanel title={title} subtitle={subtitle} className={className}>
      {variant === 'card' ? (
        <motion.div layout className={cn(institutionalWhiteCardClass, 'overflow-hidden')}>
          {children}
        </motion.div>
      ) : (
        <motion.div layout className="space-y-5">
          {children}
        </motion.div>
      )}
    </InstitutionalWhitePanel>
  );
}

export function InstitutionalWhitePanel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(institutionalPanelShellClass, className)}>
      <header className="mb-6 px-1">
        <h2 className={institutionalPanelTitleClass}>{title}</h2>
        {subtitle ? (
          <p className={institutionalPanelSubtitleClass}>{subtitle}</p>
        ) : null}
      </header>
      {children}
    </div>
  );
}

export function InstitutionalWhitePanelSection({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(institutionalSectionWhiteClass, className)}>
      <header className="mb-5 border-b border-[#142c6a]/10 pb-4">
        <h3 className={cn(institutionalInkTextClass, 'text-lg font-black tracking-tight')}>
          {title}
        </h3>
        {subtitle ? (
          <p className={cn(institutionalInkTextClass, 'text-[11px] font-medium mt-1 leading-relaxed')}>
            {subtitle}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export type InstitutionalDetailVariant = 'progression' | 'etape' | 'suggestion';

const DETAIL_BADGE: Record<InstitutionalDetailVariant, string> = {
  progression: institutionalBadgeProgressionClass,
  etape: institutionalBadgeActionClass,
  suggestion: institutionalBadgeSuggestionClass,
};

export function InstitutionalDetailLine({
  variant,
  label,
  children,
}: {
  variant: InstitutionalDetailVariant;
  label: string;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        'text-sm leading-relaxed flex flex-wrap items-start gap-y-2 mb-3 last:mb-0',
        institutionalInkTextClass
      )}
    >
      <span className={DETAIL_BADGE[variant]}>{label}</span>
      <span className="flex-1 min-w-[12rem] pt-0.5 font-medium">{children}</span>
    </p>
  );
}

export function InstitutionalWhiteCard({
  children,
  className,
  compact,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        compact ? institutionalWhiteCardCompactClass : institutionalWhiteCardClass,
        'p-5',
        className
      )}
    >
      {children}
    </div>
  );
}

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
      <h3 className="mt-3 text-xl font-black text-[#142c6a] tracking-tight">{title}</h3>
      <p className="mt-3 max-w-lg mx-auto text-sm text-slate-600 leading-relaxed">{subtitle}</p>
    </div>
  );
}
