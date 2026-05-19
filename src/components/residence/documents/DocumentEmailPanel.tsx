import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Mail, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../lib/auth';
import {
  buildDocumentEmailTemplate,
  type DocumentEmailTargetRole,
} from '../../../lib/documentEmailTemplates';
import {
  resolveDefaultEmailAccount,
  resolveEmailAccountsFromProfile,
} from '../../../lib/emailAccounts';
import { isNylasConfigured, sendDocumentSelectionViaNylas } from '../../../services/nylasClient';

export interface DocumentEmailPanelProps {
  open: boolean;
  onClose: () => void;
  locale: 'fr' | 'en';
  documentIds: string[];
  propertyId?: string;
  contactId?: string;
  contextLabel?: string;
  onSent?: () => void;
}

const ROLE_OPTIONS: Array<{
  id: DocumentEmailTargetRole;
  labelFr: string;
  labelEn: string;
}> = [
  { id: 'buyer', labelFr: 'Acheteur', labelEn: 'Buyer' },
  { id: 'notary', labelFr: 'Notaire', labelEn: 'Notary' },
  { id: 'banker', labelFr: 'Institution financière', labelEn: 'Lender' },
  { id: 'custom', labelFr: 'Autre destinataire', labelEn: 'Other recipient' },
];

export function DocumentEmailPanel({
  open,
  onClose,
  locale,
  documentIds,
  propertyId,
  contactId,
  contextLabel,
  onSent,
}: DocumentEmailPanelProps) {
  const { profile } = useAuth();
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
  const connectedAccounts = useMemo(
    () => emailAccounts.filter((a) => Boolean(a.nylasGrantId)),
    [emailAccounts]
  );

  const [targetRole, setTargetRole] = useState<DocumentEmailTargetRole>('notary');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [accountId, setAccountId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const applyTemplate = useCallback(
    (role: DocumentEmailTargetRole) => {
      const tpl = buildDocumentEmailTemplate(role, locale, contextLabel);
      setSubject(tpl.subject);
      setMessage(tpl.message);
    },
    [contextLabel, locale]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(null);
    setRecipientEmail('');
    setTargetRole('notary');
    applyTemplate('notary');
    setAccountId(defaultAccount?.id ?? connectedAccounts[0]?.id ?? '');
  }, [open, applyTemplate, defaultAccount?.id, connectedAccounts]);

  useEffect(() => {
    if (!open) return;
    applyTemplate(targetRole);
  }, [targetRole, open, applyTemplate]);

  if (!open) return null;

  const handleSend = async () => {
    setError(null);
    setSuccess(null);
    const email = recipientEmail.trim();
    if (!email.includes('@')) {
      setError(
        locale === 'fr'
          ? 'Indiquez une adresse courriel valide pour le destinataire.'
          : 'Enter a valid recipient email address.'
      );
      return;
    }
    if (!subject.trim() || !message.trim()) {
      setError(
        locale === 'fr' ? 'Le sujet et le message sont requis.' : 'Subject and message are required.'
      );
      return;
    }
    if (!documentIds.length) {
      setError(locale === 'fr' ? 'Aucun document sélectionné.' : 'No documents selected.');
      return;
    }
    if (!nylasOn) {
      setError(
        locale === 'fr'
          ? 'Prime-Mail n’est pas activé dans cet environnement.'
          : 'Prime-Mail is not enabled in this environment.'
      );
      return;
    }
    const accId = accountId || defaultAccount?.id;
    if (!accId || !connectedAccounts.some((a) => a.id === accId)) {
      setError(
        locale === 'fr'
          ? 'Connectez une boîte courriel dans Paramètres (Nylas) avant l’envoi.'
          : 'Connect an email account in Settings (Nylas) before sending.'
      );
      return;
    }

    setSending(true);
    try {
      const result = await sendDocumentSelectionViaNylas({
        documentIds,
        targetRole,
        recipientEmail: email,
        subject: subject.trim(),
        message: message.trim(),
        accountId: accId,
        propertyId,
        contactId,
      });
      setSuccess(
        locale === 'fr'
          ? `Courriel transmis — ${result.sentCount} document(s) via Prime-Mail.`
          : `Email sent — ${result.sentCount} document(s) via Prime-Mail.`
      );
      onSent?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || (locale === 'fr' ? 'Échec de l’envoi.' : 'Send failed.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <motionlessOverlay onClose={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-950 shadow-2xl ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <motionlessHeader locale={locale} documentCount={documentIds.length} />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label={locale === 'fr' ? 'Fermer' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <fieldset>
            <legend className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
              {locale === 'fr' ? 'Profil destinataire' : 'Recipient profile'}
            </legend>
            <motionlessRoleGrid
              locale={locale}
              targetRole={targetRole}
              onSelect={setTargetRole}
            />
          </fieldset>

          {connectedAccounts.length > 1 ? (
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                {locale === 'fr' ? 'Boîte d’expédition' : 'From account'}
              </span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-[12px] font-semibold text-white"
              >
                {connectedAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.emailAddress}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              {locale === 'fr' ? 'Courriel destinataire' : 'Recipient email'}
            </span>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder={locale === 'fr' ? 'nom@cabinet.ca' : 'name@firm.com'}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-[12px] text-white placeholder:text-slate-600 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              {locale === 'fr' ? 'Objet' : 'Subject'}
            </span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-[12px] font-semibold text-white focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              {locale === 'fr' ? 'Message' : 'Message'}
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={7}
              className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-[12px] leading-relaxed text-slate-100 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{success}</span>
            </p>
          ) : null}

          {sending ? <SendProgress locale={locale} /> : null}

          <motionlessActions
            locale={locale}
            sending={sending}
            success={Boolean(success)}
            onClose={onClose}
            onSend={() => void handleSend()}
          />
        </div>
      </div>
    </motionlessOverlay>
  );
}

function motionlessOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-email-panel-title"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function motionlessHeader({
  locale,
  documentCount,
}: {
  locale: 'fr' | 'en';
  documentCount: number;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/90">
        Prime-Mail
      </p>
      <h2 id="document-email-panel-title" className="mt-1 text-[15px] font-black text-white">
        {locale === 'fr' ? 'Transmission sécurisée' : 'Secure transmission'}
      </h2>
      <p className="mt-1 text-[11px] text-slate-400">
        {locale === 'fr'
          ? `${documentCount} pièce(s) — liens Prime-Drive dans le courriel.`
          : `${documentCount} file(s) — Prime-Drive links in the email.`}
      </p>
    </div>
  );
}

function motionlessRoleGrid({
  locale,
  targetRole,
  onSelect,
}: {
  locale: 'fr' | 'en';
  targetRole: DocumentEmailTargetRole;
  onSelect: (role: DocumentEmailTargetRole) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ROLE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onSelect(opt.id)}
          className={cn(
            'rounded-xl border px-3 py-2.5 text-left text-[11px] font-bold transition',
            targetRole === opt.id
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-100'
              : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
          )}
        >
          {locale === 'fr' ? opt.labelFr : opt.labelEn}
        </button>
      ))}
    </div>
  );
}

function SendProgress({ locale }: { locale: 'fr' | 'en' }) {
  return (
    <div className="space-y-2">
      <motionlessProgressTrack />
      <p className="text-center text-[10px] font-semibold text-slate-500">
        {locale === 'fr'
          ? 'Préparation des liens et envoi Nylas…'
          : 'Preparing links and sending via Nylas…'}
      </p>
    </div>
  );
}

function motionlessProgressTrack() {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-slate-800">
      <div className="h-full w-1/3 animate-pulse rounded-full bg-amber-500/80" />
    </div>
  );
}

function motionlessActions({
  locale,
  sending,
  success,
  onClose,
  onSend,
}: {
  locale: 'fr' | 'en';
  sending: boolean;
  success: boolean;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="button"
        onClick={onClose}
        disabled={sending}
        className="flex-1 rounded-xl border border-slate-700 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-300 disabled:opacity-40"
      >
        {locale === 'fr' ? 'Fermer' : 'Close'}
      </button>
      <button
        type="button"
        onClick={onSend}
        disabled={sending || success}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-950 disabled:opacity-40"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {locale === 'fr' ? '[ Envoyer via Prime-Mail ]' : '[ Send via Prime-Mail ]'}
      </button>
    </div>
  );
}
