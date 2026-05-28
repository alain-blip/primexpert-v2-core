import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { Compass, Home, Users, Calculator, FileText, LogOut, Bell, TrendingUp, BarChart3, Search, Sparkles, ShieldCheck, Zap, MessageSquare, FolderOpen, Phone, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useSilo } from '../context/SiloContext';
import { type AssetNiche } from '../types/residence';
import { isGracePeriod } from '../lib/billingAccess';
import { GracePeriodBanner } from './GracePeriodBanner';
import { listDriveDocuments } from '../services/driveStorage';
import {
  buildStorageQuotaLabel,
  bytesUsedByDriveDocuments,
  resolveStorageTier,
  STORAGE_TIER_LIMITS_BYTES,
} from '../lib/quotaStorageService';
import {
  institutionalListingsCardHeaderClass,
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
} from '../lib/institutionalTheme';

/** Logos silo (fichiers `public/`, noms avec espaces). */
const SILO_LOGO_SRC: Record<AssetNiche, string> = {
  RPA: encodeURI('/RPA Logo 2026 - blanc.png'),
  CPE: encodeURI('/CPE Logo 2026/CPE Logo Blanc 2026.png'),
  PLEX: encodeURI('/PLEX Logo 2026/PLEX Logo Blanc 2026.png'),
};

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { profile, logOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { activeSilo, setActiveSilo, canAccess } = useSilo();
  const [driveUsedBytes, setDriveUsedBytes] = useState(0);
  const storageTier = resolveStorageTier(profile?.tier);
  const quotaPercent = Math.min(100, (driveUsedBytes / STORAGE_TIER_LIMITS_BYTES[storageTier]) * 100);

  useEffect(() => {
    if (!profile?.uid) return;
    let cancelled = false;
    void listDriveDocuments({ tenantId: profile.uid, mode: 'strict' })
      .then((docs) => {
        if (!cancelled) setDriveUsedBytes(bytesUsedByDriveDocuments(docs));
      })
      .catch(() => {
        if (!cancelled) setDriveUsedBytes(0);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.uid]);

  const nicheConfig: Record<AssetNiche, { labelFr: string; labelEn: string }> = {
    RPA: { labelFr: 'RPA — Résidences', labelEn: 'RPA — Care homes' },
    CPE: { labelFr: 'CPE — Places', labelEn: 'CPE — Childcare' },
    PLEX: { labelFr: 'Plex — Multilogement', labelEn: 'Plex — Multi-unit' },
  };

  const navItems = useMemo(
    () =>
      [
        { id: 'dashboard', label: t('Tableau de bord', 'Dashboard'), icon: Compass },
        { id: 'pipeline', label: t('Suivi des dossiers', 'Pipeline'), icon: TrendingUp },
        { id: 'listings', label: t('Mes inscriptions', 'My listings'), icon: Home },
        { id: 'acm', label: t('Analyse comparative de marché (ACM)', 'Comparative market analysis (CMA)'), icon: Calculator },
        { id: 'stats', label: t('Statistiques du marché', 'Market statistics'), icon: BarChart3 },
        { id: 'crm', label: t('Répertoire clients', 'CRM'), icon: Users },
        { id: 'content', label: t('Rédacteur IA', 'AI Writer'), icon: FileText },
        { id: 'drive', label: t('Mes Documents', 'My Documents'), icon: FolderOpen },
        { id: 'phone', label: t('Téléphonie logicielle', 'Softphone'), icon: Phone },
        { id: 'mail', label: t('Boîte de courriels', 'Mailbox'), icon: Bell },
      ] as { id: string; label: string; icon: typeof Compass }[],
    [t]
  );

  return (
    <div className="relative flex h-screen text-slate-100 font-sans selection:bg-blue-500/30 overflow-hidden text-sm">
      {/* Dégradé global — la couleur est définie dans index.css (.app-bg)
          pour pouvoir basculer Sombre ↔ Clair atténué via html.dark / html.light. */}
      <div aria-hidden="true" className="app-bg pointer-events-none fixed inset-0 -z-10" />

      {/* Sidebar - Control Center */}
      <aside className="app-aside flex h-screen max-h-screen w-[218px] shrink-0 flex-col overflow-hidden backdrop-blur-md text-white relative z-40">
        <div aria-hidden="true" className="app-aside-glow pointer-events-none absolute inset-0" />
        <div className="relative shrink-0 p-5 pb-3">
          <div className="flex flex-col gap-1">
            <img src="/logo-primexpert-blanc.png" alt="Primexpert" className="mb-2 h-auto w-full max-w-[150px] rounded-xl shadow-[0_18px_35px_rgba(37, 99, 235,0.2)]" />
            <p className="text-[8px] font-black uppercase tracking-[0.26em] text-blue-300/70">{t('GPS Immobilier v2.5', 'Real Estate GPS v2.5')}</p>
          </div>
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="mb-2 px-1 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
              {t('Vue données', 'Data view')}
            </p>
            <div
              className="flex flex-col items-center gap-3 py-1 pl-1"
              role="radiogroup"
              aria-label={t('Choisir la niche RPA, CPE ou Plex', 'Choose RPA, CPE or Plex niche')}
            >
              {(['RPA', 'CPE', 'PLEX'] as const).map((id) => {
                const cfg = nicheConfig[id];
                const isNicheActive = activeSilo === id;
                const allowed = canAccess(id);
                const label = t(cfg.labelFr, cfg.labelEn);
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={isNicheActive}
                    aria-label={label}
                    title={allowed ? label : t('Sil non attribué à ce profil', 'Silo not assigned to this profile')}
                    disabled={!allowed}
                    onClick={() => allowed && setActiveSilo(id)}
                    className={cn(
                      'relative flex w-20 shrink-0 flex-col items-center justify-center rounded-xl transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                      !allowed && 'cursor-not-allowed opacity-[0.12] grayscale',
                      allowed &&
                        !isNicheActive &&
                        'cursor-pointer opacity-40 grayscale hover:opacity-80 hover:grayscale-0',
                      isNicheActive &&
                        allowed &&
                        'scale-110 cursor-pointer opacity-100 drop-shadow-[0_0_14px_rgba(255,255,255,0.55)]'
                    )}
                  >
                    {isNicheActive && allowed ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -left-2.5 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.45)]"
                      />
                    ) : null}
                    <img
                      src={SILO_LOGO_SRC[id]}
                      alt=""
                      decoding="async"
                      className="h-auto w-full max-w-[4.25rem] object-contain object-center"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <nav
          className="relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-3 py-1 custom-scrollbar"
          aria-label={t('Navigation principale', 'Main navigation')}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'flex w-full shrink-0 items-center gap-3 rounded-2xl px-3.5 py-2 text-left transition-all duration-300 group relative',
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_16px_38px_rgba(37, 99, 235,0.32)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className={cn("w-4 h-4 stroke-[1.8] transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
                <span className="font-black text-[10px] uppercase tracking-[0.12em]">{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="active-pill"
                    className="ml-auto w-1 h-4 bg-blue-500/15 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="relative shrink-0 border-t border-white/5 bg-black/20 p-3 pt-3">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-[22px] mb-3 border border-white/10 group cursor-pointer hover:bg-white/10 transition-all">
             <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center font-black shadow-lg uppercase text-[10px]">
                {profile?.displayName?.[0] || 'A'}
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-[10px] font-black truncate uppercase tracking-tight italic">{profile?.displayName}</p>
               <p className="text-[8px] font-bold text-blue-400/40 uppercase tracking-widest leading-none mt-1">{t('Courtier principal', 'Principal broker')}</p>
             </div>
          </div>
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-white/55">
              {buildStorageQuotaLabel(driveUsedBytes, storageTier)}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
              <div className="h-full bg-white" style={{ width: `${quotaPercent}%` }} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 mb-2 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-colors group",
              activeTab === 'settings'
                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white border-transparent shadow-[0_16px_38px_rgba(37,99,235,0.32)]"
                : "bg-white/5 text-slate-400 border-white/5 hover:text-white hover:border-blue-500/30 hover:bg-blue-500/[0.08]"
            )}
          >
            <SettingsIcon className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-500" />
            {t('Paramètres', 'Settings')}
          </button>
          <button 
            onClick={logOut}
            className="w-full flex items-center justify-center gap-2 py-3 text-slate-500 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest bg-white/5 rounded-2xl border border-white/5 hover:border-red-500/20 hover:bg-red-500/5 group"
          >
            <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            {t('Déconnexion', 'Sign out')}
          </button>
          <p className="mt-2 text-center text-[8px] font-semibold leading-relaxed text-white/35">
            {t(
              'Tous droits réservés. Toute reproduction, distribution ou utilisation, en tout ou en partie, est strictement interdite sans autorisation écrite préalable.',
              'All rights reserved. Any reproduction, distribution, or use, in whole or in part, is strictly prohibited without prior written authorization.'
            )}
          </p>
        </div>
      </aside>

      {/* Zone principale */}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent">
        {/* Top Intelligence Bar */}
        <header className="app-chrome-bar h-18 backdrop-blur-md border-b flex items-center justify-between px-7 z-30 sticky top-0 shrink-0">
           <div className="flex items-center gap-4">
             <h2 className="text-2xl font-black italic tracking-tighter uppercase">
               <span className="workhub-title-gradient">
                 {activeTab === 'settings'
                   ? t('Paramètres', 'Settings')
                   : activeTab === 'admin-billing'
                     ? t('Tour de contrôle — Finance', 'Control tower — Finance')
                     : navItems.find((i) => i.id === activeTab)?.label ?? t('Tableau de bord', 'Dashboard')}
               </span>{' '}
               <span className="text-blue-400/40">/</span>{' '}
               <span className="rounded-lg border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 font-mono text-[9px] font-black tracking-widest text-blue-200 not-italic">
                 {activeSilo}
               </span>{' '}
               <span className="text-blue-400 font-mono text-[10px] not-italic tracking-[0.2em]">01_ALPHA</span>
             </h2>
           </div>

           <div className="flex items-center gap-6">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-xl border border-green-500/20">
               <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-[9px] font-black text-green-300 uppercase tracking-widest">{t('Système en ligne', 'Online')}</span>
             </div>
             <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5" role="group" aria-label={t('Choisir la langue de l’interface', 'Choose interface language')}>
               {(['fr', 'en'] as const).map((nextLanguage) => (
                 <button
                   key={nextLanguage}
                   type="button"
                   onClick={() => setLanguage(nextLanguage)}
                   title={
                     nextLanguage === 'fr'
                       ? t('Français (Canada) — défaut', 'French (Canada) — default')
                       : t('Anglais', 'English')
                   }
                   className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${language === nextLanguage ? 'bg-blue-600 text-white shadow-[0_8px_24px_rgba(37, 99, 235,0.35)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                 >
                   {nextLanguage === 'fr' ? 'FR' : 'EN'}
                 </button>
               ))}
             </div>
             
             <div className="flex gap-1">
               <button className="p-2.5 text-slate-400 hover:text-blue-300 transition-all hover:bg-white/5 rounded-xl">
                 <Search className="w-4 h-4" />
               </button>
               <button className="p-2.5 text-slate-400 hover:text-blue-300 transition-all hover:bg-white/5 rounded-xl relative">
                 <Bell className="w-4 h-4" />
                 <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white/10" />
               </button>
             </div>
           </div>
        </header>

        {/* Viewport content — pt réduit pour rapprocher le contenu de la topbar */}
        <div className="flex-1 overflow-y-auto px-7 pt-4 pb-7 custom-scrollbar">
           <div className="max-w-[1500px] mx-auto">
             {isGracePeriod(profile) ? <GracePeriodBanner /> : null}
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.4, ease: "easeOut" }}
             >
               {children}
             </motion.div>
           </div>
        </div>

        {/* Barre d'état */}
        <footer className="app-chrome-bar backdrop-blur-md border-t px-7 py-2 flex justify-between items-center text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 shrink-0 select-none">
         <div className="flex gap-6 items-center">
           <span className="flex items-center gap-1.5"><div className="w-1 h-1 bg-blue-400" /> {t('Gemini en langue stricte', 'GEMINI_STRICT_NLP')}</span>
           <span className="flex items-center gap-1.5"><div className="w-1 h-1 bg-slate-600" /> {t('COUCHE_SECURITE_OACIQ: CONFORME', 'OACIQ_SECURITY_LAYER: COMPLIANT')}</span>
         </div>
         <div className="flex gap-4">
           <span className="text-slate-300 italic tracking-[0.3em]">REF_ID: PRO_774</span>
           <span className="text-blue-400 font-mono">{t('SYNCHRO_PILOTE', 'PILOT_SYNC')}: {new Date().toLocaleTimeString()}</span>
         </div>
       </footer>
      </main>

      <aside className="app-assistant hidden xl:flex w-[360px] shrink-0 text-white relative overflow-hidden border-l-2 border-primexpert-dark">
        <div aria-hidden="true" className="app-assistant-glow absolute inset-0" />
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-400/30 rounded-full blur-[90px]" />
        <div className="absolute bottom-0 left-0 right-0 h-72 bg-[radial-gradient(circle_at_50%_100%,rgba(37, 99, 235,0.28),transparent_62%)]" />

        <div className="relative z-10 flex flex-col w-full p-7">
          <div className="flex items-start justify-between mb-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-blue-200/70">{t('Assistant IA', 'AI Assistant')}</p>
              <h3 className="mt-3 text-4xl font-black italic tracking-tighter uppercase leading-[0.88]">
                {t('Le Navigateur', 'Blue')}<br />{t('Bleu', 'Navigator')}
              </h3>
            </div>
            <div className="w-[52px] h-[52px] rounded-[24px] bg-white/10 border border-white/15 flex items-center justify-center shadow-[0_20px_55px_rgba(37, 99, 235,0.26)]">
              <Sparkles className="w-6 h-6 text-blue-200" />
            </div>
          </div>

          <div className={institutionalListingsCardShellClass}>
            <div className={institutionalListingsCardHeaderClass}>
              <p className={institutionalListingsCardTitleClass}>{t('Brief instantané', 'Instant brief')}</p>
            </div>
            <div className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-primexpert-light border border-primexpert-dark/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primexpert-dark" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-700">{t('Brief instantané', 'Instant brief')}</p>
                <p className="text-xs font-black uppercase tracking-wider text-black">{t('Centre de mission', 'Mission Control')}</p>
              </div>
            </div>
            <p className="text-sm font-semibold leading-relaxed text-slate-900 italic">
              "{t('Priorité conformité: valider les délais critiques, garder le coffre-fort immuable et préparer une analyse comparative de marché (ACM) motivée avant diffusion.', 'Compliance priority: validate critical deadlines, keep the Vault immutable and prepare a reasoned comparative market analysis (CMA) before publication.')}"
            </p>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            {[
              { label: t('Alertes', 'Alerts'), value: '03' },
              { label: t('Analyse comparative (ACM)', 'Market analysis (CMA)'), value: '12' },
              { label: t('Coffre', 'Vault'), value: '6Y' },
              { label: t('Validation humaine (HITL)', 'Human-in-the-loop (HITL)'), value: 'ON' },
            ].map((metric) => (
              <div key={metric.label} className="rounded-[24px] bg-white border-2 border-primexpert-dark p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-700">{metric.label}</p>
                <p className="mt-2 text-3xl font-black italic tracking-tighter text-black">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 space-y-3">
            <div className="flex gap-3 rounded-[24px] bg-white border-2 border-primexpert-dark p-4">
              <ShieldCheck className="w-5 h-5 text-primexpert-dark shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-black">{t('Protection OACIQ', 'OACIQ Guard')}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-900">{t('Signature, prix contrat et validation humaine sous surveillance.', 'Signature, contract price and human validation under watch.')}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-[24px] bg-white border-2 border-primexpert-dark p-4">
              <Zap className="w-5 h-5 text-primexpert-dark shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-black">{t('Action rapide', 'Quick action')}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-900">{t('Lancer une révision d’analyse comparative de marché (ACM) sans contourner la note du courtier.', 'Launch a comparative market analysis (CMA) review without bypassing the broker note.')}</p>
              </div>
            </div>
          </div>

          <button className="mt-auto w-full rounded-[24px] border-2 border-primexpert-dark bg-white py-4 text-[11px] font-black uppercase tracking-[0.22em] text-slate-900 shadow-[0_24px_60px_rgba(37,99,235,0.22)] hover:bg-primexpert-light transition-all">
            {t('Demander une analyse IA', 'Request AI Analysis')}
          </button>
        </div>
      </aside>
    </div>
  );
}
