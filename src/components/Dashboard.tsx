import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Users,
  Home,
  DollarSign,
  Sun,
  Flame,
  Calendar,
  AlertTriangle,
  Radar,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  calculateHotLeadScore,
  extractHotLeadSignalsFromMessages,
} from '@primexpert/core/crm';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import {
  buildResidenceTenantContext,
  excludeCatalogReferenceResidences,
  listResidences,
  type Residence,
} from '../services/residences';
import { fetchRecentCallAnalyses } from '../services/transcriptionService';
import { fetchRecentMailboxAnalyses } from '../services/mailboxAnalysis';
import {
  fetchResidenceDocsMap,
  loadDashboardPriorityFollowUps,
  type DashboardPriorityFollowUpItem,
} from '../services/dashboardPriorityFollowUp';
import type { SavedMailboxAnalysis } from '../services/mailboxAnalysis';
import { PriorityFollowUpList } from './dashboard/PriorityFollowUpList';
import { PageGuideHeader } from './institutional/PageGuideHeader';
import { InstitutionalWhitePanel } from './residence/institutional/InstitutionalUi';
import { useSilo } from '../context/SiloContext';
import { shouldShowJ7Survey } from '../lib/trialTimeline';
import { J7SurveyModal } from './J7SurveyModal';
import { maybeSendJ21NurtureEmail } from '../services/nurtureScheduler';
import {
  institutionalListingsCardHeaderClass,
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
  institutionalListingsFailSafeClass,
  institutionalListingsPanelClass,
} from '../lib/institutionalTheme';
import {
  loadMorningBriefingDashboardData,
  RADAR_OPPORTUNITIES_IDLE_MESSAGE_EN,
  RADAR_OPPORTUNITIES_IDLE_MESSAGE_FR,
  type MorningBriefingDashboardData,
} from '../services/morningBriefingService';

export function Dashboard() {
  const { profile, refreshProfile } = useAuth();
  const { activeSilo } = useSilo();
  const { t, language } = useLanguage();
  const [priorityFollowUps, setPriorityFollowUps] = useState<DashboardPriorityFollowUpItem[]>([]);
  const [j7Open, setJ7Open] = useState(false);
  const [j7Dismissed, setJ7Dismissed] = useState(false);
  const [residences, setResidences] = useState<Residence[]>([]);
  const [recentMails, setRecentMails] = useState<SavedMailboxAnalysis[]>([]);
  const [dashboardDataLoading, setDashboardDataLoading] = useState(false);
  const [morningBriefing, setMorningBriefing] = useState<MorningBriefingDashboardData | null>(null);

  useEffect(() => {
    if (!profile?.uid) {
      setResidences([]);
      setPriorityFollowUps([]);
      setMorningBriefing(null);
      setDashboardDataLoading(false);
      return;
    }
    const uid = profile.uid;
    const orgId = profile.orgId?.trim() ?? '';
    const tenantCtx = buildResidenceTenantContext(profile);
    let cancelled = false;
    setDashboardDataLoading(true);
    setResidences([]);
    (async () => {
      try {
        const [resList, calls, mails] = await Promise.all([
          listResidences(tenantCtx, { silo: activeSilo }),
          fetchRecentCallAnalyses(uid, 400),
          fetchRecentMailboxAnalyses(uid, 400),
        ]);
        if (cancelled) return;
        const hotResidences = excludeCatalogReferenceResidences(resList);
        const docs = await fetchResidenceDocsMap(hotResidences.map((r) => r.id));
        if (cancelled) return;
        setResidences(hotResidences);
        setRecentMails(mails);
        setPriorityFollowUps(
          loadDashboardPriorityFollowUps({ residences: hotResidences, docs, calls, mails })
        );
        if (orgId) {
          const briefingData = await loadMorningBriefingDashboardData({
            orgId,
            brokerId: uid,
            role: profile.role,
            residences: hotResidences,
            mails,
          });
          if (!cancelled) setMorningBriefing(briefingData);
        } else if (!cancelled) {
          setMorningBriefing(null);
        }
      } finally {
        if (!cancelled) setDashboardDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, activeSilo]);

  const dashboardHotLeadScore = useMemo(() => {
    const signals = extractHotLeadSignalsFromMessages(
      recentMails.map((mail) => ({
        id: mail.messageId,
        summaryOneLine: mail.mergedParse.summaryOneLine,
        body: mail.mergedParse.summaryOneLine,
        channel: 'email',
        direction: 'inbound' as const,
      }))
    );
    return calculateHotLeadScore({ signals }).score;
  }, [recentMails]);

  useEffect(() => {
    if (!profile?.uid || profile.role === 'admin_system') return;
    const locale = language === 'fr' ? 'fr' : 'en';
    void maybeSendJ21NurtureEmail(profile, locale).then((sent) => {
      if (sent) void refreshProfile();
    });
  }, [profile?.uid, profile?.trialStartDate, profile?.lastEmailSent, profile?.role, language, refreshProfile]);

  useEffect(() => {
    if (!profile || j7Dismissed || profile.j7Survey?.submittedAt) return;
    if (shouldShowJ7Survey(profile.trialStartDate, Boolean(profile.j7Survey?.submittedAt))) {
      setJ7Open(true);
    }
  }, [profile, j7Dismissed]);

  const stats = useMemo(() => {
    const loading = dashboardDataLoading;
    const prospect = residences.filter((r) => r.status === 'prospect').length;
    const mandate = residences.filter((r) => r.status === 'mandate').length;
    const sold = residences.filter((r) => r.status === 'sold').length;
    const pipeVol = residences
      .filter((r) => r.status === 'prospect' || r.status === 'mandate' || r.status === 'promise')
      .reduce((s, r) => s + (Number(r.price) || 0), 0);

    const formatVolShort = (n: number) => {
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M$`;
      if (n >= 1000) return `${Math.round(n / 1000)} k$`;
      return formatCurrency(n, { maxDecimals: 0 });
    };

    const dash = '—';
    const silo = activeSilo;

    return [
      {
        label: t('01 / Prospection', '01 / Prospecting'),
        value: loading ? dash : String(prospect),
        change: loading ? dash : `${residences.length} ${t('fiches silo', 'silo listings')}`,
        trend: 'up' as const,
        sub: `${t('Silo', 'Silo')} ${silo} · ${t('Données Firestore', 'Firestore data')}`,
        icon: Users,
      },
      {
        label: t('02 / Mandats Actifs', '02 / Active Listings'),
        value: loading ? dash : String(mandate),
        change: loading ? dash : t('Temps réel', 'Live'),
        trend: 'up' as const,
        sub: t('Statut mandate dans résidences', 'Mandate status on residences'),
        icon: Home,
      },
      {
        label: t('06 / Succès Vendu', '06 / Sold Success'),
        value: loading ? dash : String(sold),
        change: sold > 0 ? t('Actif', 'Active') : t('—', '—'),
        trend: 'neutral' as const,
        sub: t('Basé sur statut vendu', 'Based on sold status'),
        icon: TrendingUp,
      },
      {
        label: t('09 / Volume pipeline', '09 / Pipeline volume'),
        value: loading ? dash : formatVolShort(pipeVol),
        change: loading ? dash : t('Prospection + mandat + promesse', 'Prospect + mandate + promise'),
        trend: 'up' as const,
        sub: `${t('Prix affiché cumulé', 'Sum of list prices')} (${silo})`,
        icon: DollarSign,
      },
    ];
  }, [residences, dashboardDataLoading, activeSilo, t]);

  return (
    <motion.div className="space-y-8">
      <J7SurveyModal
        open={j7Open}
        onClose={() => {
          setJ7Open(false);
          setJ7Dismissed(true);
        }}
        onSubmitted={() => setJ7Dismissed(true)}
      />

      <section className={institutionalListingsPanelClass}>
        <PageGuideHeader
          title={t('Tableau de bord', 'Dashboard')}
          guide={t(
            "Mode d'emploi : [Instructions à venir]",
            'How to use: [Instructions coming soon]'
          )}
        />

        <div className={institutionalListingsCardShellClass}>
          <header className={cn(institutionalListingsCardHeaderClass, 'flex items-center gap-2')}>
            <Sun className="h-4 w-4 text-primexpert-dark" />
            <h2 className={institutionalListingsCardTitleClass}>
              {t('Briefing du matin', 'Morning briefing')}
            </h2>
          </header>
          <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primexpert-dark">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('Tâches critiques — Hub omnicanal', 'Critical tasks — Omnichannel hub')}
              </p>
              {dashboardDataLoading ? (
                <p className="text-[12px] font-semibold text-slate-800">{t('Chargement…', 'Loading…')}</p>
              ) : (morningBriefing?.briefing.criticalTasks.length ?? 0) === 0 ? (
                <p className={cn(institutionalListingsFailSafeClass, 'text-[12px] font-semibold text-slate-900')}>
                  {t('Aucune tâche critique ce matin.', 'No critical tasks this morning.')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {morningBriefing!.briefing.criticalTasks.slice(0, 5).map((task) => (
                    <li
                      key={task.id}
                      className="rounded-lg border border-primexpert-dark/15 bg-white px-3 py-2 dark:bg-primexpert-cardDark"
                    >
                      <p className="text-[12px] font-black text-black">{task.title}</p>
                      {task.description ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-800">{task.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primexpert-dark">
                <Calendar className="h-3.5 w-3.5" />
                {t('Rendez-vous synchronisés', 'Synced appointments')}
              </p>
              {dashboardDataLoading ? (
                <p className="text-[12px] font-semibold text-slate-800">{t('Chargement…', 'Loading…')}</p>
              ) : (morningBriefing?.briefing.appointments.length ?? 0) === 0 ? (
                <p className={cn(institutionalListingsFailSafeClass, 'text-[12px] font-semibold text-slate-900')}>
                  {t('Aucun rendez-vous planifié aujourd\'hui.', 'No appointments scheduled today.')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {morningBriefing!.briefing.appointments.slice(0, 5).map((appt) => (
                    <li
                      key={appt.id}
                      className="rounded-lg border border-primexpert-dark/15 bg-white px-3 py-2 dark:bg-primexpert-cardDark"
                    >
                      <p className="text-[12px] font-black text-black">{appt.title}</p>
                      <p className="text-[10px] font-semibold text-slate-800">
                        {new Date(appt.startAtMillis).toLocaleTimeString(language === 'fr' ? 'fr-CA' : 'en-CA', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primexpert-dark">
                <Flame className="h-3.5 w-3.5" />
                {t('Hot Leads — top 3 à relancer', 'Hot leads — top 3 to follow up')}
              </p>
              {dashboardDataLoading ? (
                <p className="text-[12px] font-semibold text-slate-800">{t('Chargement…', 'Loading…')}</p>
              ) : (morningBriefing?.briefing.hotLeadsTop3.length ?? 0) === 0 ? (
                <p className={cn(institutionalListingsFailSafeClass, 'text-[12px] font-semibold text-slate-900')}>
                  {t('Aucun contact chaud prioritaire pour le moment.', 'No priority hot contacts at the moment.')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {morningBriefing!.briefing.hotLeadsTop3.map((lead) => (
                    <li
                      key={lead.contactId}
                      className="rounded-lg border border-primexpert-dark/15 bg-white px-3 py-2 dark:bg-primexpert-cardDark"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-black text-black">{lead.displayName}</p>
                        <span className="rounded-md bg-primexpert-dark px-2 py-0.5 text-[10px] font-black text-white">
                          {lead.score}/100
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-800">{lead.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className={institutionalListingsCardShellClass}>
          <header className={cn(institutionalListingsCardHeaderClass, 'flex items-center gap-2')}>
            <Radar className="h-4 w-4 text-primexpert-dark" />
            <h2 className={institutionalListingsCardTitleClass}>
              {t('Radar à opportunités (off-market)', 'Opportunity radar (off-market)')}
            </h2>
          </header>
          <div className="p-5">
            {dashboardDataLoading ? (
              <p className="text-[12px] font-semibold text-slate-800">{t('Chargement…', 'Loading…')}</p>
            ) : (morningBriefing?.radarHits.length ?? 0) === 0 ? (
              <p className={cn(institutionalListingsFailSafeClass, 'text-[13px] font-semibold text-slate-900')}>
                {language === 'fr'
                  ? (morningBriefing?.radarIdleMessageFr ?? RADAR_OPPORTUNITIES_IDLE_MESSAGE_FR)
                  : (morningBriefing?.radarIdleMessageEn ?? RADAR_OPPORTUNITIES_IDLE_MESSAGE_EN)}
              </p>
            ) : (
              <ul className="space-y-3">
                {morningBriefing!.radarHits.slice(0, 6).map((hit) => (
                  <li
                    key={hit.id}
                    className="rounded-lg border border-primexpert-dark/15 bg-white px-4 py-3 dark:bg-primexpert-cardDark"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-[12px] font-black text-black">
                        {language === 'fr' ? hit.titleFr : hit.titleEn}
                      </p>
                      <span className="rounded-md border border-primexpert-dark/25 bg-primexpert-light px-2 py-0.5 text-[10px] font-black text-primexpert-dark">
                        {hit.score}/100
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-800">{hit.propertyLabel}</p>
                    <p className="mt-1 text-[11px] text-slate-700">
                      {language === 'fr' ? hit.summaryFr : hit.summaryEn}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className={cn(institutionalListingsCardShellClass, 'max-w-sm')}>
          <header className={institutionalListingsCardHeaderClass}>
            <p className={institutionalListingsCardTitleClass}>{t('Score Hot Leads', 'Hot leads score')}</p>
          </header>
          <div className="p-4">
            <p className="text-4xl font-black text-black">{dashboardHotLeadScore}/100</p>
            <p className="mt-1 text-[11px] font-bold text-slate-900">
              {t(
                'Score prédictif consolidé à partir des interactions récentes.',
                'Consolidated predictive score from recent interactions.'
              )}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.section
                key={stat.label}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={institutionalListingsCardShellClass}
              >
                <header className={cn(institutionalListingsCardHeaderClass, 'flex items-start justify-between')}>
                  <p className={institutionalListingsCardTitleClass}>{stat.label}</p>
                  <Icon className="h-5 w-5 text-primexpert-dark" />
                </header>
                <div className="space-y-2 p-5">
                  <p className="text-5xl font-black tracking-tight text-black">{stat.value}</p>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-900">{stat.change}</p>
                  <p className="border-t border-slate-200 pt-2 text-[10px] font-semibold text-slate-700">{stat.sub}</p>
                </div>
              </motion.section>
            );
          })}
        </div>
      </section>

      <InstitutionalWhitePanel
        title={t('Priorités de suivi', 'Follow-up priorities')}
        subtitle={t(
          'Séquence serrée après libération documentaire — J+3, J+5, J+7 et échéances PA.',
          'Tight sequence after document release — D+3, D+5, D+7 and PA deadlines.'
        )}
      >
        <PriorityFollowUpList items={priorityFollowUps} loading={dashboardDataLoading} />
      </InstitutionalWhitePanel>

      <div className="grid grid-cols-1 gap-8 2xl:grid-cols-3">
        <section className={cn(institutionalListingsCardShellClass, '2xl:col-span-2')}>
          <header className={institutionalListingsCardHeaderClass}>
            <h3 className={institutionalListingsCardTitleClass}>
              {t('Suivi des dossiers', 'Pipeline monitoring')}
            </h3>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-primexpert-light text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">
                  <th className="px-6 py-4">{t('Identifiant du dossier', 'File id')}</th>
                  <th className="px-6 py-4 text-center">{t('Statut', 'Status')}</th>
                  <th className="px-6 py-4 text-right">{t('Indicateur clé', 'Key indicator')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {[
                  { id: "PQ-8842", addr: "4522 Rue de la Roche", city: "Plateau", status: t("OFFRE_ACTIVE", "OFFER_ACTIVE"), time: t("il y a 12 min", "12m ago"), level: 85 },
                  { id: "PQ-9911", addr: "1288 Av. des Pins", city: "Ville-Marie", status: t("ACM_EN_COURS", "CMA_IN_PROGRESS"), time: t("il y a 2 h", "2h ago"), level: 42 },
                  { id: "PQ-1022", addr: "77 Boul. René-Lévesque", city: t("Centre-ville", "Downtown"), status: t("TERMINE_AVEC_SUCCES", "SUCCESS_COMPLETE"), time: t("il y a 3 j", "3d ago"), level: 100 },
                  { id: "PQ-7741", addr: "991 Rue Saint-Denis", city: "Villeray", status: t("PROSPECTION", "PROSPECT_BETA"), time: t("il y a 1 h", "1h ago"), level: 12 },
                ].map((l) => (
                  <tr key={l.id} className="hover:bg-primexpert-light/60 transition-all">
                    <td className="px-6 py-4">
                      <p className="text-[13px] font-black text-black">{l.addr}</p>
                      <p className="text-[10px] font-semibold text-slate-700">{l.id} • {l.city.toUpperCase()}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="rounded-lg border border-primexpert-dark/20 bg-primexpert-light px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-900">
                        {l.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-[10px] font-black uppercase text-slate-900">{l.time}</p>
                      <div className="mt-1 ml-auto h-1 w-12 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-primexpert-dark" style={{ width: `${l.level}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className={institutionalListingsCardShellClass}>
            <header className={institutionalListingsCardHeaderClass}>
              <h3 className={institutionalListingsCardTitleClass}>{t('Rappels de conformité', 'Compliance reminders')}</h3>
            </header>
            <div className="space-y-3 p-5">
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-[11px] font-black text-black">{t('Délai de dédit (3 j.)', 'Cancellation period (3 d.)')}</p>
                <p className="text-[10px] font-semibold text-slate-900">{t('Vérifier compte à rebours - Dossier #PQ-8842', 'Check countdown - File #PQ-8842')}</p>
              </div>
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-[11px] font-black text-black">{t('Dates butoirs (inspection)', 'Deadlines (inspection)')}</p>
                <p className="text-[10px] font-semibold text-slate-900">{t('Saisir conditions - Dossier #PQ-9911', 'Enter conditions - File #PQ-9911')}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
