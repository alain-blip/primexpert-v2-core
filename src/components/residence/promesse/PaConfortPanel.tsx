/**
 * Enveloppe visuelle Confort 66+ pour les sections PA (bordure latérale épaisse).
 */

import React, { type ReactNode } from 'react';

const LABEL_HEADER =
  'text-[13px] font-black uppercase tracking-[0.18em] text-[#142c6a]';

export interface PaConfortPanelProps {
  titleFr: string;
  titleEn: string;
  language: 'fr' | 'en';
  borderAccentClass: string;
  children: ReactNode;
}

export function PaConfortPanel({
  titleFr,
  titleEn,
  language,
  borderAccentClass,
  children,
}: PaConfortPanelProps) {
  return (
    <section
      className={`overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm border-l-8 ${borderAccentClass}`}
    >
      <header className="border-b-2 border-slate-100 bg-slate-50/80 px-5 py-4">
        <h3 className={LABEL_HEADER}>{language === 'fr' ? titleFr : titleEn}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export const PA_LABEL_CLASS =
  'text-[13px] font-black uppercase tracking-wider text-[#142c6a]';

export const PA_INPUT_CLASS =
  'h-12 w-full rounded-xl border-2 border-black/20 bg-white px-3 text-[16px] font-black text-black placeholder-slate-400 focus:border-[#142c6a] focus:outline-none focus:ring-2 focus:ring-[#142c6a]/30';

export const PA_VALUE_CLASS =
  'text-[16px] font-black text-black tabular-nums';
