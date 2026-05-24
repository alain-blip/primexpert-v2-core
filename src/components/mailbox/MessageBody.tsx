import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  buildEmailIframeSrcDoc,
  emailHtmlToPlainText,
  isHtmlEmailBody,
  visibleEmailTextLength,
} from '../../lib/emailHtml';

export type MessageBodyTone = 'inbound' | 'outbound' | 'institutional';

export interface MessageBodyProps {
  body: string;
  className?: string;
  tone?: MessageBodyTone;
  loading?: boolean;
  emptyLabel?: string;
}

const CANVAS_SHELL = 'flex min-h-0 w-full flex-1 flex-col bg-white';
const IFRAME_CLASS = 'block min-h-0 w-full flex-1 border-0 bg-white';
const PLAIN_TEXT_CLASS =
  'whitespace-pre-wrap p-6 text-sm leading-relaxed text-slate-800';

/** Corps de message — toile courriel pleine largeur (HTML iframe ou texte brut). */
export function MessageBody({
  body,
  className,
  loading = false,
  emptyLabel,
}: MessageBodyProps) {
  const trimmed = (body ?? '').trim();
  const hasVisibleContent = visibleEmailTextLength(trimmed) > 0;

  const srcDoc = useMemo(() => {
    if (!trimmed) return '';
    if (isHtmlEmailBody(trimmed)) return buildEmailIframeSrcDoc(trimmed, 'light');
    return '';
  }, [trimmed]);

  if (loading && !hasVisibleContent) {
    return (
      <div className={cn(CANVAS_SHELL, className)}>
        <div className="flex flex-1 items-center justify-center gap-2 p-6 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-sm italic">{emptyLabel ?? '…'}</p>
        </div>
      </div>
    );
  }

  if (!trimmed) {
    return (
      <div className={cn(CANVAS_SHELL, className)}>
        <p className="flex flex-1 items-center p-6 text-sm italic text-slate-500">
          {emptyLabel ?? '—'}
        </p>
      </div>
    );
  }

  if (srcDoc) {
    return (
      <div className={cn(CANVAS_SHELL, className)}>
        <iframe
          title="Contenu du courriel"
          srcDoc={srcDoc}
          className={IFRAME_CLASS}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    );
  }

  if (isHtmlEmailBody(trimmed)) {
    const plain = emailHtmlToPlainText(trimmed);
    if (plain) {
      return (
        <div className={cn(CANVAS_SHELL, className)}>
          <p className={PLAIN_TEXT_CLASS}>{plain}</p>
        </div>
      );
    }
  }

  return (
    <div className={cn(CANVAS_SHELL, className)}>
      <p className={PLAIN_TEXT_CLASS}>{body}</p>
    </div>
  );
}
