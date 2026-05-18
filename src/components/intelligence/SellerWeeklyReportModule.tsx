/**
 * Générateur de mise à jour vendeur — chronologie 7 j, garde-fous juridiques, envoi Nylas production.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, Loader2, Mail, PenLine } from 'lucide-react';
import {
  buildWeeklyChronologyBlock,
  detectBuyerDocumentInterest,
  filterLast7Days,
  postProcessSellerReport,
  resolveListingDocumentReleaseGate,
  type WeeklyCallSnapshot,
  type WeeklyMailSnapshot,
} from '@primexpert/core/intelligence';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { resolveDefaultEmailAccount, resolveEmailAccountsFromProfile } from '../../lib/emailAccounts';
import { cn } from '../../lib/utils';
import type { Residence } from '../../services/residences';
import type { CallAnalysisRow } from '../../services/transcriptionService';
import type { SavedMailboxAnalysis } from '../../services/mailboxAnalysis';
import { generateSellerWeeklyUpdateReport } from '../../services/gemini';
import { isNylasConfigured } from '../../services/nylasClient';
import {
  checkSellerUpdateSendReadiness,
  deliverSellerUpdateEmail,
  fetchResidenceDoc,
} from '../../services/sellerUpdateDelivery';
import { inst } from '../residence/institutional/InstitutionalUi';

export interface SellerWeeklyReportModuleProps {
  brokerId: string;
  residence: Residence;
  calls: CallAnalysisRow[];
  mails: SavedMailboxAnalysis[];
}

function ReadinessRow({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <li className="flex items-start gap-2 text-[10px] text-[#000000]">
      <span className="font-mono tabular-nums shrink-0">{ok ? '✓' : '○'}</span>
      <span className={ok ? '' : 'text-slate-600'}>{label}</span>
    </li>
  );
}

export function SellerWeeklyReportModule({
  brokerId,
  residence,
  calls,
  mails,
}: SellerWeeklyReportModuleProps) {
  const { t, language } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  const { profile } = useAuth();

  const [reportText, setReportText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [residenceDoc, setResidenceDoc] = useState<Record<string, unknown> | null>(null);

  const nylasOn = isNylasConfigured();

  const emailAccounts = useMemo(
    () =>
      resolveEmailAccountsFromProfile({
        emailAccounts: profile?.emailAccounts,
        email: profile?.email,
        displayName: profile?.displayName,
      }),
    [profile?.emailAccounts, profile?.email, profile?.displayName]
  );
  const defaultAccount = useMemo(
    () => resolveDefaultEmailAccount(emailAccounts),
    [emailAccounts]
  );

  const sendReadiness = useMemo(
    () =>
      checkSellerUpdateSendReadiness({
        account: defaultAccount,
        residenceDoc,
      }),
    [defaultAccount, residenceDoc]
  );

  const releaseGate = useMemo(
    () => resolveListingDocumentReleaseGate(residenceDoc),
    [residenceDoc]
  );

  const residenceLabel = residence.city
    ? `${residence.address}, ${residence.city}`
    : residence.address;

  const weeklyCalls = useMemo(() => {
    const items = calls
      .filter((c) => c.residenceId === residence.id)
      .map((c) => ({
        sortMs: c.updatedAtMillis,
        snapshot: {
          updatedAtMillis: c.updatedAtMillis,
          fileName: c.fileName,
          executiveSummary: c.executiveSummary,
          keyPoints: c.keyPoints,
          actionItems: c.actionItems,
          commitments: c.commitments,
        } satisfies WeeklyCallSnapshot,
      }));
    return filterLast7Days(items).map((i) => i.snapshot);
  }, [calls, residence.id]);

  const weeklyMails = useMemo(() => {
    const items = mails
      .filter((m) => m.matchedResidenceId === residence.id)
      .map((m) => ({
        sortMs: m.analyzedAtMillis,
        snapshot: {
          analyzedAtMillis: m.analyzedAtMillis,
          contactName: m.mergedParse.lead.contactName,
          intent: m.mergedParse.lead.intent,
          summaryOneLine: m.mergedParse.summaryOneLine,
          urgency: m.mergedParse.urgency,
        } satisfies WeeklyMailSnapshot,
      }));
    return filterLast7Days(items).map((i) => i.snapshot);
  }, [mails, residence.id]);

  const hasWeeklyActivity = weeklyCalls.length > 0 || weeklyMails.length > 0;

  useEffect(() => {
    let cancelled = false;
    void fetchResidenceDoc(residence.id).then((doc) => {
      if (!cancelled) setResidenceDoc(doc);
    });
    return () => {
      cancelled = true;
    };
  }, [residence.id]);

  const handleGenerate = useCallback(async () => {
    if (!hasWeeklyActivity) {
      setError(
        t(
          'Aucune interaction analysée sur les 7 derniers jours pour cette inscription.',
          'No analyzed interactions in the last 7 days for this listing.'
        )
      );
      return;
    }
    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const chronologyBlock = buildWeeklyChronologyBlock({
        calls: weeklyCalls,
        mails: weeklyMails,
        lang,
        locale,
      });
      const buyerSignals = detectBuyerDocumentInterest({
        mails: weeklyMails,
        calls: weeklyCalls,
      });
      const raw = await generateSellerWeeklyUpdateReport({
        locale: language,
        residenceLabel,
        chronologyBlock,
        buyerInterestReasons: buyerSignals.reasons,
        documentReleaseAllowed: releaseGate.documentReleaseAllowed,
      });
      const processed = postProcessSellerReport(raw, {
        buyerInterest: buyerSignals.detected,
        documentReleaseAllowed: releaseGate.documentReleaseAllowed,
        lang,
      });
      setReportText(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [
    hasWeeklyActivity,
    weeklyCalls,
    weeklyMails,
    lang,
    locale,
    language,
    residenceLabel,
    releaseGate.documentReleaseAllowed,
    t,
  ]);

  const handleCopy = useCallback(async () => {
    if (!reportText.trim()) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setSuccess(t('Message copié dans le presse-papiers.', 'Message copied to clipboard.'));
      setError(null);
    } catch {
      setError(
        t(
          'Impossible de copier — sélectionnez le texte manuellement.',
          'Could not copy — select the text manually.'
        )
      );
    }
  }, [reportText, t]);

  const handleSend = useCallback(async () => {
    if (!reportText.trim()) return;
    if (!sendReadiness.ready) {
      setError(sendReadiness.errors.join(' '));
      return;
    }
    if (!defaultAccount) return;

    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      await deliverSellerUpdateEmail({
        residenceId: residence.id,
        residenceLabel,
        body: reportText,
        account: defaultAccount,
        residenceDoc,
      });
      setSuccess(t('Mise à jour envoyée par Nylas.', 'Update sent via Nylas.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }, [
    reportText,
    sendReadiness,
    defaultAccount,
    residence.id,
    residenceLabel,
    residenceDoc,
    t,
  ]);

  const gmailConnected =
    Boolean(defaultAccount?.nylasGrantId) && defaultAccount?.syncStatus === 'connected';

  return (
    <section className={cn(inst.section, 'overflow-hidden')}>
      <header className={cn(inst.sectionHeader, 'flex flex-wrap items-center justify-between gap-3')}>
        <div>
          <h3 className={inst.sectionTitle}>
            {t('Mise à jour vendeur', 'Seller update')}
          </h3>
          <p className="text-[10px] text-slate-600 mt-1 font-medium">
            {t(
              '7 derniers jours · IA propose, vous disposez',
              'Last 7 days · AI proposes, you decide'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generating || !hasWeeklyActivity}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition',
            'bg-[#000000] text-white hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PenLine className="h-3.5 w-3.5" />
          )}
          {generating
            ? t('Rédaction…', 'Drafting…')
            : t('Rédiger une mise à jour', 'Draft seller update')}
        </button>
      </header>

      <div className="p-5 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#000000] mb-2">
            {t('Contrôles production', 'Production checks')}
          </p>
          <ul className="space-y-1">
            <ReadinessRow
              ok={nylasOn}
              label={t(
                'Nylas activé (VITE_NYLAS_ENABLED=true)',
                'Nylas enabled (VITE_NYLAS_ENABLED=true)'
              )}
            />
            <ReadinessRow
              ok={gmailConnected}
              label={t(
                'Gmail relié — jeton Nylas actif',
                'Gmail linked — active Nylas grant'
              )}
            />
            <ReadinessRow
              ok={Boolean(sendReadiness.vendeurEmail)}
              label={t(
                'Destinataire : vendeurEmail (racine résidence)',
                'Recipient: vendeurEmail (residence root)'
              )}
            />
            <ReadinessRow
              ok={releaseGate.ndaSignedValidated}
              label={t('NDA acquéreur validé au dossier', 'Buyer NDA validated on file')}
            />
            <ReadinessRow
              ok={releaseGate.proofOfDepositValidated}
              label={t(
                'Preuve de mise de fonds validée au dossier',
                'Proof of deposit validated on file'
              )}
            />
          </ul>
          {sendReadiness.vendeurEmail ? (
            <p className="mt-2 text-[10px] font-mono text-[#000000]">
              {sendReadiness.vendeurEmail}
            </p>
          ) : null}
        </div>

        <p className="text-[10px] text-slate-600 leading-relaxed">
          {t(
            `${weeklyCalls.length} appel(s) · ${weeklyMails.length} courriel(s) sur la période. Masquage des identités à la source (prénom ou initiale corporative).`,
            `${weeklyCalls.length} call(s) · ${weeklyMails.length} email(s) in scope. Identity masking at source (first name or corp. initial).`
          )}
        </p>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </p>
        )}
        {success && !error && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#000000]">
            {success}
          </p>
        )}

        {reportText ? (
          <>
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows={14}
              className={cn(
                'w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm leading-relaxed',
                'text-[#000000] resize-y min-h-[220px]',
                'focus:border-[#D4AF37]/50 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/25'
              )}
              aria-label={t('Texte de la mise à jour', 'Update text')}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#000000] hover:border-slate-400 transition"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                {t('Copier le message', 'Copy message')}
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending || !sendReadiness.ready}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#000000] hover:border-[#D4AF37]/50 disabled:opacity-40 transition"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="h-3.5 w-3.5" />
                )}
                {t('Envoyer la mise à jour', 'Send update')}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 italic text-center py-6 border border-dashed border-slate-200 rounded-xl">
            {t(
              'Cliquez sur « Rédiger une mise à jour » pour générer le rapport à partir de la chronologie.',
              'Click “Draft seller update” to generate the report from the timeline.'
            )}
          </p>
        )}
      </div>
    </section>
  );
}
