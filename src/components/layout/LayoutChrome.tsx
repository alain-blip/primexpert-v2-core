/**
 * Chrome Layout — navigation, assistant, bottom bar (consomme ResponsiveLayoutContext).
 * Aucune requête Firestore directe.
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Compass,
  Home,
  Users,
  Calculator,
  FileText,
  LogOut,
  Bell,
  TrendingUp,
  BarChart3,
  Sparkles,
  ShieldCheck,
  Zap,
  MessageSquare,
  FolderOpen,
  Phone,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useResponsiveLayout } from './ResponsiveLayoutContext';
import {
  institutionalListingsCardHeaderClass,
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
} from '../../lib/institutionalTheme';
import type { AssetNiche } from '../../types/residence';

const SILO_LOGO_SRC: Record<AssetNiche, string> = {
  RPA: encodeURI('/RPA Logo 2026 - blanc.png'),
  CPE: encodeURI('/CPE Logo 2026/CPE Logo Blanc 2026.png'),
  PLEX: encodeURI('/PLEX Logo 2026/PLEX Logo Blanc 2026.png'),
};

export interface LayoutNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const MOBILE_BOTTOM_NAV_IDS = [
  'dashboard',
  'pipeline',
  'listings',
  'crm',
  'mail',
] as const;

export function LayoutNavigationRail(props: {
  navItems: LayoutNavItem[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeSilo: AssetNiche;
  setActiveSilo: (silo: AssetNiche) => void;
  canAccess: (silo: AssetNiche) => boolean;
  nicheConfig: Record<AssetNiche, { labelFr: string; labelEn: string }>;
  t: (fr: string, en: string) => string;
  profileDisplayName?: string | null;
  storageQuotaLabel: string;
  quotaPercent: number;
  onSettings: () => void;
  onLogOut: () => void;
  settingsActive: boolean;
}) {
  const { isTablet, isLaptop } = useResponsiveLayout();
  const showNavLabels = isLaptop;
  const showSiloHeader = isLaptop;
  const showProfileBlock = isLaptop;

  return (
    <>
      {showSiloHeader ? (
        <div className="relative shrink-0 p-5 pb-3">
          <div className="flex flex-col gap-1">
            <img
              src="/logo-primexpert-blanc.png"
              alt="Primexpert"
              className="mb-2 h-auto w-full max-w-[150px] rounded-xl shadow-[0_18px_35px_rgba(37,99,235,0.2)]"
            />
            <p className="text-[8px] font-black uppercase tracking-[0.26em] text-blue-300/70">
              {props.t('GPS Immobilier v2.8', 'Real Estate GPS v2.8')}
            </p>
          </div>
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="mb-2 px-1 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
              {props.t('Vue données', 'Data view')}
            </p>
            <div
              className="flex flex-col items-center gap-3 py-1 pl-1"
              role="radiogroup"
              aria-label={props.t(
                'Choisir la niche RPA, CPE ou Plex',
                'Choose RPA, CPE or Plex niche'
              )}
            >
              {(['RPA', 'CPE', 'PLEX'] as const).map((id) => {
                const cfg = props.nicheConfig[id];
                const isNicheActive = props.activeSilo === id;
                const allowed = props.canAccess(id);
                const label = props.t(cfg.labelFr, cfg.labelEn);
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={isNicheActive}
                    aria-label={label}
                    title={
                      allowed
                        ? label
                        : props.t(
                            'Sil non attribué à ce profil',
                            'Silo not assigned to this profile'
                          )
                    }
                    disabled={!allowed}
                    onClick={() => allowed && props.setActiveSilo(id)}
                    className={cn(
                      'relative flex w-20 shrink-0 flex-col items-center justify-center rounded-xl transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70',
                      !allowed && 'cursor-not-allowed opacity-[0.12] grayscale',
                      allowed &&
                        !isNicheActive &&
                        'cursor-pointer opacity-40 grayscale hover:opacity-80 hover:grayscale-0',
                      isNicheActive &&
                        allowed &&
                        'scale-110 cursor-pointer opacity-100 drop-shadow-[0_0_14px_rgba(255,255,255,0.55)]'
                    )}
                  >
                    <img
                      src={SILO_LOGO_SRC[id]}
                      alt=""
                      decoding="async"
                      className="h-auto w-full max-w-[4.25rem] object-contain"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : isTablet ? (
        <div className="flex shrink-0 flex-col items-center gap-2 border-b border-white/10 py-3">
          {(['RPA', 'CPE', 'PLEX'] as const).map((id) => {
            const allowed = props.canAccess(id);
            const isNicheActive = props.activeSilo === id;
            return (
              <button
                key={id}
                type="button"
                disabled={!allowed}
                onClick={() => allowed && props.setActiveSilo(id)}
                className={cn(
                  'rounded-lg p-1 transition',
                  isNicheActive && allowed && 'bg-white/10',
                  !allowed && 'opacity-20'
                )}
              >
                <img src={SILO_LOGO_SRC[id]} alt="" className="h-8 w-8 object-contain" />
              </button>
            );
          })}
        </div>
      ) : null}

      <nav
        className={cn(
          'relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto custom-scrollbar',
          isTablet ? 'px-1 py-2' : 'px-3 py-1'
        )}
      >
        {props.navItems.map((item) => {
          const Icon = item.icon;
          const isActive = props.activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => props.setActiveTab(item.id)}
              title={item.label}
              className={cn(
                'flex w-full shrink-0 items-center rounded-2xl text-left transition-all duration-300 group relative',
                isTablet ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2',
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_16px_38px_rgba(37,99,235,0.32)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon className={cn('w-4 h-4 stroke-[1.8]', isActive && 'scale-110')} />
              {showNavLabels ? (
                <span className="font-black text-[10px] uppercase tracking-[0.12em]">
                  {item.label}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {showProfileBlock ? (
        <div className="relative shrink-0 border-t border-white/5 bg-black/20 p-3 pt-3">
          <div className="mb-3 flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 text-[10px] font-black uppercase shadow-lg">
              {props.profileDisplayName?.[0] || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-black uppercase italic tracking-tight">
                {props.profileDisplayName}
              </p>
            </div>
          </div>
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-white/55">
              {props.storageQuotaLabel}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
              <div className="h-full bg-white" style={{ width: `${props.quotaPercent}%` }} />
            </div>
          </div>
          <button
            type="button"
            onClick={props.onSettings}
            className={cn(
              'mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-[9px] font-black uppercase tracking-widest',
              props.settingsActive
                ? 'border-transparent bg-gradient-to-r from-blue-600 to-blue-500 text-white'
                : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
            )}
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            {props.t('Paramètres', 'Settings')}
          </button>
          <button
            type="button"
            onClick={props.onLogOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:border-red-500/20 hover:bg-red-500/5 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            {props.t('Déconnexion', 'Sign out')}
          </button>
        </div>
      ) : null}
    </>
  );
}

export function LayoutMobileBottomNav(props: {
  navItems: LayoutNavItem[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  const items = props.navItems.filter((i) =>
    (MOBILE_BOTTOM_NAV_IDS as readonly string[]).includes(i.id)
  );

  return (
    <div className="flex items-stretch justify-around gap-1 px-2 py-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = props.activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => props.setActiveTab(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition',
              isActive ? 'bg-blue-600/30 text-blue-200' : 'text-slate-500'
            )}
          >
            <Icon className="h-5 w-5 stroke-[1.8]" />
            <span className="max-w-full truncate text-[7px] font-black uppercase tracking-wide">
              {item.label.split(' ').slice(0, 2).join(' ')}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function LayoutAssistantPanel(props: { t: (fr: string, en: string) => string }) {
  return (
    <>
      <div aria-hidden className="app-assistant-glow absolute inset-0" />
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-400/30 blur-[90px]" />
      <div className="relative z-10 flex h-full w-full flex-col overflow-y-auto p-7 custom-scrollbar">
        <div className="mb-10 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-blue-200/70">
              {props.t('Assistant IA', 'AI Assistant')}
            </p>
            <h3 className="mt-3 text-4xl font-black italic uppercase leading-[0.88] tracking-tighter">
              {props.t('Le Navigateur', 'Blue')}
              <br />
              {props.t('Bleu', 'Navigator')}
            </h3>
          </div>
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[24px] border border-white/15 bg-white/10 shadow-[0_20px_55px_rgba(37,99,235,0.26)]">
            <Sparkles className="h-6 w-6 text-blue-200" />
          </div>
        </div>

        <div className={institutionalListingsCardShellClass}>
          <div className={institutionalListingsCardHeaderClass}>
            <p className={institutionalListingsCardTitleClass}>
              {props.t('Brief instantané', 'Instant brief')}
            </p>
          </div>
          <div className="p-5">
            <p className="text-sm font-semibold italic leading-relaxed text-slate-900">
              &ldquo;
              {props.t(
                'Priorité conformité: valider les délais critiques avant diffusion.',
                'Compliance priority: validate critical deadlines before publication.'
              )}
              &rdquo;
            </p>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          {[
            { label: props.t('Alertes', 'Alerts'), value: '03' },
            {
              label: props.t('Analyse comparative (ACM)', 'Market analysis (CMA)'),
              value: '12',
            },
            { label: props.t('Coffre', 'Vault'), value: '6Y' },
            {
              label: props.t('Validation humaine (HITL)', 'Human-in-the-loop (HITL)'),
              value: 'ON',
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-[24px] border-2 border-primexpert-dark bg-white p-4"
            >
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-700">
                {metric.label}
              </p>
              <p className="mt-2 text-3xl font-black italic tracking-tighter text-black">
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-7 space-y-3">
          <div className="flex gap-3 rounded-[24px] border-2 border-primexpert-dark bg-white p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primexpert-dark" />
            <p className="text-[10px] font-black uppercase tracking-widest text-black">
              {props.t('Protection OACIQ', 'OACIQ Guard')}
            </p>
          </div>
          <div className="flex gap-3 rounded-[24px] border-2 border-primexpert-dark bg-white p-4">
            <Zap className="h-5 w-5 shrink-0 text-primexpert-dark" />
            <p className="text-[10px] font-black uppercase tracking-widest text-black">
              {props.t('Action rapide', 'Quick action')}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="mt-auto w-full rounded-[24px] border-2 border-primexpert-dark bg-white py-4 text-[11px] font-black uppercase tracking-[0.22em] text-slate-900 hover:bg-primexpert-light"
        >
          {props.t('Demander une analyse IA', 'Request AI Analysis')}
        </button>
      </div>
    </>
  );
}

export {
  Compass,
  Home,
  Users,
  Calculator,
  FileText,
  Bell,
  TrendingUp,
  BarChart3,
  FolderOpen,
  Phone,
};
