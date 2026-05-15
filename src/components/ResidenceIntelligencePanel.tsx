/**
 * Panneau « Historique intelligent » — agrège E-3 (appels) et E-2 (courriels matchés)
 * pour une résidence donnée (vue 360° « Mes inscriptions »).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Mail,
  Mic,
  FileText,
  ScrollText,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../lib/i18n';
import { useWorkhubNav } from '../lib/workhubNav';
import { stashContentGenPrefill } from '../lib/contentGenPrefill';
import { formatCurrency } from '../lib/utils';
import type { Residence } from '../services/residences';
import {
  subscribeCallAnalysesForResidence,
  type CallAnalysisRow,
} from '../services/transcriptionService';
import {
  subscribeMailboxAnalysesForResidence,
  type SavedMailboxAnalysis,
} from '../services/mailboxAnalysis';

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
      return { emoji: '✨', label: t('Analysé', 'Analyzed') };
    default:
      return { emoji: '⚠️', label: t('Échec', 'Failed') };
  }
}

export interface ResidenceIntelligencePanelProps {
  brokerId: string;
  residence: Residence;
  onClose: () => void;
}

export function ResidenceIntelligencePanel({
  brokerId,
  residence,
  onClose,
}: ResidenceIntelligencePanelProps) {
  const { t, language } = useLanguage();
  const workhubNav = useWorkhubNav();
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

  const topAnalyzedCall = useMemo(
    () =>
      calls.find(
        (c) => c.pipelineStatus === 'analyzed' && (c.executiveSummary?.trim()?.length ?? 0) > 0
      ),
    [calls]
  );

  const handleDraftSellerUpdate = () => {
    if (!topAnalyzedCall?.executiveSummary?.trim()) return;
    const addr = residence.city ? `${residence.address}, ${residence.city}` : residence.address;
    const briefing = [
      t(
        'CONTEXTE — Mise à jour vendeur (synthèse appel récent)',
        'CONTEXT — Seller update (recent call summary)'
      ),
      '',
      `${t('Fichier', 'File')}: ${topAnalyzedCall.fileName}`,
      '',
      t('Résumé exécutif', 'Executive summary'),
      topAnalyzedCall.executiveSummary,
      '',
      topAnalyzedCall.commitments?.length
        ? `${t('Engagements', 'Commitments')}:\n${topAnalyzedCall.commitments.map((x) => `• ${x}`).join('\n')}`
        : '',
      topAnalyzedCall.keyPoints?.length
        ? `\n${t('Points clés', 'Key points')}:\n${topAnalyzedCall.keyPoints.map((x) => `• ${x}`).join('\n')}`
        : '',
      topAnalyzedCall.actionItems?.length
        ? `\n${t('Suivi', 'Follow-up')}:\n${topAnalyzedCall.actionItems.map((x) => `• ${x}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    stashContentGenPrefill({
      residenceId: residence.id,
      addressLine: addr,
      priceHint: formatCurrency(residence.price),
      briefingBlock: briefing,
    });
    workhubNav?.setActiveTab('content');
  };

  const handleVendorReport = () => {
    if (timeline.length === 0) return;
    const addr = residence.city ? `${residence.address}, ${residence.city}` : residence.address;
    const locale = language === 'fr' ? 'fr-CA' : 'en-CA';
    const nCalls = timeline.filter((x) => x.kind === 'call').length;
    const nMails = timeline.filter((x) => x.kind === 'mail').length;
    const lines: string[] = [];
    for (const item of timeline) {
      const when = new Date(item.sortMs).toLocaleString(locale, {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      if (item.kind === 'call' && item.call) {
        const row = item.call;
        const st = callStatusLabel(row, t);
        lines.push(
          [
            `### ${when} — ${t('Appel', 'Call')}: ${row.fileName}`,
            `${t('Statut', 'Status')}: ${st.label}`,
            row.executiveSummary?.trim() ? row.executiveSummary.trim() : `(${t('Pas de résumé', 'No summary')})`,
          ].join('\n')
        );
      } else if (item.kind === 'mail' && item.mail) {
        const m = item.mail;
        lines.push(
          [
            `### ${when} — ${t('Courriel analysé', 'Analyzed email')}`,
            m.mergedParse.summaryOneLine,
            `${t('Intent', 'Intent')}: ${m.mergedParse.lead.intent} · ${t('Urgence', 'Urgency')}: ${m.mergedParse.urgency}`,
          ].join('\n')
        );
      }
    }
    const briefing = [
      t(
        'DIRECTIVE RÉDACTEUR IA — Rapport vendeur (prestige, OACIQ, français du Québec).',
        'AI WRITER DIRECTIVE — Seller-facing report (professional, compliant tone).'
      ),
      '',
      t(
        `Synthétise ${nCalls} appel(s) et ${nMails} courriel(s) analysé(s) en un rapport vendeur clair. Ne rien inventer : t’appuie uniquement sur la chronologie ci-dessous.`,
        `Synthesize ${nCalls} call(s) and ${nMails} analyzed email(s) into a clear seller-facing report. Do not invent facts—use only the timeline below.`
      ),
      '',
      `${t('Inscription', 'Listing')}: ${addr}`,
      `${t('Prix affiché', 'List price')}: ${formatCurrency(residence.price)}`,
      '',
      t(
        'Structure suggérée : 1) Synthèse exécutive 2) Fil des échanges 3) Prochaines étapes 4) Ton rassurant et professionnel.',
        'Suggested structure: 1) Executive summary 2) Interaction timeline 3) Next steps 4) Reassuring professional tone.'
      ),
      '',
      t('CHRONOLOGIE (du plus récent au plus ancien)', 'TIMELINE (newest to oldest)'),
      '',
      ...lines,
    ].join('\n');

    stashContentGenPrefill({
      residenceId: residence.id,
      addressLine: addr,
      priceHint: formatCurrency(residence.price),
      briefingBlock: briefing,
    });
    workhubNav?.setActiveTab('content');
  };

  const addrTitle = residence.city ? `${residence.address}, ${residence.city}` : residence.address;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 hover:border-blue-400/50 hover:text-white transition"
            aria-label={t('Retour à mes inscriptions', 'Back to my listings')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-400/90">
              {t('Vue 360° · Intelligence centralisée', '360° view · Centralized intelligence')}
            </p>
            <h2 className="text-2xl font-black text-white tracking-tight truncate">{addrTitle}</h2>
            <p className="text-[11px] font-bold text-slate-500 mt-1 font-mono">
              {formatCurrency(residence.price)} · ID {residence.id}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={timeline.length === 0}
            onClick={handleVendorReport}
            className="flex items-center gap-2 rounded-xl border border-violet-400/35 bg-violet-500/15 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-violet-100 hover:bg-violet-500/25 disabled:opacity-35 disabled:cursor-not-allowed transition"
          >
            <ScrollText className="h-4 w-4 shrink-0" />
            {t('Rapport vendeur', 'Seller report')}
          </button>
          <button
            type="button"
            disabled={!topAnalyzedCall}
            onClick={handleDraftSellerUpdate}
            className="flex items-center gap-2 rounded-xl border border-blue-400/35 bg-blue-500/15 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200 hover:bg-blue-500/25 disabled:opacity-35 disabled:cursor-not-allowed transition"
          >
            <FileText className="h-4 w-4 shrink-0" />
            {t('Rédiger une mise à jour', 'Draft seller update')}
          </button>
        </div>
      </div>

      {subError && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.07] px-4 py-3 text-[11px] text-amber-200">
          {t(
            'Abonnement Firestore : vérifie les règles déployées et crée l’index composite si la console le demande.',
            'Firestore subscription: deploy rules and create the composite index if the console prompts you.'
          )}{' '}
          <span className="font-mono opacity-80">({subError})</span>
        </div>
      )}

      <div className="rounded-[24px] border border-white/10 bg-vault px-6 py-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-200">
            {t('Historique intelligent', 'Smart history')}
          </h3>
        </div>

        {timeline.length === 0 ? (
          <p className="py-10 text-center text-[12px] font-semibold text-slate-500 leading-relaxed px-4">
            {t(
              'Aucun appel ni courriel analysé n’est encore rattaché à cette propriété. Enregistre un appel (Téléphonie) ou analyse un courriel matché à cette résidence.',
              'No calls or analyzed emails are linked to this property yet. Record a call or analyze an email matched to this listing.'
            )}
          </p>
        ) : (
          <ul className="space-y-3 max-h-[min(520px,55vh)] overflow-y-auto pr-1 custom-scrollbar">
            {timeline.map((item) => {
              if (item.kind === 'call' && item.call) {
                const row = item.call;
                const st = callStatusLabel(row, t);
                return (
                  <li
                    key={`call-${row.driveDocumentId}`}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mic className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {t('Appel', 'Call')}
                        </span>
                      </div>
                      <span className="text-lg leading-none shrink-0" aria-hidden>
                        {st.emoji}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-300 mt-1 truncate">{row.fileName}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">
                      {st.label}
                    </p>
                    {row.pipelineStatus === 'analyzed' && row.executiveSummary?.trim() ? (
                      <p className="mt-2 text-[12px] text-slate-200 leading-relaxed border-t border-white/5 pt-2">
                        {row.executiveSummary}
                      </p>
                    ) : null}
                    {row.pipelineStatus === 'failed' && row.errorMessage ? (
                      <p className="mt-2 text-[10px] text-red-400/90 font-mono">{row.errorMessage}</p>
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
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {t('Courriel analysé', 'Analyzed email')}
                      </span>
                    </div>
                    <p className="text-[12px] font-bold text-slate-200 mt-1">{name}</p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug line-clamp-3">
                      {p.summaryOneLine}
                    </p>
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
      </div>
    </motion.div>
  );
}
