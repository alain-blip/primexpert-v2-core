/**
 * Hub de messagerie omnicanal — fil unifié email_threads (SSOT).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Facebook,
  Loader2,
  Mail,
  MessageSquare,
  PhoneCall,
} from 'lucide-react';
import { buildCrmThreadId } from '@primexpert/core/mail';
import {
  calculateHotLeadScore,
  extractHotLeadSignalsFromMessages,
} from '@primexpert/core/crm';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import type { EmailMessage } from '../../types/emailSync';
import { subscribeThreadMessages } from '../../services/emailSyncService';
import { inst } from '../residence/institutional/InstitutionalUi';

export interface CommunicationHubProps {
  brokerId: string;
  orgId?: string | null;
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
  if (ch === 'facebook' || ch === 'instagram') {
    return {
      icon: Facebook,
      label: t('Meta', 'Meta'),
      cls: 'border-blue-600/40 bg-blue-50 text-blue-900',
    };
  }
  if (ch === 'voice_call') {
    return {
      icon: PhoneCall,
      label: t('Appel', 'Voice call'),
      cls: 'border-violet-600/40 bg-violet-50 text-violet-900',
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
  orgId,
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
        const sorted = [...rows].sort(
          (a, b) => (a.timestamp ?? a.sentAtMillis) - (b.timestamp ?? b.sentAtMillis)
        );
        setMessages(sorted);
        setLoading(false);
      },
      () => setLoading(false),
      orgId
    );
    return unsub;
  }, [brokerId, threadId, orgId]);

  const hotLeadScore = useMemo(() => {
    const signals = extractHotLeadSignalsFromMessages(messages);
    return calculateHotLeadScore({ signals }).score;
  }, [messages]);

  return (
    <section className={cn(inst.section, 'overflow-hidden', className)}>
      <header className={cn(inst.sectionHeader, 'flex items-center justify-between gap-2')}>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#142c6a]" />
          <h3 className={inst.sectionTitle}>
            {t('Messagerie unifiée', 'Unified messaging')}
          </h3>
        </div>
        <span className="inline-flex items-center rounded-lg border-2 border-primexpert-dark bg-white dark:bg-primexpert-cardDark px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-black">
          {t('Score hot lead', 'Hot lead score')} {hotLeadScore}/100
        </span>
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
        <div className="px-6 py-8">
          <div className="mx-auto max-w-xl animate-pulse space-y-2 rounded-xl border-2 border-dashed border-primexpert-dark/35 bg-primexpert-light dark:bg-primexpert-cardDark p-4">
            <div className="h-3 w-1/3 rounded bg-white/80 dark:bg-white/40" />
            <div className="h-3 w-full rounded bg-white/80 dark:bg-white/40" />
            <div className="h-3 w-2/3 rounded bg-white/80 dark:bg-white/40" />
          </div>
          <p className="mt-3 text-center text-sm font-semibold text-slate-700">
            {t(
              'Aucune interaction journalisée pour ce contact. Lancez une séquence de suivi.',
              'Aucune interaction journalisée pour ce contact. Lancez une séquence de suivi.'
            )}
          </p>
        </div>
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
                      ? 'border-slate-200 bg-white dark:bg-primexpert-cardDark text-slate-900'
                      : 'border-[#142c6a]/30 bg-[#f1f5f9] dark:bg-primexpert-cardDark text-slate-900'
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
