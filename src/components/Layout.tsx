import React from 'react';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { Compass, Home, Users, Calculator, FileText, LogOut, Bell, TrendingUp, BarChart3, Search, Sparkles, ShieldCheck, Zap, MessageSquare, FolderOpen, Phone, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { profile, logOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const navItems = [
    { id: 'dashboard', label: t('Espace de travail', 'Workhub'), icon: Compass },
    { id: 'pipeline', label: t('Suivi des dossiers', 'Pipeline'), icon: TrendingUp },
    { id: 'listings', label: t('Inventaire', 'Inventory'), icon: Home },
    { id: 'acm', label: t('ACM Prédictive', 'Predictive CMA'), icon: Calculator },
    { id: 'stats', label: t('Statistiques', 'Statistics'), icon: BarChart3 },
    { id: 'crm', label: 'Clients', icon: Users },
    { id: 'content', label: t('Rédacteur IA', 'AI Writer'), icon: FileText },
    { id: 'drive', label: 'Drive', icon: FolderOpen },
    { id: 'phone', label: t('Softphone', 'Softphone'), icon: Phone },
    { id: 'mail', label: 'Messages', icon: Bell },
    { id: 'settings', label: t('Paramètres', 'Settings'), icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen bg-[#EAF0FF] text-[#0F172A] font-sans selection:bg-blue-100 overflow-hidden text-sm">
      {/* Sidebar - Control Center */}
      <aside className="w-[218px] bg-[#020617] text-white flex flex-col shrink-0 relative z-40 shadow-[18px_0_70px_rgba(15,23,42,0.35)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(37,99,235,0.32),transparent_36%),linear-gradient(180deg,rgba(23,37,84,0.88),rgba(2,6,23,0.96))]" />
        <div className="relative p-6 pb-8">
          <div className="flex flex-col gap-1">
            <img src="/logo-primexpert-blanc.png" alt="Primexpert" className="mb-3 h-auto w-full max-w-[150px] rounded-xl shadow-[0_18px_35px_rgba(37,99,235,0.2)]" />
            <p className="text-[8px] font-black uppercase tracking-[0.26em] text-blue-300/70">{t('GPS Immobilier v2.5', 'Real Estate GPS v2.5')}</p>
          </div>
        </div>

        <nav className="relative flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all duration-300 group relative text-left",
                  isActive 
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_16px_38px_rgba(37,99,235,0.32)]" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className={cn("w-4 h-4 stroke-[1.8] transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
                <span className="font-black text-[10px] uppercase tracking-[0.12em]">{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="active-pill"
                    className="ml-auto w-1 h-4 bg-blue-100 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="relative p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-[22px] mb-3 border border-white/10 group cursor-pointer hover:bg-white/10 transition-all">
             <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center font-black shadow-lg uppercase text-[10px]">
                {profile?.displayName?.[0] || 'A'}
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-[10px] font-black truncate uppercase tracking-tight italic">{profile?.displayName}</p>
               <p className="text-[8px] font-bold text-blue-400/40 uppercase tracking-widest leading-none mt-1">{t('Courtier Principal', 'Lead Broker')}</p>
             </div>
          </div>
          <button 
            onClick={logOut}
            className="w-full flex items-center justify-center gap-2 py-3 text-slate-500 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest bg-white/5 rounded-2xl border border-white/5 hover:border-red-500/20 hover:bg-red-500/5 group"
          >
            <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            {t('Déconnexion', 'Sign out')}
          </button>
          <p className="mt-4 text-center text-[8px] font-semibold leading-relaxed text-white/35">
            {t(
              'Tous droits réservés. Toute reproduction, distribution ou utilisation, en tout ou en partie, est strictement interdite sans autorisation écrite préalable.',
              'All rights reserved. Any reproduction, distribution, or use, in whole or in part, is strictly prohibited without prior written authorization.'
            )}
          </p>
        </div>
      </aside>

      {/* Zone principale */}
      <main className="flex-1 flex flex-col min-w-0 bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,0.14),transparent_32%),#F8FAFC]">
        {/* Top Intelligence Bar */}
        <header className="h-18 bg-white/80 backdrop-blur-xl border-b border-white/70 flex items-center justify-between px-7 z-30 sticky top-0 shrink-0 shadow-sm">
           <div className="flex items-center gap-4">
             <h2 className="text-2xl font-black italic tracking-tighter text-[#172554] uppercase">
               {navItems.find(i => i.id === activeTab)?.label} <span className="text-blue-600 opacity-20">/</span> <span className="text-blue-600 font-mono text-[10px] not-italic tracking-[0.2em]">01_ALPHA</span>
             </h2>
           </div>

           <div className="flex items-center gap-6">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-xl border border-green-100 shadow-sm">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span className="text-[9px] font-black text-green-700 uppercase tracking-widest">{t('Système en ligne', 'System_Online')}</span>
             </div>
             <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5">
               {(['fr', 'en'] as const).map((nextLanguage) => (
                 <button
                   key={nextLanguage}
                   type="button"
                   onClick={() => setLanguage(nextLanguage)}
                   className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${language === nextLanguage ? 'bg-[#172554] text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-blue-700'}`}
                 >
                   {nextLanguage}
                 </button>
               ))}
             </div>
             
             <div className="flex gap-1">
               <button className="p-2.5 text-slate-400 hover:text-blue-600 transition-all hover:bg-blue-50 rounded-xl">
                 <Search className="w-4 h-4" />
               </button>
               <button className="p-2.5 text-slate-400 hover:text-blue-600 transition-all hover:bg-blue-50 rounded-xl relative">
                 <Bell className="w-4 h-4" />
                 <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full border-2 border-white" />
               </button>
             </div>
           </div>
        </header>

        {/* Viewport content */}
        <div className="flex-1 overflow-y-auto p-7 custom-scrollbar">
           <div className="max-w-[1500px] mx-auto">
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
        <footer className="bg-white/90 backdrop-blur-xl border-t border-white/70 px-7 py-2 flex justify-between items-center text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 shrink-0 select-none">
          <div className="flex gap-6 items-center">
            <span className="flex items-center gap-1.5"><div className="w-1 h-1 bg-blue-600" /> {t('Gemini en langue stricte', 'GEMINI_STRICT_NLP')}</span>
            <span className="flex items-center gap-1.5"><div className="w-1 h-1 bg-slate-300" /> {t('COUCHE_SECURITE_OACIQ: CONFORME', 'OACIQ_SECURITY_LAYER: COMPLIANT')}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-slate-300 italic tracking-[0.3em]">REF_ID: PRO_774</span>
            <span className="text-blue-600 font-mono">{t('SYNCHRO_PILOTE', 'PILOT_SYNC')}: {new Date().toLocaleTimeString()}</span>
          </div>
        </footer>
      </main>

      <aside className="hidden xl:flex w-[360px] shrink-0 bg-[#172554] text-white relative overflow-hidden border-l border-blue-200/20 shadow-[-28px_0_80px_rgba(23,37,84,0.28)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.58),transparent_42%),linear-gradient(180deg,#172554_0%,#0B122C_62%,#020617_100%)]" />
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-400/30 rounded-full blur-[90px]" />
        <div className="absolute bottom-0 left-0 right-0 h-72 bg-[radial-gradient(circle_at_50%_100%,rgba(37,99,235,0.28),transparent_62%)]" />

        <div className="relative z-10 flex flex-col w-full p-7">
          <div className="flex items-start justify-between mb-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-blue-200/70">{t('Assistant IA', 'AI Assistant')}</p>
              <h3 className="mt-3 text-4xl font-black italic tracking-tighter uppercase leading-[0.88]">
                {t('Le Navigateur', 'Blue')}<br />{t('Bleu', 'Navigator')}
              </h3>
            </div>
            <div className="w-[52px] h-[52px] rounded-[24px] bg-white/10 border border-white/15 flex items-center justify-center shadow-[0_20px_55px_rgba(59,130,246,0.26)]">
              <Sparkles className="w-6 h-6 text-blue-200" />
            </div>
          </div>

          <div className="rounded-[32px] bg-white/10 border border-white/15 p-5 backdrop-blur-xl shadow-[0_30px_80px_rgba(2,6,23,0.24)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-blue-400/20 border border-blue-200/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-100" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-200/60">{t('Brief instantané', 'Instant brief')}</p>
                <p className="text-xs font-black uppercase tracking-wider">{t('Centre de mission', 'Mission Control')}</p>
              </div>
            </div>
            <p className="text-sm font-semibold leading-relaxed text-blue-50/90 italic">
              "{t('Priorité conformité: valider les délais critiques, garder le coffre-fort immuable et préparer une ACM motivée avant diffusion.', 'Compliance priority: validate critical deadlines, keep the Vault immutable and prepare a reasoned CMA before publication.')}"
            </p>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            {[
              { label: t('Alertes', 'Alerts'), value: '03' },
              { label: 'ACM', value: '12' },
              { label: t('Coffre', 'Vault'), value: '6Y' },
              { label: 'HITL', value: 'ON' },
            ].map((metric) => (
              <div key={metric.label} className="rounded-[24px] bg-white/[0.08] border border-white/10 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-200/55">{metric.label}</p>
                <p className="mt-2 text-3xl font-black italic tracking-tighter">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 space-y-3">
            <div className="flex gap-3 rounded-[24px] bg-white/[0.08] border border-white/10 p-4">
              <ShieldCheck className="w-5 h-5 text-blue-200 shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest">{t('Protection OACIQ', 'OACIQ Guard')}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-blue-100/70">{t('Signature, prix contrat et validation humaine sous surveillance.', 'Signature, contract price and human validation under watch.')}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-[24px] bg-white/[0.08] border border-white/10 p-4">
              <Zap className="w-5 h-5 text-blue-200 shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest">{t('Action rapide', 'Quick action')}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-blue-100/70">{t('Lancer une révision ACM sans contourner la note du courtier.', 'Launch a CMA review without bypassing the broker note.')}</p>
              </div>
            </div>
          </div>

          <button className="mt-auto w-full py-4 rounded-[24px] bg-white text-[#172554] text-[11px] font-black uppercase tracking-[0.22em] shadow-[0_24px_60px_rgba(59,130,246,0.35)] hover:bg-blue-50 transition-all">
            {t('Demander une analyse IA', 'Request AI Analysis')}
          </button>
        </div>
      </aside>
    </div>
  );
}
