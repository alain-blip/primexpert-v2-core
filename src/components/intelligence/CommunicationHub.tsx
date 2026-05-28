/**
 * Hub de messagerie omnicanal — fil unifié email_threads (SSOT).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Facebook, Instagram, Loader2, Mail, MessageSquare } from 'lucide-react';
import { buildCrmThreadId } from '@primexpert/core/mail';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import type { EmailMessage } from '../../types/emailSync';
import { subscribeThreadMessages } from '../../services/emailSyncService';
import { inst } from '../residence/institutional/InstitutionalUi';

export interface CommunicationHubProps {
  brokerId: string;
  /** Contact CRM — fil `crm_{contactId}`. */
  contactId?: string | null;
  /** Repli si pas de contactId (SMS anonyme). */
  fallbackThreadId?: string | null;
  className?: string;
}

function channelBadge(channel: EmailMessage['channel'], t: (fr: string, en: string) => string) {
  const ch = channel ?? 'email';
  if (ch === 'sms') {
    return {
      icon: MessageSquare,
      label: t('SMS', 'SMS'),
      cls: 'border-emerald-600/40 bg-emerald-50 text-emerald-900',
    };
  }
  if (ch === 'facebook') {
    return {
      icon: Facebook,
      label: t('Facebook', 'Facebook'),
      cls: 'border-blue-600/40 bg-blue-50 text-blue-900',
    };
  }
  if (ch === 'instagram') {
    return {
      icon: Instagram,
      label: t('Instagram', 'Instagram'),
      cls: 'border-pink-600/40 bg-pink-50 text-pink-900',
    };
  }
  return {
    icon: Mail,
    label: t('Courriel', 'Email'),
    cls: 'border-indigo-600/40 bg-indigo-50 text-indigo-900',
  };
}

export function CommunicationHub({
  brokerId,
  contactId,
  fallbackThreadId,
  className,
}: CommunicationHubProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr-CA' : 'en-CA';
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const threadId = useMemo(() => {
    if (contactId?.trim()) return buildCrmThreadId(contactId);
    return fallbackThreadId?.trim() || null;
  }, [contactId, fallbackThreadId]);

  useEffect(() => {
    if (!brokerId || !threadId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeThreadMessages(
      brokerId,
      threadId,
      (rows) => {
        setMessages(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [brokerId, threadId]);

  return (
    <section className={cn(inst.section, 'overflow-hidden', className)}>
      <header className={cn(inst.sectionHeader, 'flex items-center gap-2')}>
        <MessageSquare className="h-4 w-4 text-[#142c6a]" />
        <h3 className={inst.sectionTitle}>
          {t('Messagerie unifiée', 'Unified messaging')}
        </h3>
      </header>

      {!threadId ? (
        <p className="px-6 py-8 text-center text-sm font-semibold text-slate-600">
          {t(
            'Aucun fil de communication lié à ce contact.',
            'No communication thread linked to this contact.'
          )}
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[#142c6a]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-bold">{t('Chargement…', 'Loading…')}</span>
        </div>
      ) : messages.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm font-semibold text-slate-600">
          {t(
            'Aucun message pour le moment — SMS, courriel ou réseaux sociaux apparaîtront ici.',
            'No messages yet — SMS, email, or social will appear here.'
          )}
        </p>
      ) : (
        <ul className="flex max-h-[min(420px,45vh)] flex-col gap-3 overflow-y-auto p-4 custom-scrollbar">
          {messages.map((msg) => {
            const inbound = msg.direction === 'inbound';
            const badge = channelBadge(msg.channel, t);
            const Icon = badge.icon;
            const when = new Date(msg.sentAtMillis).toLocaleString(locale, {
              dateStyle: 'short',
              timeStyle: 'short',
            });
            return (
              <li
                key={msg.id}
                className={cn('flex', inbound ? 'justify-start' : 'justify-end')}
              >
                <div
                  className={cn(
                    'max-w-[min(100%,28rem)] rounded-2xl border-2 px-4 py-3 shadow-sm',
                    inbound
                      ? 'border-slate-200 bg-white text-slate-900'
                      : 'border-[#142c6a]/30 bg-[#f1f5f9] text-slate-900'
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider',
                        badge.cls
                      )}
                    >
                      <Icon className="h-3 w-3" aria-hidden />
                      {badge.label}
                    </span>
                    {msg.isCritical ? (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-950">
                        <AlertTriangle className="h-3 w-3" />
                        {t('Urgent', 'Urgent')}
                      </span>
                    ) : null}
                    <time className="text-[9px] font-mono text-slate-500">{when}</time>
                  </div>
                  <p className="text-sm font-semibold leading-relaxed whitespace-pre-wrap">
                    {msg.body || msg.summaryOneLine || '—'}
                  </p>
                  {msg.authorName ? (
                    <p className="mt-1 text-[10px] font-bold text-slate-500">{msg.authorName}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
