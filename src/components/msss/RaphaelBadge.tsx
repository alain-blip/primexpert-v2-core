/**
 * Badge Raphaël ✨ — donnée extractible du Registre officiel MSSS.
 */

import React from 'react';
import { cn } from '../../lib/utils';

export interface RaphaelBadgeProps {
  show?: boolean;
  source?: string;
  title?: string;
  className?: string;
}

export function RaphaelBadge({
  show = false,
  source = 'MSSS',
  title,
  className,
}: RaphaelBadgeProps) {
  if (!show) return null;

  const tip =
    title ??
    `Extrait automatiquement du Registre officiel du ${source} par Raphaël — validation recommandée avant publication.`;

  return (
    <span
      className={cn(
        'inline-flex items-center ml-1 cursor-help text-[0.85em] leading-none select-none',
        className
      )}
      title={tip}
      aria-label={tip}
      role="img"
    >
      ✨
    </span>
  );
}
