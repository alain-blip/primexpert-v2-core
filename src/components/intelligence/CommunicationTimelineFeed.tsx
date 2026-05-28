/**
 * Fil chronologique omnicanal — lecture seule (Nylas vs Vertex).
 */

import React, { useMemo } from 'react';
import { Mail, Mic, Phone } from 'lucide-react';
import type { UnifiedTimelineEvent } from '@primexpert/core/intelligence';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import { inst } from '../residence/institutional/InstitutionalUi';

export interface CommunicationTimelineFeedProps {
  events: UnifiedTimelineEvent[];
  titleFr?: string;
  titleEn?: string;
  emptyFr?: string;
  emptyEn?: string;
  className?: string;
}

function channelMeta(
  channel: UnifiedTimelineEvent['channel'],
  t: (fr: string, en: string) => string
) {
  if (channel === 'vertex_call') {
    return {
      icon: Mic,
      label: t('Appel · Vertex', 'Call · Vertex'),
      border: 'border-l-emerald-500',
      badge: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    };
  }
  if (channel === 'sms') {
    return {
      icon: Phone,
      label: t('SMS', 'SMS'),
      border: 'border-l-teal-500',
      badge: 'bg-teal-50 text-teal-900 border-teal-200',
    };
  }
  if (channel === 'facebook') {
    return {
      icon: Mail,
      label: t('Facebook', 'Facebook'),
      border: 'border-l-blue-500',
      badge: 'bg-blue-50 text-blue-900 border-blue-200',
    };
  }
  if (channel === 'instagram') {
    return {
      icon: Mail,
      label: t('Instagram', 'Instagram'),
      border: 'border-l-pink-500',
      badge: 'bg-pink-50 text-pink-900 border-pink-200',
    };
  }
  return {
    icon: Mail,
    label: t('Courriel · Nylas', 'Email · Nylas'),
    border: 'border-l-indigo-500',
    badge: 'bg-indigo-50 text-indigo-900 border-indigo-200',
  };
}

export function CommunicationTimelineFeed({
  events,
  titleFr = 'Historique des communications',
  titleEn = 'Communication history',
  emptyFr = 'Aucune interaction enregistrée pour ce périmètre.',
  emptyEn = 'No interactions recorded for this scope.',
  className,
}: CommunicationTimelineFeedProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr-CA' : 'en-CA';

  const sorted = useMemo(() => [...events].sort((a, b) => b.sortMs - a.sortMs), [events]);

  return (
    <section className={cn(inst.section, 'overflow-hidden', className)}>
      <header className={cn(inst.sectionHeader, 'flex items-center gap-2')}>
        <Phone className="h-4 w-4 text-[#142c6a]" />
        <h3 className={inst.sectionTitle}>{t(titleFr, titleEn)}</h3>
      </header>

      {sorted.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm font-semibold text-slate-600 leading-relaxed">
          {t(emptyFr, emptyEn)}
        </p>
      ) : (
        <ul className="p-4 space-y-3 max-h-[min(480px,50vh)] overflow-y-auto pr-1 custom-scrollbar">
          {sorted.map((ev) => {
            const meta = channelMeta(ev.channel, t);
            const Icon = meta.icon;
            const when = new Date(ev.sortMs).toLocaleString(locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            });
            return (
              <li
                key={ev.id}
                className={cn(
                  'rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm border-l-4',
                  meta.border
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span
                      className={cn(
                        'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border',
                        meta.badge
                      )}
                    >
                      {meta.label}
                    </span>
                    {ev.isCritical ? (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-amber-500 bg-amber-50 text-amber-950">
                        {t('Urgent', 'Urgent')}
                      </span>
                    ) : null}
                  </div>
                  <time className="text-[9px] font-mono text-slate-500">{when}</time>
                </div>
                <p className="text-sm font-bold text-[#142c6a] mt-2">{ev.title}</p>
                <p className="text-sm text-slate-700 mt-1 leading-snug">{ev.subtitle}</p>
                {ev.detail ? (
                  <p className="text-[10px] font-mono text-slate-600 mt-2 border-t border-slate-100 pt-2">
                    {ev.detail}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
