/**
 * Enveloppe visuelle Confort 66+ pour les sections PA (bordure latérale épaisse).
 */

import React, { type ReactNode } from 'react';
import {
  institutionalListingsCardHeaderClass,
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
  institutionalListingsInlineInputClass,
} from '../../../lib/institutionalTheme';

const LABEL_HEADER =
  `${institutionalListingsCardTitleClass} text-[13px] tracking-[0.18em]`;

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
      className={`${institutionalListingsCardShellClass} border-l-8 ${borderAccentClass}`}
    >
      <header className={`${institutionalListingsCardHeaderClass} py-4`}>
        <h3 className={LABEL_HEADER}>{language === 'fr' ? titleFr : titleEn}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export const PA_LABEL_CLASS =
  'text-[13px] font-black uppercase tracking-wider text-slate-900';

export const PA_INPUT_CLASS =
  `${institutionalListingsInlineInputClass} h-12 rounded-xl text-[16px] font-black placeholder-slate-400 focus:ring-2 focus:ring-primexpert-dark/30`;

export const PA_VALUE_CLASS =
  'text-[16px] font-black text-black tabular-nums';
