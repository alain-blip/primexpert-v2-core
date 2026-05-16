import React, { type ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export interface IdentitySectionCardProps {
  title: string;
  accent: string;
  children: ReactNode;
  className?: string;
}

export function IdentitySectionCard({
  title,
  accent,
  children,
  className,
}: IdentitySectionCardProps) {
  return (
    <section
      className={cn(
        'rounded-[20px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden',
        className
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <header className="px-5 py-3 border-b border-slate-100 bg-slate-50/80">
        <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#000000]">
          {title}
        </h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
