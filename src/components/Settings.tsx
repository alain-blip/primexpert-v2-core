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
import {
  institutionalListingsActionButtonClass,
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
  institutionalListingsInlineInputClass,
  institutionalListingsPanelClass,
} from '../lib/institutionalTheme';

type CreativityLevel = 'precise' | 'creative';

const toggleShellClass = 'flex rounded-xl border-2 border-primexpert-dark/20 bg-primexpert-light p-1';
const toggleBaseButtonClass =
  'flex-1 rounded-lg py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition';

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
    <div className={institutionalListingsPanelClass}>
      {/* Header bandeau « Compact Hero » — flex-col mobile, flex-row ≥sm.
          - workhub-card (au lieu de -glow) : halo ::before plus discret,
            évite l'effet « rectangle bleu vide » au-dessus du titre.
          - Aucun halo inline redondant. Aucune hauteur fixe, padding minimal. */}
      <div className={`${institutionalListingsCardShellClass} rounded-[18px] px-5 py-3`}>
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-primexpert-dark/20 bg-primexpert-light">
              <span className="text-[12px] font-black italic tracking-tighter text-slate-900">PX</span>
            </div>
            <div className="min-w-0 leading-tight">
              <p className={`${institutionalListingsCardTitleClass} text-[9px] tracking-[0.3em]`}>
                {t('Paramètres utilisateur', 'User settings')}
              </p>
              <h2 className="mt-0.5 truncate text-xl font-black italic leading-none tracking-tighter text-slate-900 md:text-2xl">
                {t('Profil et accréditations', 'Profile & accreditations')}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end">
            {showFinanceButton ? (
              <button
                type="button"
                onClick={() => workhubNav?.setActiveTab('admin-billing')}
                className="flex max-w-full items-center gap-1.5 rounded-lg border-2 border-amber-300 bg-amber-50 px-2.5 py-2 text-[8px] font-black uppercase tracking-[0.12em] text-amber-900 transition hover:bg-amber-100 sm:max-w-[min(100%,14rem)] sm:leading-tight"
              >
                <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="text-balance">
                  {t('Tour de contrôle — Finance', 'Control tower — Finance')}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className="flex items-center gap-2 whitespace-nowrap rounded-lg border-2 border-primexpert-dark/20 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 transition hover:bg-primexpert-light"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('Réinitialiser', 'Reset')}
            </button>
            <button
              type="button"
              className={`${institutionalListingsActionButtonClass} flex items-center gap-2 whitespace-nowrap px-3 py-2 text-[10px] tracking-[0.2em]`}
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
        <div className={`${institutionalListingsCardShellClass} rounded-[24px] p-6`}>
          <div className="flex items-center gap-2 mb-5">
            <UserCog className="h-4 w-4 text-primexpert-dark" />
            <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-tight">
              {t('Profil', 'Profile')}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Prénom', 'First name')}>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={institutionalListingsInlineInputClass}
              />
            </Field>
            <Field label={t('Nom', 'Last name')}>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={institutionalListingsInlineInputClass}
              />
            </Field>
          </div>

          <Field label={t('Courriel professionnel', 'Professional email')} className="mt-4">
            <input
              type="email"
              value={email}
              readOnly
              className={`${institutionalListingsInlineInputClass} cursor-not-allowed opacity-70`}
            />
          </Field>

          <Field label={t('Photo de profil', 'Profile picture')} className="mt-4">
            <button className={`${institutionalListingsActionButtonClass} flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[10px] tracking-[0.2em]`}>
              <ImagePlus className="w-4 h-4" />
              {t('Téléverser une image', 'Upload an image')}
            </button>
          </Field>

          <div className="mt-5 border-t-2 border-primexpert-dark/10 pt-4">
            <p className="text-[10px] text-slate-700">
              {t("Nom affiché dans l'Espace de travail", 'Display name in Workhub')} :{' '}
              <span className="font-black text-slate-900">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : profile?.displayName ?? '—'}
              </span>
            </p>
          </div>
        </div>

        {/* CARTE PRÉFÉRENCES D'AFFICHAGE */}
        <div className={`${institutionalListingsCardShellClass} rounded-[24px] p-6`}>
          <div className="flex items-center gap-2 mb-5">
            <SettingsIcon className="h-4 w-4 text-primexpert-dark" />
            <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-tight">
              {t("Préférences d'affichage", 'Display preferences')}
            </h3>
          </div>

          <Field label={t('Langue de l’interface', 'Interface language')}>
            <div className={toggleShellClass}>
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
                      ? `${toggleBaseButtonClass} bg-primexpert-dark text-white`
                      : `${toggleBaseButtonClass} text-slate-700 hover:text-slate-900`
                  }`}
                >
                  {lang === 'fr'
                    ? t('Français (Canada)', 'French (Canada)')
                    : t('Anglais', 'English')}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[9px] font-semibold leading-relaxed text-slate-700">
              {t(
                'Primexpert affiche l’interface en français par défaut, conformément à la Charte de la langue française au travail. L’anglais demeure offert pour les équipes bilingues.',
                'Primexpert defaults the interface to French per Quebec workplace language standards. English remains available for bilingual teams.'
              )}
            </p>
          </Field>

          <Field label={t('Thème', 'Theme')} className="mt-4">
            <div className={toggleShellClass}>
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
                        ? `${toggleBaseButtonClass} bg-primexpert-dark text-white`
                        : `${toggleBaseButtonClass} text-slate-700 hover:text-slate-900`
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-slate-700">
              {theme === 'dark'
                ? t('Navigateur Bleu · profond', 'Blue Browser · deep')
                : t('Navigateur Bleu · tamisé', 'Blue Browser · softened')}
            </p>
          </Field>
        </div>

        {/* CARTE CONFIGURATION IA */}
        <div className={`${institutionalListingsCardShellClass} rounded-[24px] p-6`}>
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="h-4 w-4 text-primexpert-dark" />
            <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-tight">
              {t('Configuration IA', 'AI configuration')}
            </h3>
          </div>

          <Field label={t('Niveau de créativité', 'Creativity level')}>
            <div className={toggleShellClass}>
              {(['precise', 'creative'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setCreativity(level)}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition ${
                    creativity === level
                      ? `${toggleBaseButtonClass} bg-primexpert-dark text-white`
                      : `${toggleBaseButtonClass} text-slate-700 hover:text-slate-900`
                  }`}
                >
                  {level === 'precise' ? t('Précis', 'Precise') : t('Créatif', 'Creative')}
                </button>
              ))}
            </div>
          </Field>

          <Field className="mt-4" label="">
            <label className="flex cursor-pointer items-center justify-between rounded-2xl border-2 border-primexpert-dark/20 bg-primexpert-light px-4 py-3 transition hover:border-primexpert-dark/40">
              <span className="text-[12px] font-semibold text-slate-900">
                {t('Signature automatique', 'Automatic signature')}
              </span>
              <input
                type="checkbox"
                checked={autoSignature}
                onChange={(e) => setAutoSignature(e.target.checked)}
                className="h-5 w-5 cursor-pointer rounded-md border-2 border-primexpert-dark/30 bg-white accent-primexpert-dark"
              />
            </label>
          </Field>

          <div className="mt-5 border-t-2 border-primexpert-dark/10 pt-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-700">
              {t('Moteur Gemini · OACIQ guardrails actifs', 'Gemini engine · OACIQ guardrails active')}
            </p>
          </div>
        </div>
      </div>

      {/* CARTE PROFIL ET ACCRÉDITATIONS (OACIQ) */}
      <div className={`${institutionalListingsCardShellClass} rounded-[28px] p-7`}>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-3.5 w-3.5 text-primexpert-dark" />
          <p className={`${institutionalListingsCardTitleClass} text-[10px] tracking-[0.3em]`}>
            {t('Conformité professionnelle', 'Professional compliance')}
          </p>
        </div>
        <h3 className="mb-6 text-2xl font-black italic uppercase tracking-tighter text-slate-900">
          {t('Profil et accréditations', 'Profile & accreditations')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t("Numéro de permis OACIQ", 'OACIQ license number')}>
            <input
              type="text"
              value={oaciqLicense}
              onChange={(e) => setOaciqLicense(e.target.value)}
              placeholder="H1234"
              className={institutionalListingsInlineInputClass}
            />
          </Field>
          <Field label={t("Code d'utilisateur APCIQ", 'APCIQ user code')}>
            <input
              type="text"
              value={apciqCode}
              onChange={(e) => setApciqCode(e.target.value)}
              className={institutionalListingsInlineInputClass}
            />
          </Field>
        </div>

        <Field label={t('Agence immobilière', 'Real estate agency')} className="mt-4">
          <input
            type="text"
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            className={institutionalListingsInlineInputClass}
          />
        </Field>

        <Field label={t('Signature de courriel', 'Email signature')} className="mt-4">
          <textarea
            value={signatureText}
            onChange={(e) => setSignatureText(e.target.value)}
            rows={5}
            className={`${institutionalListingsInlineInputClass} resize-none font-mono leading-relaxed`}
          />
        </Field>

        <Field label={t('Signature image', 'Signature image')} className="mt-4">
          <button className={`${institutionalListingsActionButtonClass} flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] tracking-[0.2em]`}>
            <ImagePlus className="w-4 h-4" />
            {t('Téléverser une image', 'Upload an image')}
          </button>
        </Field>

        <div className="mt-6 flex items-center gap-3 border-t-2 border-primexpert-dark/10 pt-5">
          <button className={`${institutionalListingsActionButtonClass} flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] tracking-[0.2em]`}>
            <Save className="w-3.5 h-3.5" />
            {t('Enregistrer les modifications', 'Save changes')}
          </button>
          <button className="rounded-2xl border-2 border-primexpert-dark/20 bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 transition hover:bg-primexpert-light hover:text-slate-900">
            {t('Annuler', 'Cancel')}
          </button>
        </div>
      </div>

      {/* CARTE COLLABORATEUR / ADJOINTE */}
      <div className={`${institutionalListingsCardShellClass} rounded-[28px] p-7`}>
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-3.5 w-3.5 text-primexpert-dark" />
          <p className={`${institutionalListingsCardTitleClass} text-[10px] tracking-[0.3em]`}>
            {t('Délégation contrôlée', 'Controlled delegation')}
          </p>
        </div>
        <h3 className="mb-6 text-2xl font-black italic uppercase tracking-tighter text-slate-900">
          {t('Collaborateur / Adjointe', 'Collaborator / Assistant')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={t("Prénom de l'adjointe", "Assistant's first name")}>
            <input
              type="text"
              value={assistantFirst}
              onChange={(e) => setAssistantFirst(e.target.value)}
              className={institutionalListingsInlineInputClass}
            />
          </Field>
          <Field label={t("Nom de l'adjointe", "Assistant's last name")}>
            <input
              type="text"
              value={assistantLast}
              onChange={(e) => setAssistantLast(e.target.value)}
              className={institutionalListingsInlineInputClass}
            />
          </Field>
          <Field label={t("Courriel de l'adjointe", "Assistant's email")}>
            <input
              type="email"
              value={assistantEmail}
              onChange={(e) => setAssistantEmail(e.target.value)}
              className={institutionalListingsInlineInputClass}
            />
          </Field>
        </div>

        <label className="mt-5 flex cursor-pointer items-center justify-between rounded-2xl border-2 border-primexpert-dark/20 bg-primexpert-light px-4 py-3 transition hover:border-primexpert-dark/40">
          <span className="text-[12px] font-semibold text-slate-900">
            {t(
              "Inclure l'adjointe en copie conforme des courriels générés",
              'Include the assistant in CC of generated emails'
            )}
          </span>
          <input
            type="checkbox"
            checked={ccAssistant}
            onChange={(e) => setCcAssistant(e.target.checked)}
            className="h-5 w-5 cursor-pointer rounded-md border-2 border-primexpert-dark/30 bg-white accent-primexpert-dark"
          />
        </label>
      </div>

      <EmailAccountsSettings />

      <label className={`${institutionalListingsCardShellClass} flex cursor-pointer items-center justify-between rounded-2xl px-5 py-4 transition hover:border-primexpert-dark/40`}>
        <span className="text-[12px] font-semibold text-slate-900">
          {t('Notifications nouveaux courriels', 'New email notifications')}
        </span>
        <input
          type="checkbox"
          checked={mailNotifs}
          onChange={(e) => setMailNotifs(e.target.checked)}
          className="h-5 w-5 cursor-pointer rounded-md border-2 border-primexpert-dark/30 bg-white accent-primexpert-dark"
        />
      </label>

      {/* Bandeau architecture multi-tenant */}
      <div className={`${institutionalListingsCardShellClass} rounded-[24px] p-5`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className={institutionalListingsCardTitleClass}>
              {t('Architecture multi-tenant', 'Multi-tenant architecture')}
            </p>
            <h4 className="mt-1 text-[13px] font-black uppercase tracking-tight text-slate-900">
              {t('Modèle hybride courtier ↔ agence', 'Hybrid broker ↔ agency model')}
            </h4>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-1.5 text-green-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
              {t('courtiersResponsables', 'courtiersResponsables')}
            </span>
            <span className="text-slate-700">·</span>
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
      {label && <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-900">{label}</p>}
      {children}
    </div>
  );
}
