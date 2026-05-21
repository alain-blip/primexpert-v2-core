/**
 * Chronologie post-libération documentaire — protocole J+7 (vélocité transactionnelle).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, PenLine } from 'lucide-react';
import {
  computeTransactionVelocity,
  RELANCE_J5_TEMPLATE_FR,
  type VelocityCallInput,
  type VelocityMailInput,
} from '@primexpert/core/intelligence';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { resolveDefaultEmailAccount, resolveEmailAccountsFromProfile } from '../../lib/emailAccounts';
import { cn } from '../../lib/utils';
import type { Residence } from '../../services/residences';
import type { CallAnalysisRow } from '../../services/transcriptionService';
import type { SavedMailboxAnalysis } from '../../services/mailboxAnalysis';
import { fetchResidenceDoc } from '../../services/sellerUpdateDelivery';
import {
  checkBuyerRelanceSendReadiness,
  deliverBuyerRelanceEmail,
} from '../../services/buyerRelanceDelivery';
import { isNylasConfigured } from '../../services/nylasClient';
import type { UnifiedTimelineEvent } from '@primexpert/core/intelligence';
import { CommunicationTimelineFeed } from './CommunicationTimelineFeed';
import { inst } from '../residence/institutional/InstitutionalUi';

export type ChronologieMode = 'residence-full' | 'communications-only';

export interface IntelligenceChronologieProps {
  brokerId: string;
  /** Requis pour le protocole J+7 ; optionnel en mode communications-only. */
  residence?: Residence;
  calls?: CallAnalysisRow[];
  mails?: SavedMailboxAnalysis[];
  /** Mode omnicanal contact ou fil dérivé pré-calculé. */
  mode?: ChronologieMode;
  /** Événements agrégés (@primexpert/core/intelligence) — lecture seule. */
  timelineEvents?: UnifiedTimelineEvent[];
}

function StepStatusText({
  active,
  done,
  labelFr,
  labelEn,
  t,
}: {
  active: boolean;
  done?: boolean;
  labelFr: string;
  labelEn: string;
  t: (fr: string, en: string) => string;
}) {
  const status = done
    ? t('Terminé', 'Done')
    : active
      ? t('En cours', 'Active')
      : t('À venir', 'Upcoming');
  return (
    <span className="text-[10px] font-mono uppercase tracking-widest text-[#142c6a]">
      {t(labelFr, labelEn)} — {status}
    </span>
  );
}

export function IntelligenceChronologie(props: IntelligenceChronologieProps) {
  if (props.mode === 'communications-only') {
    return (
      <CommunicationTimelineFeed
        events={props.timelineEvents ?? []}
        titleFr="Historique des communications"
        titleEn="Communication history"
        emptyFr="Aucun courriel Nylas ni appel Vertex rattaché à ce contact pour le moment."
        emptyEn="No Nylas emails or Vertex calls linked to this contact yet."
      />
    );
  }
  if (!props.residence) return null;
  return <IntelligenceChronologieResidence {...props} residence={props.residence} />;
}

function IntelligenceChronologieResidence({
  residence,
  calls = [],
  mails = [],
  timelineEvents = [],
}: IntelligenceChronologieProps & { residence: Residence }) {
  const { t, language } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  const { profile } = useAuth();

  const [residenceDoc, setResidenceDoc] = useState<Record<string, unknown> | null>(null);
  const [relanceText, setRelanceText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const residenceLabel = residence.city
    ? `${residence.address}, ${residence.city}`
    : residence.address;

  useEffect(() => {
    let cancelled = false;
    void fetchResidenceDoc(residence.id).then((doc) => {
      if (!cancelled) setResidenceDoc(doc);
    });
    return () => {
      cancelled = true;
    };
  }, [residence.id]);

  const velocityMails = useMemo((): VelocityMailInput[] => {
    return mails
      .filter((m) => m.matchedResidenceId === residence.id)
      .map((m) => ({
        messageId: m.messageId,
        analyzedAtMillis: m.analyzedAtMillis,
        contactName: m.mergedParse.lead.contactName,
        contactEmail: m.mergedParse.lead.email,
        intent: m.mergedParse.lead.intent,
        summaryOneLine: m.mergedParse.summaryOneLine,
      }));
  }, [mails, residence.id]);

  const velocityCalls = useMemo((): VelocityCallInput[] => {
    return calls
      .filter((c) => c.residenceId === residence.id)
      .map((c) => ({
        driveDocumentId: c.driveDocumentId,
        updatedAtMillis: c.updatedAtMillis,
        executiveSummary: c.executiveSummary,
        keyPoints: c.keyPoints,
        actionItems: c.actionItems,
      }));
  }, [calls, residence.id]);

  const velocity = useMemo(
    () =>
      computeTransactionVelocity({
        residenceDoc,
        mails: velocityMails,
        calls: velocityCalls,
        lang,
      }),
    [residenceDoc, velocityMails, velocityCalls, lang]
  );

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
      checkBuyerRelanceSendReadiness({
        account: defaultAccount,
        buyerEmail: velocity.activeBuyer?.email ?? null,
      }),
    [defaultAccount, velocity.activeBuyer?.email]
  );

  const baselineLabel = useMemo(() => {
    if (!velocity.baseline.releaseAtMillis) return null;
    return new Date(velocity.baseline.releaseAtMillis).toLocaleDateString(locale, {
      dateStyle: 'medium',
    });
  }, [velocity.baseline.releaseAtMillis, locale]);

  const handleDraftRelance = useCallback(() => {
    setRelanceText(velocity.relanceJ5Text);
    setError(null);
    setSuccess(null);
  }, [velocity.relanceJ5Text]);

  const handleSendRelance = useCallback(async () => {
    const body = relanceText.trim() || velocity.relanceJ5Text;
    if (!body) return;
    if (!sendReadiness.ready || !defaultAccount || !velocity.activeBuyer?.email) {
      setError(sendReadiness.errors.join(' '));
      return;
    }
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      await deliverBuyerRelanceEmail({
        residenceId: residence.id,
        residenceLabel,
        body,
        buyerEmail: velocity.activeBuyer.email,
        buyerName: velocity.activeBuyer.maskedFirstName,
        account: defaultAccount,
      });
      setSuccess(t('Relance envoyée par Nylas.', 'Follow-up sent via Nylas.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }, [
    relanceText,
    velocity.relanceJ5Text,
    velocity.activeBuyer,
    sendReadiness,
    defaultAccount,
    residence.id,
    residenceLabel,
    t,
  ]);

  const nylasOn = isNylasConfigured();

  return (
    <section className={cn(inst.section, 'overflow-hidden')}>
      <header className={inst.sectionHeader}>
        <h3 className={inst.sectionTitle}>
          {t('Vélocité transactionnelle (J+7)', 'Transaction velocity (D+7)')}
        </h3>
        <p className="text-[10px] text-[#142c6a] mt-1 font-medium">
          {t(
            'Baseline = date de libération documentaire',
            'Baseline = document package release date'
          )}
          {baselineLabel ? ` · ${baselineLabel}` : ''}
          {velocity.daysSinceRelease != null
            ? ` · J+${velocity.daysSinceRelease}`
            : ''}
        </p>
      </header>

      <div className="p-5 space-y-4">
        {velocity.phase === 'pending_baseline' && (
          <p className="text-sm text-[#142c6a] leading-relaxed">
            {t(
              'Renseignez la date de libération documentaire sur la fiche (ex. dateLiberationDocuments ou buyerReleaseGate.documentReleasedAt) pour activer le protocole.',
              'Set the document release date on the listing record (e.g. dateLiberationDocuments or buyerReleaseGate.documentReleasedAt) to activate the protocol.'
            )}
          </p>
        )}

        {velocity.positionRequired && (
          <p className="text-sm font-semibold text-[#142c6a]">
            ⚠️ {t('Prise de position requise (Échéancier atteint)', 'Position required (deadline reached)')}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm text-[#142c6a]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em]">
                  {t('Étape', 'Step')}
                </th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em]">
                  {t('Fenêtre', 'Window')}
                </th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em]">
                  {t('Statut', 'Status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 font-semibold">
                  {t('A — Extraction des questions', 'A — Question extraction')}
                </td>
                <td className="px-4 py-3 text-[#142c6a]">J+3 → J+4</td>
                <td className="px-4 py-3">
                  <StepStatusText
                    active={velocity.stepAActive}
                    done={
                      velocity.daysSinceRelease != null &&
                      velocity.daysSinceRelease > 4 &&
                      velocity.extractedQuestions.length > 0
                    }
                    labelFr="Extraction"
                    labelEn="Extraction"
                    t={t}
                  />
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold">
                  {t('B — Relance stratégique', 'B — Strategic follow-up')}
                </td>
                <td className="px-4 py-3 text-[#142c6a]">J+5</td>
                <td className="px-4 py-3">
                  <StepStatusText
                    active={velocity.stepBActive}
                    labelFr="Relance"
                    labelEn="Follow-up"
                    t={t}
                  />
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold">
                  {t('C — Prise de position / LOI', 'C — Position / LOI')}
                </td>
                <td className="px-4 py-3 text-[#142c6a]">J+7</td>
                <td className="px-4 py-3">
                  <StepStatusText
                    active={velocity.stepCActive && !velocity.offerLogged}
                    done={velocity.offerLogged}
                    labelFr="LOI"
                    labelEn="LOI"
                    t={t}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {(velocity.stepAActive || velocity.extractedQuestions.length > 0) && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#142c6a] mb-3">
              {t('Questions regroupées (prénom seul)', 'Grouped questions (first name only)')}
            </p>
            {velocity.extractedQuestions.length === 0 ? (
              <p className="text-sm text-[#142c6a]">
                {t(
                  'Aucune demande de clarification détectée sur J+3 à J+4.',
                  'No clarification requests detected on D+3 to D+4.'
                )}
              </p>
            ) : (
              <ul className="space-y-2">
                {velocity.extractedQuestions.map((q) => (
                  <li
                    key={q.id}
                    className="border-t border-slate-100 pt-2 first:border-0 first:pt-0"
                  >
                    <p className="text-[10px] font-mono text-[#142c6a]">
                      {q.maskedFirstName} ·{' '}
                      {new Date(q.atMillis).toLocaleDateString(locale)}
                    </p>
                    <p className="text-sm text-[#142c6a] leading-relaxed mt-0.5">
                      {q.questionLine}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {((velocity.daysSinceRelease ?? 0) >= 5 && !velocity.offerLogged) ||
        relanceText ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#142c6a]">
              {t('Relance J+5', 'D+5 follow-up')}
            </p>
            {!nylasOn && (
              <p className="text-sm text-[#142c6a]">
                {t(
                  'Nylas désactivé — activez VITE_NYLAS_ENABLED=true pour l’envoi.',
                  'Nylas disabled — set VITE_NYLAS_ENABLED=true to send.'
                )}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDraftRelance}
                disabled={(velocity.daysSinceRelease ?? 0) < 5}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em]',
                  'bg-[#142c6a] text-white hover:bg-[#0f1f4d] disabled:opacity-40 transition'
                )}
              >
                <PenLine className="h-3.5 w-3.5" />
                {t('Rédiger relance J-5', 'Draft D+5 follow-up')}
              </button>
            </div>
            <textarea
              value={relanceText}
              onChange={(e) => setRelanceText(e.target.value)}
              placeholder={RELANCE_J5_TEMPLATE_FR}
              rows={5}
              className={cn(
                'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed',
                'text-[#142c6a] resize-y min-h-[120px]',
                'focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300'
              )}
              aria-label={t('Texte relance J+5', 'D+5 follow-up text')}
            />
            <button
              type="button"
              onClick={() => void handleSendRelance()}
              disabled={
                sending ||
                !sendReadiness.ready ||
                (!relanceText.trim() && !velocity.relanceJ5Text)
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#142c6a] hover:border-slate-400 disabled:opacity-40 transition"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              {t('Envoyer via Nylas', 'Send via Nylas')}
            </button>
          </div>
        ) : null}

        {velocity.stepCActive && !velocity.offerLogged && (
          <p className="text-sm text-[#142c6a] leading-relaxed">
            {t(
              'Échéancier J+7 atteint : enregistrez une offre ou une LOI au dossier (offreLoguee) pour lever l’alerte.',
              'D+7 deadline reached: log an offer or LOI on file (offreLoguee) to clear the alert.'
            )}
          </p>
        )}

        {error && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#142c6a]">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#142c6a]">
            {success}
          </p>
        )}

        <CommunicationTimelineFeed
          events={timelineEvents}
          titleFr="Historique des communications (dossier et intervenants)"
          titleEn="Communication history (listing and parties)"
          emptyFr="Aucun courriel Nylas ni appel Vertex pour ce dossier ou ses intervenants pour le moment."
          emptyEn="No Nylas emails or Vertex calls for this listing or its parties yet."
          className="border-0 shadow-none mt-2"
        />
      </div>
    </section>
  );
}
