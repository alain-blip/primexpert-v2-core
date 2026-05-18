import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface MessageReadReceiptProps {
  isOpened?: boolean;
  openedAtMillis?: number;
  locale: 'fr' | 'en';
  deliveredLabel: string;
  readLabel: string;
}

function formatOpenedAt(ms: number, locale: 'fr' | 'en'): string {
  return new Date(ms).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Coches type messagerie : reçu (gris) / lu (bleu). */
export function MessageReadReceipt({
  isOpened,
  openedAtMillis,
  locale,
  deliveredLabel,
  readLabel,
}: MessageReadReceiptProps) {
  const tooltip =
    isOpened && openedAtMillis
      ? `${readLabel} · ${formatOpenedAt(openedAtMillis, locale)}`
      : deliveredLabel;

  return (
    <span
      className="inline-flex shrink-0 items-center"
      title={tooltip}
      aria-label={tooltip}
    >
      {isOpened ? (
        <CheckCheck className={cn('h-3.5 w-3.5 text-blue-200')} strokeWidth={2.5} />
      ) : (
        <Check className="h-3.5 w-3.5 text-slate-400/90" strokeWidth={2.5} />
      )}
    </span>
  );
}
