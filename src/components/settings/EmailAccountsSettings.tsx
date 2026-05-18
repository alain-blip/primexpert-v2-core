import React, { useEffect, useState } from 'react';
import { Loader2, Mail, Plug, Plus, Star, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import {
  createEmailAccountId,
  providerLabel,
  resolveEmailAccountsFromProfile,
  setDefaultAccount,
  syncStatusLabel,
} from '../../lib/emailAccounts';
import { saveUserEmailAccounts } from '../../services/emailAccountService';
import { fetchNylasAuthUrl, isNylasConfigured } from '../../services/nylasClient';
import type { EmailAccountConfig, EmailAccountProvider } from '../../types/emailAccount';

export function EmailAccountsSettings() {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const { profile, refreshProfile } = useAuth();

  const [accounts, setAccounts] = useState<EmailAccountConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newProvider, setNewProvider] = useState<EmailAccountProvider>('gmail');
  const [nylasNotice, setNylasNotice] = useState<string | null>(null);
  const nylasOn = isNylasConfigured();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('nylas') === 'connected') {
      setNylasNotice(
        t('Boîte reliée à Nylas — synchronisation active.', 'Mailbox linked to Nylas — sync active.')
      );
      params.delete('nylas');
      params.delete('accountId');
      const qs = params.toString();
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${qs ? `?${qs}` : ''}`
      );
      void refreshProfile();
    } else if (params.get('nylas') === 'error') {
      setError(params.get('msg') || t('Connexion Nylas annulée.', 'Nylas connection cancelled.'));
      params.delete('nylas');
      params.delete('msg');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [t, refreshProfile]);

  useEffect(() => {
    setAccounts(
      resolveEmailAccountsFromProfile({
        emailAccounts: profile?.emailAccounts,
        email: profile?.email,
        displayName: profile?.displayName,
      })
    );
  }, [profile?.emailAccounts, profile?.email, profile?.displayName]);

  const persist = async (next: EmailAccountConfig[]) => {
    if (!profile?.uid) return;
    setSaving(true);
    setError(null);
    try {
      await saveUserEmailAccounts(profile.uid, next);
      setAccounts(next);
      await refreshProfile();
    } catch (e) {
      console.error('[EmailAccountsSettings] save failed', e);
      setError(t('Enregistrement impossible.', 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddAccount = async () => {
    const emailAddress = newEmail.trim();
    const label = newLabel.trim() || emailAddress;
    if (!emailAddress) {
      setError(t('Adresse courriel requise.', 'Email address is required.'));
      return;
    }
    const entry: EmailAccountConfig = {
      id: createEmailAccountId(),
      emailAddress,
      label,
      isDefault: accounts.length === 0,
      syncStatus: 'connected',
      provider: newProvider,
    };
    const next = accounts.length === 0 ? [entry] : [...accounts, entry];
    await persist(next);
    setNewLabel('');
    setNewEmail('');
    setNewProvider('gmail');
  };

  const handleSetDefault = async (id: string) => {
    await persist(setDefaultAccount(accounts, id));
  };

  const handleRemove = async (id: string) => {
    const next = accounts.filter((a) => a.id !== id);
    if (!next.length) {
      setError(t('Au moins un compte est requis.', 'At least one account is required.'));
      return;
    }
    if (!next.some((a) => a.isDefault)) next[0] = { ...next[0], isDefault: true };
    await persist(next);
  };

  const hasConnected = accounts.some(
    (a) => a.syncStatus === 'connected' && (a.nylasGrantId || !nylasOn)
  );

  const handleOAuthConnect = async (provider: 'gmail' | 'outlook') => {
    if (!profile?.uid) return;
    setError(null);
    const accountId = createEmailAccountId();
    const label =
      newLabel.trim() ||
      (provider === 'gmail' ? t('Gmail', 'Gmail') : t('Outlook', 'Outlook'));
    const emailAddress = newEmail.trim() || `${label}@pending.local`;
    const entry: EmailAccountConfig = {
      id: accountId,
      emailAddress,
      label,
      isDefault: accounts.length === 0,
      syncStatus: 'syncing',
      provider,
    };
    await persist([...accounts, entry]);
    try {
      const url = await fetchNylasAuthUrl({
        accountId,
        label,
        provider,
        returnUrl: `${window.location.origin}/workhub`,
      });
      window.location.href = url;
    } catch (e) {
      console.error('[EmailAccountsSettings] OAuth', e);
      const detail =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : '';
      setError(
        detail
          ? detail
          : t('Impossible de démarrer OAuth Nylas.', 'Could not start Nylas OAuth.')
      );
    }
  };

  return (
    <div className="workhub-card-glow rounded-[28px] p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-blue-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300/80">
              {t('Communication courriel', 'Email communication')}
            </p>
          </div>
          <h3 className="workhub-title-gradient text-2xl font-black italic uppercase tracking-tighter">
            {t('Boîtes courriel synchronisées', 'Synchronized mailboxes')}
          </h3>
          <p className="mt-1.5 max-w-2xl text-[11px] text-slate-400">
            {t(
              'Gérez plusieurs comptes (Direction, prospection RPA, etc.). Le compte par défaut alimente la messagerie Workhub.',
              'Manage multiple accounts (executive, RPA prospecting, etc.). The default account feeds the Workhub inbox.'
            )}
          </p>
        </div>
        <span
          className={cn(
            'rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest',
            hasConnected
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-400/30 bg-amber-500/10 text-amber-300'
          )}
        >
          {hasConnected ? t('Connecté', 'Connected') : t('Non configuré', 'Not configured')}
        </span>
      </div>

      {nylasNotice ? (
        <p className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-[11px] font-semibold text-emerald-200">
          {nylasNotice}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 text-[11px] font-semibold text-amber-300">{error}</p>
      ) : null}

      {nylasOn ? (
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleOAuthConnect('gmail')}
            className="rounded-2xl border border-white/15 bg-[#020617]/60 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white hover:border-blue-400/40"
          >
            {t('Connecter Gmail (Nylas)', 'Connect Gmail (Nylas)')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleOAuthConnect('outlook')}
            className="rounded-2xl border border-white/15 bg-[#020617]/60 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white hover:border-blue-400/40"
          >
            {t('Connecter Outlook (Nylas)', 'Connect Outlook (Nylas)')}
          </button>
        </div>
      ) : null}

      <ul className="mb-6 space-y-3">
        {accounts.map((acc) => (
          <li
            key={acc.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#020617]/50 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-100">
                {acc.label}
                {acc.isDefault ? (
                  <span className="inline-flex items-center gap-1 rounded border border-[#deff9a]/40 bg-[#deff9a]/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-[#deff9a]">
                    <Star className="h-3 w-3" />
                    {t('Défaut', 'Default')}
                  </span>
                ) : null}
              </p>
              <p className="truncate font-mono text-[11px] text-slate-400">{acc.emailAddress}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                {providerLabel(acc.provider, locale)} · {syncStatusLabel(acc.syncStatus, locale)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!acc.isDefault ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSetDefault(acc.id)}
                  className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/5"
                >
                  {t('Par défaut', 'Set default')}
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving || accounts.length <= 1}
                onClick={() => void handleRemove(acc.id)}
                className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"
                aria-label={t('Supprimer', 'Remove')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-dashed border-white/15 bg-[#020617]/30 p-5">
        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
          {t('Ajouter un compte', 'Add account')}
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t('Libellé', 'Label')}>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t('Direction', 'Executive')}
              className="workhub-input"
            />
          </Field>
          <Field label={t('Adresse courriel', 'Email address')}>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="alain@primexpert.ca"
              className="workhub-input"
            />
          </Field>
          <Field label={t('Fournisseur', 'Provider')} className="md:col-span-2">
            <select
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value as EmailAccountProvider)}
              className="workhub-input"
            >
              <option value="gmail">Gmail / Google Workspace</option>
              <option value="outlook">Microsoft 365 / Outlook</option>
              <option value="imap">{t('IMAP personnalisé', 'Custom IMAP')}</option>
            </select>
          </Field>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleAddAccount()}
          className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-[#deff9a]/50 bg-black px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#deff9a] transition hover:bg-[#deff9a]/10 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t('Ajouter la boîte', 'Add mailbox')}
          <Plug className="h-3.5 w-3.5 opacity-70" />
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
