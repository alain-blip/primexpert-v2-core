/**
 * Panneau « Historique intelligent » — agrège E-3 (appels) et E-2 (courriels matchés)
 * pour une résidence donnée (vue 360° « Mes inscriptions »).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Sparkles, Mail, Mic } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { cn } from '../lib/utils';
import type { Residence } from '../services/residences';
import {
  subscribeCallAnalysesForResidence,
  type CallAnalysisRow,
} from '../services/transcriptionService';
import {
  subscribeMailboxAnalysesForResidence,
  type SavedMailboxAnalysis,
} from '../services/mailboxAnalysis';
import { inst, InstitutionalPageHeader } from './residence/institutional/InstitutionalUi';
import { SellerWeeklyReportModule } from './intelligence/SellerWeeklyReportModule';
import { IntelligenceChronologie } from './intelligence/IntelligenceChronologie';

interface IntelTimelineItem {
  kind: 'call' | 'mail';
  sortMs: number;
  call?: CallAnalysisRow;
  mail?: SavedMailboxAnalysis;
}

function callStatusLabel(
  row: CallAnalysisRow,
  t: (fr: string, en: string) => string
): { emoji: string; label: string } {
  switch (row.pipelineStatus) {
    case 'recorded':
      return { emoji: '🎙️', label: t('Enregistré', 'Recorded') };
    case 'transcribing':
    case 'analyzing':
      return { emoji: '⚙️', label: t('Transcription', 'Transcribing') };
    case 'analyzed':
      return { emoji: '✨', label: t('Analyzed', 'Analyzed') };
    default:
      return { emoji: '⚠️', label: t('Échec', 'Failed') };
  }
}

export interface ResidenceIntelligencePanelProps {
  brokerId: string;
  residence: Residence;
  onClose: () => void;
  /** Intégré dans ResidenceDetail : masque retour + en-tête dupliqué. */
  embedded?: boolean;
}

export function ResidenceIntelligencePanel({
  brokerId,
  residence,
  onClose,
  embedded = false,
}: ResidenceIntelligencePanelProps) {
  const { t } = useLanguage();
  const [calls, setCalls] = useState<CallAnalysisRow[]>([]);
  const [mails, setMails] = useState<SavedMailboxAnalysis[]>([]);
  const [subError, setSubError] = useState<string | null>(null);

  useEffect(() => {
    if (!brokerId || !residence.id) return;
    setSubError(null);
    const unsubCalls = subscribeCallAnalysesForResidence(
      brokerId,
      residence.id,
      setCalls,
      (e) => setSubError(e.message)
    );
    const unsubMails = subscribeMailboxAnalysesForResidence(
      brokerId,
      residence.id,
      setMails,
      (e) => setSubError((prev) => prev ?? e.message)
    );
    return () => {
      unsubCalls();
      unsubMails();
    };
  }, [brokerId, residence.id]);

  const timeline = useMemo(() => {
    const items: IntelTimelineItem[] = [
      ...calls.map((c) => ({
        kind: 'call' as const,
        sortMs: c.updatedAtMillis,
        call: c,
      })),
      ...mails.map((m) => ({
        kind: 'mail' as const,
        sortMs: m.analyzedAtMillis,
        mail: m,
      })),
    ];
    return items.sort((a, b) => b.sortMs - a.sortMs);
  }, [calls, mails]);

  const addrTitle = residence.city ? `${residence.address}, ${residence.city}` : residence.address;

  return (
    <div className={cn('space-y-5', inst.page)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {!embedded && (
            <button
              type="button"
              onClick={onClose}
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-[#000000] transition"
              aria-label={t('Retour à mes inscriptions', 'Back to my listings')}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0">
            {!embedded ? (
              <>
                <InstitutionalPageHeader
                  title={t('Vue 360° · Intelligence centralisée', '360° view · Centralized intelligence')}
                />
                <h2 className="text-xl font-black text-[#000000] tracking-tight truncate -mt-2">{addrTitle}</h2>
              </>
            ) : (
              <InstitutionalPageHeader
                icon={<Sparkles className="h-5 w-5 text-slate-700 shrink-0" />}
                title={t('Intelligence · Chronologie', 'Intelligence · Timeline')}
                meta={t('Appels & courriels analysés', 'Analyzed calls & emails')}
              />
            )}
          </div>
        </div>
      </div>

      {subError && (
        <div className={inst.alertAmber}>
          {t(
            'Abonnement Firestore : vérifie les règles déployées et crée l’index composite si la console le demande.',
            'Firestore subscription: deploy rules and create the composite index if the console prompts you.'
          )}{' '}
          <span className="font-mono text-slate-600">({subError})</span>
        </div>
      )}

      <SellerWeeklyReportModule
        brokerId={brokerId}
        residence={residence}
        calls={calls}
        mails={mails}
      />

      <IntelligenceChronologie
        brokerId={brokerId}
        residence={residence}
        calls={calls}
        mails={mails}
      />

      <section className={inst.section}>
        <header className={cn(inst.sectionHeader, 'flex items-center gap-2')}>
          <Sparkles className="h-4 w-4 text-slate-700" />
          <h3 className={inst.sectionTitle}>{t('Historique intelligent', 'Smart history')}</h3>
        </header>

        {timeline.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm font-semibold text-slate-600 leading-relaxed">
            {t(
              'Aucun appel ni courriel analysé n’est encore rattaché à cette propriété. Enregistre un appel (Téléphonie) ou analyse un courriel matché à cette résidence.',
              'No calls or analyzed emails are linked to this property yet. Record a call or analyze an email matched to this listing.'
            )}
          </p>
        ) : (
          <ul className="p-4 space-y-3 max-h-[min(520px,55vh)] overflow-y-auto pr-1 custom-scrollbar">
            {timeline.map((item) => {
              if (item.kind === 'call' && item.call) {
                const row = item.call;
                const st = callStatusLabel(row, t);
                return (
                  <li
                    key={`call-${row.driveDocumentId}`}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mic className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                          {t('Appel', 'Call')}
                        </span>
                      </div>
                      <span className="text-lg leading-none shrink-0" aria-hidden>
                        {st.emoji}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-[#000000] mt-1 truncate">{row.fileName}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mt-0.5">
                      {st.label}
                    </p>
                    {row.pipelineStatus === 'analyzed' && row.executiveSummary?.trim() ? (
                      <p className="mt-2 text-sm text-[#000000] leading-relaxed border-t border-slate-200 pt-2">
                        {row.executiveSummary}
                      </p>
                    ) : null}
                    {row.pipelineStatus === 'failed' && row.errorMessage ? (
                      <p className="mt-2 text-[10px] text-red-800 font-mono">{row.errorMessage}</p>
                    ) : null}
                  </li>
                );
              }
              if (item.kind === 'mail' && item.mail) {
                const m = item.mail;
                const p = m.mergedParse;
                const name =
                  p.lead.contactName?.trim() ||
                  t('Contact (courriel)', 'Contact (email)');
                return (
                  <li
                    key={`mail-${m.messageId}`}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-slate-700 shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        {t('Courriel analysé', 'Analyzed email')}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#000000] mt-1">{name}</p>
                    <p className="text-sm text-slate-700 mt-1 leading-snug line-clamp-3">{p.summaryOneLine}</p>
                    <p className="text-[9px] font-mono text-slate-600 mt-2">
                      {t('Intent', 'Intent')}: {p.lead.intent} · {t('Urgence', 'Urgency')}: {p.urgency}
                    </p>
                  </li>
                );
              }
              return null;
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
