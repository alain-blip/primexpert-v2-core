import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mail,
  Search,
  Star,
  Trash2,
  Archive,
  Send,
  Paperclip,
  ChevronLeft,
  Inbox,
  Sparkles,
  UserPlus,
  Loader2,
  Copy,
  Check,
  Home,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useWorkhubNav } from '../lib/workhubNav';
import { appendCrmInboundDraft } from '../lib/crmInboundQueue';
import { listResidences, type Residence } from '../services/residences';
import {
  buildMailParseResult,
  safeNormalizeAiMailParse,
  type InventoryResidenceRef,
  type MailParseResult,
} from '@primexpert/core/mail';
import {
  analyzeMailboxMessageForLeads,
  generateMailboxReplyDraft,
} from '../services/gemini';
import { getMailboxAnalysis, saveMailboxAnalysis } from '../services/mailboxAnalysis';
import {
  buildSoftFollowUpParagraph,
  shouldSuggestDraftFollowUp,
} from '../services/followUpIntel';
import { useSilo } from '../context/SiloContext';

type IaStatus = 'idle' | 'loading' | 'done' | 'error';

interface InboxMessage {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  fullBody: string;
  time: string;
  isRead: boolean;
  category: 'transaction' | 'system' | 'client';
  initials: string;
  iaStatus?: IaStatus;
  mergedParse?: MailParseResult;
  replyDraft?: string;
  /** Horodatage du brouillon IA (E-4 relance douce). */
  replyDraftAtMillis?: number;
}

const INITIAL_MESSAGES: InboxMessage[] = [
  {
    id: '1',
    sender: 'OACIQ - Direction',
    subject: '[URGENT] Mise à jour des clauses types - Mai 2026',
    preview:
      'Bonjour, veuillez prendre note des modifications apportées à la clause 3.4 du mandat exclusif...',
    fullBody: `Bonjour,

Veuillez prendre note des modifications apportées à la clause 3.4 du mandat exclusif, applicables à compter du prochain trimestre.

Cette mise à jour est prioritaire pour rester en conformité avec les exigences du règlement intérieur.

Pour toute question, contactez votre chargé de dossier.

Cordialement,
Direction OACIQ`,
    time: '10:42',
    isRead: false,
    category: 'system',
    initials: 'OA',
    iaStatus: 'idle',
  },
  {
    id: '2',
    sender: 'Mathieu Tremblay',
    subject: "Offre d'achat - 4522 Rue de la Roche",
    preview:
      "Suite à l'ACM générée hier, mes clients sont prêts à soumettre une promesse d'achat à 845k...",
    fullBody: `Bonjour,

Suite à l'ACM générée hier, mes clients sont prêts à soumettre une promesse d'achat à 845 000 $ pour la propriété située au 4522 rue de la Roche, Montréal.

Nous restons disponibles pour ajuster les conditions si besoin.

Merci,
Mathieu Tremblay
Courtier immobilier
mathieu.t@agence.ca`,
    time: 'Hier',
    isRead: true,
    category: 'transaction',
    initials: 'MT',
    iaStatus: 'idle',
  },
  {
    id: '3',
    sender: 'Julie Dupuis (formulaire web)',
    subject: 'Demande de visite — condo Ahuntsic',
    preview: 'Bonjour, je souhaite visiter un bien que vous affichez sur Centris...',
    fullBody: `Bonjour,

Je m'appelle Julie Dupuis et je souhaite visiter le condo que vous listez au 4522 rue de la Roche, Montréal.

Mon téléphone : 514-555-8899
Courriel : julie.dupuis@email.com

Je suis disponible en soirée cette semaine.

Merci beaucoup,
Julie`,
    time: '09:15',
    isRead: false,
    category: 'client',
    initials: 'JD',
    iaStatus: 'idle',
  },
];

function intentLabel(
  i: MailParseResult['lead']['intent'],
  t: (fr: string, en: string) => string
): string {
  const m: Record<MailParseResult['lead']['intent'], [string, string]> = {
    buyer: ['Client potentiel', 'Buyer prospect'],
    seller: ['Vendeur potentiel', 'Seller lead'],
    peer: ['Courtier / collègue', 'Peer broker'],
    agency: ['Service / portail', 'Service / portal'],
    unknown: ['À qualifier', 'To qualify'],
  };
  const pair = m[i] ?? m.unknown;
  return t(pair[0], pair[1]);
}

function urgencyBadge(
  u: MailParseResult['urgency'],
  t: (fr: string, en: string) => string
) {
  const meta = {
    low: {
      label: t('Priorité basse', 'Low priority'),
      className: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
    },
    medium: {
      label: t('Priorité moyenne', 'Medium priority'),
      className: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    },
    high: {
      label: t('Priorité haute', 'High priority'),
      className: 'bg-red-500/15 text-red-300 border-red-400/30',
    },
  }[u];
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest',
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}

export function Mailbox() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const { activeSilo } = useSilo();
  const brokerId = profile?.uid;
  const workhubNav = useWorkhubNav();

  const [messages, setMessages] = useState<InboxMessage[]>(INITIAL_MESSAGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryResidenceRef[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [copyDraftOk, setCopyDraftOk] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);

  useEffect(() => {
    if (!brokerId) return;
    let cancelled = false;
    listResidences({ tenantId: brokerId, mode: 'strict' }, { silo: activeSilo }).then((rows) => {
      if (cancelled) return;
      setInventory(
        rows.map((r: Residence) => ({
          id: r.id,
          address: r.address,
          city: r.city,
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [brokerId, activeSilo]);

  // Hydrate depuis Firestore : analyses déjà calculées (pas de second passage Gemini).
  useEffect(() => {
    if (!brokerId) return;
    let cancelled = false;
    const ids = INITIAL_MESSAGES.map((m) => m.id);
    (async () => {
      const results = await Promise.all(ids.map((id) => getMailboxAnalysis(brokerId, id)));
      if (cancelled) return;
      const byId = new Map(ids.map((id, i) => [id, results[i]] as const));
      setMessages((prev) =>
        prev.map((m) => {
          const doc = byId.get(m.id);
          if (!doc?.mergedParse) return m;
          return {
            ...m,
            iaStatus: 'done',
            mergedParse: doc.mergedParse,
            replyDraft: doc.replyDraft ?? undefined,
            replyDraftAtMillis: doc.replyDraftAtMillis,
            isRead: true,
          };
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [brokerId]);

  const selectedMessage = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId]
  );

  const suggestDraftFollowUp = useMemo(() => {
    if (!selectedMessage) return false;
    return shouldSuggestDraftFollowUp(
      selectedMessage.replyDraft,
      selectedMessage.replyDraftAtMillis
    );
  }, [selectedMessage]);

  const hasGeminiKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY);

  const patchMessage = useCallback((id: string, patch: Partial<InboxMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const handleRunIaAnalysis = async () => {
    if (!selectedMessage) return;
    const id = selectedMessage.id;
    setIaError(null);

    if (brokerId) {
      try {
        const cached = await getMailboxAnalysis(brokerId, id);
        if (cached?.mergedParse) {
          patchMessage(id, {
            iaStatus: 'done',
            mergedParse: cached.mergedParse,
            replyDraft: cached.replyDraft ?? undefined,
            replyDraftAtMillis: cached.replyDraftAtMillis,
            isRead: true,
          });
          return;
        }
      } catch (e) {
        console.error('[Mailbox] load cached analysis failed', e);
      }
    }

    patchMessage(id, { iaStatus: 'loading' });

    try {
      const rawAi = hasGeminiKey
        ? await analyzeMailboxMessageForLeads({
            subject: selectedMessage.subject,
            body: selectedMessage.fullBody,
            sender: selectedMessage.sender,
            inventory,
            language,
          })
        : {};

      const aiNorm = safeNormalizeAiMailParse(rawAi);
      const merged = buildMailParseResult(selectedMessage.fullBody, {
        subject: selectedMessage.subject,
        sender: selectedMessage.sender,
        residences: inventory,
        aiPartial: aiNorm,
      });

      patchMessage(id, {
        iaStatus: 'done',
        mergedParse: merged,
        isRead: true,
      });

      if (brokerId) {
        try {
          await saveMailboxAnalysis(brokerId, id, {
            mergedParse: merged,
            replyDraft: selectedMessage.replyDraft ?? null,
          });
        } catch (persistErr) {
          console.error('[Mailbox] persist analysis failed', persistErr);
        }
      }
    } catch (e) {
      console.error('[Mailbox] analysis failed', e);
      patchMessage(id, { iaStatus: 'error' });
      setIaError(
        t(
          'Analyse interrompue. Réessaie ou vérifie la connexion.',
          'Analysis failed. Retry or check your connection.'
        )
      );
    }
  };

  const handleGenerateDraft = async () => {
    if (!selectedMessage?.mergedParse) return;
    setDraftLoading(true);
    setCopyDraftOk(false);
    try {
      const text = hasGeminiKey
        ? await generateMailboxReplyDraft({
            parse: selectedMessage.mergedParse,
            subject: selectedMessage.subject,
            sender: selectedMessage.sender,
            language,
          })
        : '';

      if (!text.trim()) {
        setIaError(
          t(
            'Impossible de générer le brouillon (Gemini indisponible ou clé absente).',
            'Could not generate draft (Gemini unavailable or missing key).'
          )
        );
        patchMessage(selectedMessage.id, { replyDraft: '' });
        return;
      }
      patchMessage(selectedMessage.id, { replyDraft: text, replyDraftAtMillis: Date.now() });
      if (brokerId) {
        try {
          await saveMailboxAnalysis(brokerId, selectedMessage.id, {
            mergedParse: selectedMessage.mergedParse,
            replyDraft: text,
          });
        } catch (persistErr) {
          console.error('[Mailbox] persist draft failed', persistErr);
        }
      }
    } finally {
      setDraftLoading(false);
    }
  };

  const handleCopyDraft = async () => {
    if (!selectedMessage?.replyDraft) return;
    await navigator.clipboard.writeText(selectedMessage.replyDraft);
    setCopyDraftOk(true);
    setTimeout(() => setCopyDraftOk(false), 2000);
  };

  const handleInsertSoftFollowUp = async () => {
    if (!selectedMessage?.mergedParse) return;
    const id = selectedMessage.id;
    const para = buildSoftFollowUpParagraph(
      selectedMessage.mergedParse.lead.contactName,
      language
    );
    const next = selectedMessage.replyDraft?.trim()
      ? `${para}\n\n${selectedMessage.replyDraft.trim()}`
      : para;
    const at = Date.now();
    patchMessage(id, { replyDraft: next, replyDraftAtMillis: at });
    if (brokerId) {
      try {
        await saveMailboxAnalysis(brokerId, id, {
          mergedParse: selectedMessage.mergedParse,
          replyDraft: next,
          replyDraftAtMillis: at,
        });
      } catch (e) {
        console.error('[Mailbox] persist soft follow-up failed', e);
      }
    }
  };

  const handleCreateCrm = () => {
    if (!selectedMessage?.mergedParse) return;
    const { lead, residence, summaryOneLine } = selectedMessage.mergedParse;
    const name =
      lead.contactName?.trim() ||
      selectedMessage.sender.split(/[<(]/)[0]?.trim() ||
      t('Contact inconnu', 'Unknown contact');
    const email = lead.email ?? '';
    const phone = lead.phone ?? '';
    if (!email && !phone) {
      setIaError(
        t(
          'Ajoutez au moins un courriel ou un téléphone avant de créer la fiche.',
          'Add at least an email or phone before creating the record.'
        )
      );
      return;
    }

    appendCrmInboundDraft({
      name,
      email: email || t('à compléter', 'to complete'),
      phone: phone || t('à compléter', 'to complete'),
      type: intentLabel(lead.intent, t),
      status: t('Nouveau', 'New'),
      notes: [
        summaryOneLine,
        residence.matchedResidenceId
          ? `Résidence ID: ${residence.matchedResidenceId}`
          : residence.mentionedAddress ?? '',
        `Source message: ${selectedMessage.id}`,
        `Cockpit silo: ${activeSilo}`,
      ]
        .filter(Boolean)
        .join(' · '),
      sourceMessageId: selectedMessage.id,
      investorProfiles: [activeSilo],
      contactSiloScope: activeSilo,
    });

    workhubNav?.setActiveTab('crm');
  };

  return (
    <div className="h-[calc(100vh-160px)] flex bg-vault-bright rounded-[32px] border border-white/10 shadow-sm overflow-hidden">
      {/* Sidebar List */}
      <div
        className={cn(
          'w-full lg:w-[400px] border-r border-white/10 flex flex-col',
          selectedId && 'hidden lg:flex'
        )}
      >
        <div className="p-6 border-b border-white/10 bg-white/[0.03]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase">
              {t('MESSAGERIE', 'INBOX')}
              <span className="text-blue-400">{t(' SYNCHRONISÉE', '_SYNC')}</span>
            </h2>
            <button
              type="button"
              className="p-2 bg-blue-500 text-white rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all"
              aria-label={t('Composer', 'Compose')}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('RECHERCHER_ARCHIVES', 'SEARCH_ARCHIVES')}
              className="w-full bg-vault border border-white/10 rounded-xl py-2 pl-10 pr-4 text-[10px] font-black uppercase tracking-widest focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-300"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedId(msg.id);
                setIaError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedId(msg.id);
                  setIaError(null);
                }
              }}
              className={cn(
                'p-6 cursor-pointer transition-all hover:bg-blue-500/10 group relative',
                selectedId === msg.id && 'bg-blue-500/10',
                !msg.isRead && 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-blue-600'
              )}
            >
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-white/[0.04] rounded flex items-center justify-center text-[10px] font-black italic text-slate-400 group-hover:bg-blue-900 group-hover:text-blue-200 transition-colors shrink-0">
                    {msg.initials}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-black uppercase tracking-tighter truncate',
                      !msg.isRead ? 'text-slate-200' : 'text-slate-400'
                    )}
                  >
                    {msg.sender}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[9px] font-black font-mono text-slate-400">{msg.time}</span>
                  {!msg.isRead && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest',
                        msg.iaStatus === 'done'
                          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                          : msg.iaStatus === 'loading'
                            ? 'border-blue-400/40 bg-blue-500/15 text-blue-200'
                            : 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                      )}
                    >
                      <Sparkles className="w-3 h-3" />
                      {msg.iaStatus === 'done'
                        ? t('IA ✓', 'AI ✓')
                        : t('IA Analysis', 'AI Analysis')}
                    </span>
                  )}
                </div>
              </div>
              <h4
                className={cn(
                  'text-sm font-black italic tracking-tighter mb-1',
                  !msg.isRead ? 'text-blue-300' : 'text-slate-300'
                )}
              >
                {msg.subject}
              </h4>
              <p className="text-[10px] text-slate-400 line-clamp-1 font-medium">{msg.preview}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detail View */}
      <div
        className={cn('flex-1 flex flex-col bg-vault', !selectedId && 'hidden lg:flex')}
      >
        <AnimatePresence mode="wait">
          {selectedMessage ? (
            <motion.div
              key={selectedMessage.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex flex-col"
            >
              <div className="px-6 py-4 border-b border-white/10 flex flex-wrap gap-3 justify-between items-center bg-white/[0.03]">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="lg:hidden p-2 hover:bg-white/[0.04] rounded-lg"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="p-2 hover:bg-vault hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-blue-400 border border-transparent hover:border-white/10"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="p-2 hover:bg-vault hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-red-500 border border-transparent hover:border-white/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunIaAnalysis}
                    disabled={selectedMessage.iaStatus === 'loading'}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/90 text-white text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition"
                  >
                    {selectedMessage.iaStatus === 'loading' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {t('Analyser avec l’IA', 'Run AI analysis')}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateDraft}
                    disabled={!selectedMessage.mergedParse || draftLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 bg-white/[0.06] text-[9px] font-black uppercase tracking-widest text-slate-200 hover:bg-white/10 disabled:opacity-40 transition"
                  >
                    {draftLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                    {t('Brouillon réponse IA', 'AI reply draft')}
                  </button>
                  <button
                    type="button"
                    disabled={!selectedMessage.mergedParse}
                    onClick={handleCreateCrm}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-500 disabled:opacity-40 transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {t('Créer une fiche CRM', 'Create CRM record')}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-xl hover:bg-blue-600 transition"
                  >
                    {t('RÉPONDRE', 'REPLY')}
                  </button>
                </div>
              </div>

              {iaError && (
                <div className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{iaError}</span>
                </div>
              )}

              {!hasGeminiKey && (
                <p className="mx-6 mt-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {t(
                    'Sans VITE_GEMINI_API_KEY : heuristiques locales + correspondance sur tes inscriptions uniquement.',
                    'Without VITE_GEMINI_API_KEY: local heuristics + your listings matching only.'
                  )}
                </p>
              )}

              <div className="flex-1 overflow-y-auto p-6 lg:p-10">
                <div className="max-w-3xl mx-auto space-y-8">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-blue-900/80 text-blue-200 rounded-xl flex items-center justify-center text-xl font-black italic shadow-lg border border-white/10">
                      {selectedMessage.initials}
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter text-slate-200 uppercase">
                        {selectedMessage.sender}
                      </h2>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mt-1">
                        {selectedMessage.time} • {t('VIA PRIMEXPERT_NET', 'VIA PRIMEXPERT_NET')}
                      </p>
                    </div>
                  </div>

                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-200 border-l-4 border-blue-600 pl-4 py-1">
                    {selectedMessage.subject}
                  </h1>

                  {selectedMessage.mergedParse && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-300/90 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          {t('Triage IA (client potentiel + résidence)', 'AI triage (lead + property)')}
                        </p>
                        {urgencyBadge(selectedMessage.mergedParse.urgency, t)}
                      </div>
                      <p className="text-[12px] text-slate-300 leading-relaxed">
                        {selectedMessage.mergedParse.summaryOneLine}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/10 bg-vault px-4 py-3">
                          <p className="text-[9px] font-black uppercase text-slate-500 mb-1">
                            {t('Contact', 'Contact')}
                          </p>
                          <p className="text-sm font-bold text-slate-200">
                            {selectedMessage.mergedParse.lead.contactName ?? '—'}
                          </p>
                          <p className="text-[11px] font-mono text-blue-300 mt-1">
                            {selectedMessage.mergedParse.lead.phone ?? '—'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 break-all">
                            {selectedMessage.mergedParse.lead.email ?? '—'}
                          </p>
                          <p className="text-[9px] font-black uppercase text-blue-400/80 mt-2">
                            {intentLabel(selectedMessage.mergedParse.lead.intent, t)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-vault px-4 py-3">
                          <p className="text-[9px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
                            <Home className="w-3 h-3" />
                            {t('Résidence (mes inscriptions)', 'Property (my listings)')}
                          </p>
                          <p className="text-sm font-bold text-slate-200">
                            {selectedMessage.mergedParse.residence.mentionedAddress ??
                              t('Non identifiée', 'Not identified')}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-2 font-mono">
                            ID: {selectedMessage.mergedParse.residence.matchedResidenceId ?? '—'} ·{' '}
                            {selectedMessage.mergedParse.residence.matchConfidence}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedMessage.replyDraft && (
                    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-5 space-y-3">
                      {suggestDraftFollowUp && (
                        <div className="flex flex-col gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-[10px] font-bold text-sky-100 leading-snug">
                            {t(
                              'Magic follow-up : ce brouillon date de plus de 24 h — une relance douce peut aider.',
                              'Magic follow-up: this draft is older than 24 hours — a gentle nudge may help.'
                            )}
                          </p>
                          <button
                            type="button"
                            onClick={handleInsertSoftFollowUp}
                            className="shrink-0 rounded-lg border border-sky-400/40 bg-sky-600/80 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white hover:bg-sky-500 transition"
                          >
                            {t('Insérer relance douce', 'Insert soft follow-up')}
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                          {t('Brouillon de réponse (IA)', 'AI reply draft')}
                        </p>
                        <button
                          type="button"
                          onClick={handleCopyDraft}
                          className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-200 hover:text-white transition"
                        >
                          {copyDraftOk ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copyDraftOk ? t('Copié', 'Copied') : t('Copier', 'Copy')}
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-200 font-sans">
                        {selectedMessage.replyDraft}
                      </pre>
                    </div>
                  )}

                  <div className="prose prose-invert max-w-none text-slate-300 font-medium leading-relaxed">
                    <p className="whitespace-pre-wrap">{selectedMessage.fullBody}</p>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-xl border border-white/10 border-dashed">
                      <div className="p-3 bg-vault rounded-lg shadow-sm">
                        <Paperclip className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-tight text-slate-300 italic">
                          Mise_a_Jour_OACIQ_2026.pdf
                        </p>
                        <p className="text-[9px] font-bold text-slate-500">PDF · 2.4 MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-10">
              <Inbox className="w-32 h-32 text-slate-400 mb-6" />
              <h3 className="text-4xl font-black italic tracking-tighter uppercase grayscale">
                {t('Sélectionnez un message', 'Select a message')}
              </h3>
              <p className="text-[10px] font-black uppercase tracking-widest mt-2">
                {t('Mode sécurisé chiffré activé', 'Encrypted secure mode')}
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
