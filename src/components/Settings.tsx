/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { consumeOpenFinanceIntent } from '../lib/financeNavigation';
import { EmailAccountsSettings } from './settings/EmailAccountsSettings';
import { useLanguage } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/useTheme';
import { useWorkhubNav } from '../lib/workhubNav';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Shield,
  Sparkles,
  Users,
  UserCog,
  RotateCcw,
  Save,
  ImagePlus,
} from 'lucide-react';

type CreativityLevel = 'precise' | 'creative';

export function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const { profile } = useAuth();
  const workhubNav = useWorkhubNav();
  const { theme, setTheme } = useTheme();

  const [firstName, setFirstName] = useState(profile?.displayName?.split(' ')[0] ?? '');
  const [lastName, setLastName] = useState(profile?.displayName?.split(' ').slice(1).join(' ') ?? '');
  const [email] = useState(profile?.email ?? 'alain@alainstjean.com');

  const [oaciqLicense, setOaciqLicense] = useState('');
  const [apciqCode, setApciqCode] = useState('');
  const [agency, setAgency] = useState('PrimeExpert Immobilier');
  const [signatureText, setSignatureText] = useState(
    `${profile?.displayName ?? 'Alain St-Jean'}\nPrimeExpert Immobilier\nCourtier immobilier résidentiel\nOACIQ: H1234`
  );

  const [creativity, setCreativity] = useState<CreativityLevel>('precise');
  const [autoSignature, setAutoSignature] = useState(true);

  const [assistantFirst, setAssistantFirst] = useState('');
  const [assistantLast, setAssistantLast] = useState('');
  const [assistantEmail, setAssistantEmail] = useState('');
  const [ccAssistant, setCcAssistant] = useState(false);

  const [mailNotifs, setMailNotifs] = useState(true);

  /** Tour de contrôle — Finance : direction uniquement (brief sécurité). */
  const showFinanceButton = profile?.role === 'admin_system';

  useEffect(() => {
    if (!consumeOpenFinanceIntent()) return;
    if (profile?.role === 'admin_system') {
      workhubNav?.setActiveTab('admin-billing');
    }
  }, [profile?.role, workhubNav]);

  return (
    <div className="space-y-6">
      {/* Header bandeau « Compact Hero » — flex-col mobile, flex-row ≥sm.
          - workhub-card (au lieu de -glow) : halo ::before plus discret,
            évite l'effet « rectangle bleu vide » au-dessus du titre.
          - Aucun halo inline redondant. Aucune hauteur fixe, padding minimal. */}
      <div className="workhub-card px-5 py-3 rounded-[18px] text-white shadow-[0_18px_44px_rgba(0,0,0,0.45)]">
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur-sm shrink-0">
              <span className="font-black italic tracking-tighter text-[12px]">PX</span>
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-[9px] font-black text-blue-300/80 tracking-[0.3em] uppercase">
                {t('Paramètres utilisateur', 'User settings')}
              </p>
              <h2 className="text-xl md:text-2xl font-black italic tracking-tighter workhub-title-gradient leading-none mt-0.5 truncate">
                {t('Profil et accréditations', 'Profile & accreditations')}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end">
            {showFinanceButton ? (
              <button
                type="button"
                onClick={() => workhubNav?.setActiveTab('admin-billing')}
                className="max-w-full px-2.5 py-2 bg-amber-500/15 text-[#FACC15] text-[8px] font-black rounded-lg uppercase tracking-[0.12em] hover:bg-amber-500/25 transition border border-[#FACC15]/35 flex items-center gap-1.5 sm:max-w-[min(100%,14rem)] sm:leading-tight"
              >
                <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="text-balance">
                  {t('Tour de contrôle — Finance', 'Control tower — Finance')}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className="px-3 py-2 bg-white/[0.06] text-slate-200 text-[10px] font-black rounded-lg uppercase tracking-[0.2em] hover:bg-white/10 transition border border-white/10 flex items-center gap-2 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('Réinitialiser', 'Reset')}
            </button>
            <button
              type="button"
              className="px-3 py-2 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase tracking-[0.2em] hover:bg-blue-500 transition shadow-[0_12px_28px_rgba(37,99,235,0.45)] flex items-center gap-2 whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              {t('Enregistrer', 'Save')}
            </button>
          </div>
        </div>
      </div>

      {/* Grille 3 cartes : Profil / Préférences / Configuration IA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* CARTE PROFIL */}
        <div className="workhub-card rounded-[24px] p-6">
          <div className="flex items-center gap-2 mb-5">
            <UserCog className="w-4 h-4 text-blue-400" />
            <h3 className="text-[13px] font-black text-white uppercase tracking-tight">
              {t('Profil', 'Profile')}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Prénom', 'First name')}>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="workhub-input"
              />
            </Field>
            <Field label={t('Nom', 'Last name')}>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="workhub-input"
              />
            </Field>
          </div>

          <Field label={t('Courriel professionnel', 'Professional email')} className="mt-4">
            <input
              type="email"
              value={email}
              readOnly
              className="workhub-input opacity-70 cursor-not-allowed"
            />
          </Field>

          <Field label={t('Photo de profil', 'Profile picture')} className="mt-4">
            <button className="w-full px-4 py-3 bg-[#172554] text-white text-[10px] font-black rounded-2xl uppercase tracking-[0.2em] hover:bg-blue-700 transition border border-blue-500/20 flex items-center justify-center gap-2">
              <ImagePlus className="w-4 h-4" />
              {t('Téléverser une image', 'Upload an image')}
            </button>
          </Field>

          <div className="mt-5 pt-4 border-t border-white/10">
            <p className="text-[10px] text-slate-500">
              {t("Nom affiché dans l'Espace de travail", 'Display name in Workhub')} :{' '}
              <span className="font-black text-slate-300">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : profile?.displayName ?? '—'}
              </span>
            </p>
          </div>
        </div>

        {/* CARTE PRÉFÉRENCES D'AFFICHAGE */}
        <div className="workhub-card rounded-[24px] p-6">
          <div className="flex items-center gap-2 mb-5">
            <SettingsIcon className="w-4 h-4 text-blue-400" />
            <h3 className="text-[13px] font-black text-white uppercase tracking-tight">
              {t("Préférences d'affichage", 'Display preferences')}
            </h3>
          </div>

          <Field label={t('Langue de l’interface', 'Interface language')}>
            <div className="flex bg-[#020617]/60 rounded-2xl p-1 border border-white/10">
              {(['fr', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  title={
                    lang === 'fr'
                      ? t('Français (Canada) — langue par défaut (Loi 101)', 'French (Canada) — default language')
                      : t('Anglais — langue secondaire', 'English — secondary language')
                  }
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition ${
                    language === lang
                      ? 'bg-[#172554] text-white shadow-[0_8px_20px_rgba(23, 37, 84,0.6)]'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {lang === 'fr'
                    ? t('Français (Canada)', 'French (Canada)')
                    : t('Anglais', 'English')}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-slate-500 mt-2 leading-relaxed font-semibold">
              {t(
                'Primexpert affiche l’interface en français par défaut, conformément à la Charte de la langue française au travail. L’anglais demeure offert pour les équipes bilingues.',
                'Primexpert defaults the interface to French per Quebec workplace language standards. English remains available for bilingual teams.'
              )}
            </p>
          </Field>

          <Field label={t('Thème', 'Theme')} className="mt-4">
            <div className="flex bg-[#020617]/60 rounded-2xl p-1 border border-white/10">
              {(['dark', 'light'] as const).map((mode) => {
                const isActive = theme === mode;
                const label = mode === 'dark'
                  ? t('Mode sombre', 'Dark mode')
                  : t('Mode clair', 'Light mode');
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTheme(mode)}
                    aria-pressed={isActive}
                    className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition ${
                      isActive
                        ? 'bg-[#172554] text-white shadow-[0_8px_20px_rgba(23, 37, 84,0.6)]'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-blue-300/80 uppercase tracking-widest mt-2 font-black">
              {theme === 'dark'
                ? t('Navigateur Bleu · profond', 'Blue Browser · deep')
                : t('Navigateur Bleu · tamisé', 'Blue Browser · softened')}
            </p>
          </Field>
        </div>

        {/* CARTE CONFIGURATION IA */}
        <div className="workhub-card rounded-[24px] p-6">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h3 className="text-[13px] font-black text-white uppercase tracking-tight">
              {t('Configuration IA', 'AI configuration')}
            </h3>
          </div>

          <Field label={t('Niveau de créativité', 'Creativity level')}>
            <div className="flex bg-[#020617]/60 rounded-2xl p-1 border border-white/10">
              {(['precise', 'creative'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setCreativity(level)}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition ${
                    creativity === level
                      ? 'bg-[#172554] text-white shadow-[0_8px_20px_rgba(23, 37, 84,0.6)]'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {level === 'precise' ? t('Précis', 'Precise') : t('Créatif', 'Creative')}
                </button>
              ))}
            </div>
          </Field>

          <Field className="mt-4" label="">
            <label className="flex items-center justify-between cursor-pointer bg-[#020617]/40 rounded-2xl border border-white/10 px-4 py-3 hover:border-blue-500/30 transition">
              <span className="text-[12px] text-slate-300">
                {t('Signature automatique', 'Automatic signature')}
              </span>
              <input
                type="checkbox"
                checked={autoSignature}
                onChange={(e) => setAutoSignature(e.target.checked)}
                className="w-5 h-5 rounded-md bg-[#020617] border-2 border-white/20 checked:bg-blue-600 checked:border-blue-600 cursor-pointer accent-blue-600"
              />
            </label>
          </Field>

          <div className="mt-5 pt-4 border-t border-white/10">
            <p className="text-[9px] font-black text-blue-300/70 uppercase tracking-widest">
              {t('Moteur Gemini · OACIQ guardrails actifs', 'Gemini engine · OACIQ guardrails active')}
            </p>
          </div>
        </div>
      </div>

      {/* CARTE PROFIL ET ACCRÉDITATIONS (OACIQ) */}
      <div className="workhub-card-glow rounded-[28px] p-7">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <p className="text-[10px] font-black text-blue-300/80 tracking-[0.3em] uppercase">
            {t('Conformité professionnelle', 'Professional compliance')}
          </p>
        </div>
        <h3 className="text-2xl font-black italic tracking-tighter workhub-title-gradient uppercase mb-6">
          {t('Profil et accréditations', 'Profile & accreditations')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t("Numéro de permis OACIQ", 'OACIQ license number')}>
            <input
              type="text"
              value={oaciqLicense}
              onChange={(e) => setOaciqLicense(e.target.value)}
              placeholder="H1234"
              className="workhub-input"
            />
          </Field>
          <Field label={t("Code d'utilisateur APCIQ", 'APCIQ user code')}>
            <input
              type="text"
              value={apciqCode}
              onChange={(e) => setApciqCode(e.target.value)}
              className="workhub-input"
            />
          </Field>
        </div>

        <Field label={t('Agence immobilière', 'Real estate agency')} className="mt-4">
          <input
            type="text"
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            className="workhub-input"
          />
        </Field>

        <Field label={t('Signature de courriel', 'Email signature')} className="mt-4">
          <textarea
            value={signatureText}
            onChange={(e) => setSignatureText(e.target.value)}
            rows={5}
            className="workhub-input resize-none font-mono leading-relaxed"
          />
        </Field>

        <Field label={t('Signature image', 'Signature image')} className="mt-4">
          <button className="px-5 py-3 bg-[#172554] text-white text-[10px] font-black rounded-2xl uppercase tracking-[0.2em] hover:bg-blue-700 transition border border-blue-500/20 flex items-center gap-2">
            <ImagePlus className="w-4 h-4" />
            {t('Téléverser une image', 'Upload an image')}
          </button>
        </Field>

        <div className="mt-6 pt-5 border-t border-white/10 flex items-center gap-3">
          <button className="px-5 py-3 bg-blue-600 text-white text-[10px] font-black rounded-2xl uppercase tracking-[0.2em] hover:bg-blue-500 transition shadow-[0_18px_40px_rgba(37, 99, 235,0.45)] flex items-center gap-2">
            <Save className="w-3.5 h-3.5" />
            {t('Enregistrer les modifications', 'Save changes')}
          </button>
          <button className="px-5 py-3 bg-transparent text-slate-400 text-[10px] font-black rounded-2xl uppercase tracking-[0.2em] hover:bg-white/5 hover:text-white transition border border-white/10">
            {t('Annuler', 'Cancel')}
          </button>
        </div>
      </div>

      {/* CARTE COLLABORATEUR / ADJOINTE */}
      <div className="workhub-card-glow rounded-[28px] p-7">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <p className="text-[10px] font-black text-blue-300/80 tracking-[0.3em] uppercase">
            {t('Délégation contrôlée', 'Controlled delegation')}
          </p>
        </div>
        <h3 className="text-2xl font-black italic tracking-tighter workhub-title-gradient uppercase mb-6">
          {t('Collaborateur / Adjointe', 'Collaborator / Assistant')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={t("Prénom de l'adjointe", "Assistant's first name")}>
            <input
              type="text"
              value={assistantFirst}
              onChange={(e) => setAssistantFirst(e.target.value)}
              className="workhub-input"
            />
          </Field>
          <Field label={t("Nom de l'adjointe", "Assistant's last name")}>
            <input
              type="text"
              value={assistantLast}
              onChange={(e) => setAssistantLast(e.target.value)}
              className="workhub-input"
            />
          </Field>
          <Field label={t("Courriel de l'adjointe", "Assistant's email")}>
            <input
              type="email"
              value={assistantEmail}
              onChange={(e) => setAssistantEmail(e.target.value)}
              className="workhub-input"
            />
          </Field>
        </div>

        <label className="mt-5 flex items-center justify-between cursor-pointer bg-[#020617]/40 rounded-2xl border border-white/10 px-4 py-3 hover:border-blue-500/30 transition">
          <span className="text-[12px] text-slate-300">
            {t(
              "Inclure l'adjointe en copie conforme des courriels générés",
              'Include the assistant in CC of generated emails'
            )}
          </span>
          <input
            type="checkbox"
            checked={ccAssistant}
            onChange={(e) => setCcAssistant(e.target.checked)}
            className="w-5 h-5 rounded-md bg-[#020617] border-2 border-white/20 cursor-pointer accent-blue-600"
          />
        </label>
      </div>

      <EmailAccountsSettings />

      <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-[#020617]/40 px-5 py-4 transition hover:border-blue-500/30">
        <span className="text-[12px] text-slate-300">
          {t('Notifications nouveaux courriels', 'New email notifications')}
        </span>
        <input
          type="checkbox"
          checked={mailNotifs}
          onChange={(e) => setMailNotifs(e.target.checked)}
          className="h-5 w-5 cursor-pointer rounded-md border-2 border-white/20 bg-[#020617] accent-blue-600"
        />
      </label>

      {/* Bandeau architecture multi-tenant */}
      <div className="workhub-card rounded-[24px] p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="workhub-label">
              {t('Architecture multi-tenant', 'Multi-tenant architecture')}
            </p>
            <h4 className="text-[13px] font-black text-white mt-1 uppercase tracking-tight">
              {t('Modèle hybride courtier ↔ agence', 'Hybrid broker ↔ agency model')}
            </h4>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-1.5 text-green-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
              {t('courtiersResponsables', 'courtiersResponsables')}
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1.5 text-blue-400">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
              {t('organizationId · prêt', 'organizationId · ready')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, className = '', children }: FieldProps) {
  return (
    <div className={className}>
      {label && <p className="workhub-label mb-2">{label}</p>}
      {children}
    </div>
  );
}
