import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  buildEmailIframeSrcDoc,
  emailHtmlToPlainText,
  isHtmlEmailBody,
} from '../../lib/emailHtml';

export type MessageBodyTone = 'inbound' | 'outbound' | 'institutional';

export interface MessageBodyProps {
  body: string;
  className?: string;
  tone?: MessageBodyTone;
  loading?: boolean;
  emptyLabel?: string;
  /** Dump JSON de secours (débogage PO) quand le corps reste vide après hydratation. */
  debugPayload?: unknown;
}

function plainTextClassForTone(tone: MessageBodyTone): string {
  if (tone === 'outbound') return 'text-white';
  if (tone === 'inbound') return 'text-slate-200';
  return 'text-slate-800';
}

const IFRAME_CLASS =
  'w-full min-h-[500px] flex-grow border-0 bg-white rounded-md';

/** Corps de message — texte brut ou HTML courriel dans iframe isolée (`srcDoc`). */
export function MessageBody({
  body,
  className,
  tone = 'institutional',
  loading = false,
  emptyLabel,
  debugPayload,
}: MessageBodyProps) {
  const trimmed = (body ?? '').trim();

  const srcDoc = useMemo(() => {
    if (!trimmed) return '';
    if (isHtmlEmailBody(trimmed)) return buildEmailIframeSrcDoc(trimmed);
    return '';
  }, [trimmed]);

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
    return (
      <div className={cn('min-h-[80px] space-y-2', className)}>
        <p className={cn('text-sm', plainTextClassForTone(tone), emptyLabel ? 'italic opacity-80' : '')}>
          {emptyLabel ?? '—'}
        </p>
        {debugPayload != null ? (
          <pre className="max-h-64 overflow-auto rounded-md bg-white p-2 text-left text-[10px] text-red-600">
            {JSON.stringify(debugPayload, null, 2)}
          </pre>
        ) : null}
      </div>
    );
  }

  if (srcDoc) {
    return (
      <iframe
        title="Contenu du courriel"
        srcDoc={srcDoc}
        className={cn(IFRAME_CLASS, className)}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
      />
    );
  }

  if (isHtmlEmailBody(trimmed)) {
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
    return (
      <div className={cn('space-y-2', className)}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
          HTML détecté mais iframe vide — corps brut ci-dessous
        </p>
        <pre className="max-h-96 overflow-auto rounded-md bg-white p-2 text-left text-[10px] text-slate-800">
          {trimmed.slice(0, 8000)}
          {trimmed.length > 8000 ? '\n…' : ''}
        </pre>
        {debugPayload != null ? (
          <pre className="max-h-48 overflow-auto rounded-md bg-white/90 p-2 text-[10px] text-red-600">
            {JSON.stringify(debugPayload, null, 2)}
          </pre>
        ) : null}
      </div>
    );
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
