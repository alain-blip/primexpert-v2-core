import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { Search, Bell } from 'lucide-react';
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
import { AppResponsiveLayout } from './layout/AppResponsiveLayout';
import {
  LayoutAssistantPanel,
  LayoutMobileBottomNav,
  LayoutNavigationRail,
  Compass,
  Home,
  Users,
  Calculator,
  FileText,
  TrendingUp,
  BarChart3,
  FolderOpen,
  Phone,
} from './layout/LayoutChrome';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { profile, logOut } = useAuth();
  const sessionReady = Boolean(profile?.uid);
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
    <AppResponsiveLayout
      shell={sessionReady}
      navigation={
        sessionReady ? (
        <LayoutNavigationRail
          navItems={navItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeSilo={activeSilo}
          setActiveSilo={setActiveSilo}
          canAccess={canAccess}
          nicheConfig={nicheConfig}
          t={t}
          profileDisplayName={profile?.displayName}
          storageQuotaLabel={buildStorageQuotaLabel(driveUsedBytes, storageTier)}
          quotaPercent={quotaPercent}
          onSettings={() => setActiveTab('settings')}
          onLogOut={logOut}
          settingsActive={activeTab === 'settings'}
        />
        ) : undefined
      }
      bottomNavigation={
        sessionReady ? (
        <LayoutMobileBottomNav
          navItems={navItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        ) : undefined
      }
      header={
        <div className="app-chrome-bar flex h-18 shrink-0 items-center justify-between border-b px-4 md:px-7">
          <div className="flex min-w-0 items-center gap-2 md:gap-4">
            <h2 className="truncate text-lg font-black uppercase italic tracking-tighter md:text-2xl">
              <span className="workhub-title-gradient">
                {activeTab === 'settings'
                  ? t('Paramètres', 'Settings')
                  : activeTab === 'admin-billing'
                    ? t('Tour de contrôle — Finance', 'Control tower — Finance')
                    : navItems.find((i) => i.id === activeTab)?.label ??
                      t('Tableau de bord', 'Dashboard')}
              </span>{' '}
              <span className="hidden text-blue-400/40 sm:inline">/</span>{' '}
              <span className="hidden rounded-lg border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 font-mono text-[9px] font-black tracking-widest text-blue-200 not-italic sm:inline">
                {activeSilo}
              </span>
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-6">
            <div className="hidden items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-1.5 md:flex">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-green-300">
                {t('Système en ligne', 'Online')}
              </span>
            </div>
            <div
              className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5"
              role="group"
              aria-label={t('Choisir la langue de l’interface', 'Choose interface language')}
            >
              {(['fr', 'en'] as const).map((nextLanguage) => (
                <button
                  key={nextLanguage}
                  type="button"
                  onClick={() => setLanguage(nextLanguage)}
                  className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest transition md:px-2.5 md:py-1.5 ${language === nextLanguage ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  {nextLanguage === 'fr' ? 'FR' : 'EN'}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-blue-300"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="relative rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-blue-300"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white/10" />
              </button>
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between border-t px-4 py-2 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 md:px-7">
          <div className="flex items-center gap-4 md:gap-6">
            <span className="flex items-center gap-1.5">
              <div className="h-1 w-1 bg-blue-400" /> {t('Gemini en langue stricte', 'GEMINI_STRICT_NLP')}
            </span>
            <span className="hidden items-center gap-1.5 lg:flex">
              <div className="h-1 w-1 bg-slate-600" />{' '}
              {t('COUCHE_SECURITE_OACIQ: CONFORME', 'OACIQ_SECURITY_LAYER: COMPLIANT')}
            </span>
          </div>
          <span className="font-mono text-blue-400">
            {t('SYNCHRO_PILOTE', 'PILOT_SYNC')}: {new Date().toLocaleTimeString()}
          </span>
        </div>
      }
      assistantPanel={<LayoutAssistantPanel t={t} />}
    >
      <div className="mx-auto max-w-[1500px] px-4 pt-4 pb-6 md:px-7 md:pb-7">
        {isGracePeriod(profile) ? <GracePeriodBanner /> : null}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </div>
    </AppResponsiveLayout>
  );
}
