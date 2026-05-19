import React, { type ReactNode } from 'react';
import { cn } from '../../../lib/utils';

/**
 * Carte d'enveloppe d'une section d'identité — charte Confort 66+.
 *
 * Le `headerAction` reste exposé pour les cartes qui en ont besoin (ex:
 * pyramide des âges), mais les blocs de saisie ne l'utilisent plus
 * (édition inline permanente).
 */
export interface IdentitySectionCardProps {
  title: string;
  accent: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

export function IdentitySectionCard({
  title,
  accent,
  children,
  className,
  headerAction,
}: IdentitySectionCardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden',
        className
      )}
      style={{ borderLeftWidth: 8, borderLeftColor: accent }}
    >
      <header className="flex items-center justify-between gap-3 border-b-2 border-slate-100 bg-slate-50/80 px-5 py-4">
        <h3 className="text-[13px] font-black uppercase tracking-[0.18em] text-[#142c6a]">
          {title}
        </h3>
        {headerAction}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
