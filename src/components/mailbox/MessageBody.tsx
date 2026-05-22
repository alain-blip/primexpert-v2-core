import React from 'react';
import { cn } from '../../lib/utils';
import { emailHtmlToPlainText, isHtmlEmailBody, sanitizeEmailHtml } from '../../lib/emailHtml';

export type MessageBodyTone = 'inbound' | 'outbound' | 'institutional';

export interface MessageBodyProps {
  body: string;
  className?: string;
  /** inbound = bulle entrante ; outbound = bulle sortante bleue ; institutional = carte blanche (legacy) */
  tone?: MessageBodyTone;
  /** Corps en cours de chargement (Nylas / Firestore). */
  loading?: boolean;
  emptyLabel?: string;
}

function htmlClassForTone(tone: MessageBodyTone): string {
  if (tone === 'outbound') return 'email-message-html--outbound';
  if (tone === 'inbound') return 'email-message-html--inbound';
  return 'email-message-html--institutional';
}

function plainTextClassForTone(tone: MessageBodyTone): string {
  if (tone === 'outbound') return 'text-white';
  if (tone === 'inbound') return 'text-slate-200';
  return 'text-slate-800';
}

/** Corps de message — texte brut ou HTML courriel assaini. */
export function MessageBody({
  body,
  className,
  tone = 'institutional',
  loading = false,
  emptyLabel,
}: MessageBodyProps) {
  const trimmed = body.trim();

  if (loading && !trimmed) {
    return (
      <p
        className={cn(
          'text-sm italic',
          plainTextClassForTone(tone),
          tone === 'inbound' ? 'opacity-70' : 'opacity-80',
          className
        )}
      >
        {emptyLabel ?? '…'}
      </p>
    );
  }

  if (!trimmed) {
    if (!emptyLabel) return null;
    return (
      <p className={cn('text-sm italic opacity-60', plainTextClassForTone(tone), className)}>
        {emptyLabel}
      </p>
    );
  }

  if (isHtmlEmailBody(trimmed)) {
    const sanitized = sanitizeEmailHtml(trimmed);
    if (sanitized.trim()) {
      return (
        <div
          className={cn(htmlClassForTone(tone), className)}
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      );
    }
    const plain = emailHtmlToPlainText(trimmed);
    if (plain) {
      return (
        <p
          className={cn(
            'whitespace-pre-wrap text-sm leading-relaxed',
            plainTextClassForTone(tone),
            className
          )}
        >
          {plain}
        </p>
      );
    }
  }

  return (
    <p
      className={cn(
        'whitespace-pre-wrap text-sm leading-relaxed',
        plainTextClassForTone(tone),
        className
      )}
    >
      {body}
    </p>
  );
}
