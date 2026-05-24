import React from 'react';
import { cn } from '../../lib/utils';
import {
  institutionalPanelShellClass,
  institutionalPanelSubtitleClass,
  institutionalPanelTitleClass,
} from '../../lib/institutionalTheme';

export interface PageGuideHeaderProps {
  title: string;
  /** Paragraphe « Mode d'emploi : … » */
  guide: string;
  className?: string;
}

/** En-tête bleu institutionnel — titre + mode d'emploi (pattern Statistiques du marché). */
export function PageGuideHeader({ title, guide, className }: PageGuideHeaderProps) {
  return (
    <header className={cn('px-1', className)}>
      <h1 className={institutionalPanelTitleClass}>{title}</h1>
      <p className={institutionalPanelSubtitleClass}>{guide}</p>
    </header>
  );
}

/** Coquille bleue standard pour une page Workhub (en-tête + contenu). */
export function PageGuideShell({
  title,
  guide,
  children,
  className,
}: PageGuideHeaderProps & { children?: React.ReactNode }) {
  return (
    <section className={cn(institutionalPanelShellClass, 'space-y-6', className)}>
      <PageGuideHeader title={title} guide={guide} />
      {children}
    </section>
  );
}
