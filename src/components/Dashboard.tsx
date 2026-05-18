import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Users,
  Home,
  Clock,
  DollarSign,
  Compass,
  Flame,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { useWorkhubNav } from '../lib/workhubNav';
import { stashListingsFocusResidenceId } from '../lib/listingsFocus';
import { listResidences, type Residence } from '../services/residences';
import { fetchRecentCallAnalyses } from '../services/transcriptionService';
import { fetchRecentMailboxAnalyses } from '../services/mailboxAnalysis';
import {
  computeFollowUpPriorities,
  type FollowUpPriorityItem,
} from '../services/followUpIntel';
import { useSilo } from '../context/SiloContext';
import { shouldShowJ7Survey } from '../lib/trialTimeline';
import { J7SurveyModal } from './J7SurveyModal';
import { maybeSendJ21NurtureEmail } from '../services/nurtureScheduler';

export function Dashboard() {
  const { profile, refreshProfile } = useAuth();
  const { activeSilo } = useSilo();
  const { t, language } = useLanguage();
  const workhubNav = useWorkhubNav();
  const [followUpPriorities, setFollowUpPriorities] = useState<FollowUpPriorityItem[]>([]);
  const [j7Open, setJ7Open] = useState(false);
  const [j7Dismissed, setJ7Dismissed] = useState(false);
  const [residences, setResidences] = useState<Residence[]>([]);
  const [dashboardDataLoading, setDashboardDataLoading] = useState(false);

  useEffect(() => {
    const uid = profile?.uid;
    if (!uid) {
      setResidences([]);
      setFollowUpPriorities([]);
      setDashboardDataLoading(false);
      return;
    }
    let cancelled = false;
    setDashboardDataLoading(true);
    setResidences([]);
    (async () => {
      try {
        const [resList, calls, mails] = await Promise.all([
          listResidences({ tenantId: uid, mode: 'strict' }, { silo: activeSilo }),
          fetchRecentCallAnalyses(uid, 400),
          fetchRecentMailboxAnalyses(uid, 400),
        ]);
        if (cancelled) return;
        setResidences(resList);
        setFollowUpPriorities(computeFollowUpPriorities(resList, calls, mails));
      } finally {
        if (!cancelled) setDashboardDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.uid, activeSilo]);

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
    <div className="space-y-8">
      <J7SurveyModal
        open={j7Open}
        onClose={() => {
          setJ7Open(false);
          setJ7Dismissed(true);
        }}
        onSubmitted={() => setJ7Dismissed(true)}
      />

      {/* Executive Command Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-vault-bright p-7 rounded-[32px] border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.45)] relative group hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(37, 99, 235,0.25)] hover:border-blue-500/30 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(37, 99, 235,0.16),transparent_34%)] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex justify-between items-start mb-5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">{stat.label}</p>
                <div className={cn(
                  "px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter border",
                  stat.trend === 'up'
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : "bg-white/[0.03] text-slate-500 border-white/10"
                )}>
                  {stat.change}
                </div>
              </div>
              <div className="relative flex items-end justify-between">
                <div>
                  <p className="text-6xl font-black italic tracking-tighter text-white group-hover:text-blue-300 transition-colors">{stat.value}</p>
                  <p className="text-[10px] font-black text-slate-500 mt-4 border-t border-white/10 pt-3 uppercase tracking-widest">{stat.sub}</p>
                </div>
                <div className="w-[52px] h-[52px] rounded-[24px] bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* E-4 — Priorités de suivi (stagnation 48 h sans activité IA appels + courriels matchés) */}
      <div className="rounded-[28px] border border-rose-500/20 bg-gradient-to-br from-rose-500/[0.07] to-vault-bright p-7 shadow-[0_20px_55px_rgba(0,0,0,0.4)]">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/15 text-rose-300">
              <Flame className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black uppercase tracking-tight text-white">
                {t('Priorités de suivi', 'Follow-up priorities')}
              </h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em] mt-1 leading-relaxed">
                {t(
                  'Inscriptions sans appel ni courriel IA rattaché depuis 48 h (les plus critiques en premier).',
                  'Listings with no matched IA call or email activity for 48+ hours (most critical first).'
                )}
              </p>
            </div>
          </div>
        </div>
        {dashboardDataLoading ? (
          <p className="text-[11px] font-semibold text-slate-500 py-4">{t('Chargement…', 'Loading…')}</p>
        ) : followUpPriorities.length === 0 ? (
          <p className="text-[12px] font-semibold text-slate-400 py-2 leading-relaxed">
            {t(
              'Aucune inscription en stagnation critique pour le moment.',
              'No listings in critical stagnation right now.'
            )}
          </p>
        ) : (
          <ul className="space-y-3">
            {followUpPriorities.map((row) => {
              const title =
                row.residence.city && row.residence.city.trim()
                  ? `${row.residence.address}, ${row.residence.city}`
                  : row.residence.address;
              const h = Math.round(row.hoursSinceActivity);
              return (
                <li
                  key={row.residence.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-slate-100 truncate">{title}</p>
                    <p className="text-[10px] font-mono text-rose-300/90 mt-0.5">
                      {t('Inactif depuis ~', 'Idle ~')}{' '}
                      {h}{' '}
                      {t('h', 'h')}
                      {row.reason === 'no_ia_activity'
                        ? ` · ${t('aucune trace IA', 'no IA trail')}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      stashListingsFocusResidenceId(row.residence.id);
                      workhubNav?.setActiveTab('listings');
                    }}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-rose-400/35 bg-rose-500/20 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-rose-100 hover:bg-rose-500/30 transition"
                  >
                    {t('Ouvrir fiche', 'Open listing')}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-8">
        {/* Central Intelligence Table */}
        <div className="2xl:col-span-2 flex flex-col bg-vault-bright rounded-[36px] border border-white/10 shadow-[0_28px_90px_rgba(0,0,0,0.5)] overflow-hidden group">
          <div className="p-8 border-b border-white/10 flex justify-between items-start bg-[radial-gradient(circle_at_100%_0%,rgba(37, 99, 235,0.18),transparent_34%)]">
            <div>
              <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none"><span className="workhub-title-gradient">{t('Tableau de bord', 'WORK_HUB')}</span><span className="text-blue-400 opacity-50">.V2</span></h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-4 flex items-center gap-2">
                <span className="w-1 h-3 bg-blue-400 rounded-full" />
                {t('Flux prioritaire et synchronisation des dossiers', 'Priority_Flow & Pipeline_Sync')}
              </p>
            </div>
            <button className="px-6 py-4 bg-blue-600 text-white text-[11px] font-black rounded-[22px] uppercase tracking-[0.2em] shadow-[0_22px_55px_rgba(37, 99, 235,0.45)] hover:bg-blue-500 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-blue-500/20 rounded-full animate-pulse" />
              {t('Nouvelle mission', 'New_Mission')}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/10">
                  <th className="px-10 py-5">{t('Identifiant du dossier', 'File_ID')}</th>
                  <th className="px-10 py-5 text-center">{t('Statut', 'Status_Logik')}</th>
                  <th className="px-10 py-5 text-right">{t('Indicateur clé', 'Alpha_Metric')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {[
                  { id: "PQ-8842", addr: "4522 Rue de la Roche", city: "Plateau", status: t("OFFRE_ACTIVE", "OFFER_ACTIVE"), time: t("il y a 12 min", "12m ago"), level: 85 },
                  { id: "PQ-9911", addr: "1288 Av. des Pins", city: "Ville-Marie", status: t("ACM_EN_COURS", "CMA_IN_PROGRESS"), time: t("il y a 2 h", "2h ago"), level: 42 },
                  { id: "PQ-1022", addr: "77 Boul. René-Lévesque", city: t("Centre-ville", "Downtown"), status: t("TERMINE_AVEC_SUCCES", "SUCCESS_COMPLETE"), time: t("il y a 3 j", "3d ago"), level: 100 },
                  { id: "PQ-7741", addr: "991 Rue Saint-Denis", city: "Villeray", status: t("PROSPECTION", "PROSPECT_BETA"), time: t("il y a 1 h", "1h ago"), level: 12 },
                ].map((l) => (
                  <tr key={l.id} className="hover:bg-blue-500/[0.06] transition-all group/row cursor-pointer">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center font-mono text-[10px] font-black text-slate-400 group-hover/row:bg-blue-600 group-hover/row:text-white group-hover/row:border-blue-500 transition-all">
                          {l.city[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-black text-white tracking-tight leading-tight">{l.addr}</p>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{l.id} • {l.city.toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <span className={cn(
                        "px-3 py-1.5 text-[9px] font-black rounded-lg border uppercase tracking-widest",
                        l.level === 100 ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        l.level > 80 ? "bg-blue-500/10 text-blue-300 border-blue-500/20 animate-pulse" :
                        "bg-white/[0.03] text-slate-500 border-white/10"
                      )}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-10 py-6 text-right font-mono">
                      <p className="text-[10px] font-black text-blue-300/70 uppercase">{l.time}</p>
                      <div className="flex justify-end gap-1 mt-1.5">
                        <div className="h-1 w-8 bg-white/[0.06] rounded-full overflow-hidden">
                           <div className="h-full bg-blue-500" style={{ width: `${l.level}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rail de conformité */}
        <div className="space-y-8">
          {/* Alertes de conformité */}
          <div className="bg-amber-500/[0.06] p-6 rounded-[32px] border border-amber-500/20 space-y-4 shadow-[0_22px_65px_rgba(245,158,11,0.10)]">
             <div className="flex items-center gap-2 mb-2">
               <Clock className="w-4 h-4 text-amber-400" />
               <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-300">{t('Rappels de Conformité', 'Compliance Reminders')}</h4>
             </div>

             <div className="space-y-3">
               <div className="p-3 bg-amber-500/[0.04] rounded-xl border border-amber-500/15">
                 <p className="text-[11px] font-bold text-amber-200 italic leading-tight">{t('Délai de dédit (3 j.)', 'Cancellation period (3 d.)')}</p>
                 <p className="text-[9px] text-amber-400/80 mt-1 uppercase font-black">{t('Vérifier compte à rebours - Dossier #PQ-8842', 'Check countdown - File #PQ-8842')}</p>
               </div>
               <div className="p-3 bg-amber-500/[0.04] rounded-xl border border-amber-500/15">
                 <p className="text-[11px] font-bold text-amber-200 italic leading-tight">{t('Dates Butoirs (Inspection)', 'Deadlines (Inspection)')}</p>
                 <p className="text-[9px] text-amber-400/80 mt-1 uppercase font-black">{t('Saisir conditions - Dossier #PQ-9911', 'Enter conditions - File #PQ-9911')}</p>
               </div>
             </div>
          </div>

          {/* Carte de commande de conformité — halo inline supprimé
              (doublon avec bg-vault::after) + padding/mb réduits pour
              éliminer le « grand vide bleu » au-dessus du titre. */}
          <div className="bg-vault p-6 rounded-[28px] text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] relative overflow-hidden group border border-white/10">
            <div className="flex justify-between items-start mb-5">
              <div className="min-w-0">
                <p className="text-[10px] font-black text-blue-300 tracking-[0.3em] uppercase">{t('Protection du coffre', 'Vault_Guard')}</p>
                <h3 className="text-3xl font-black italic tracking-tighter uppercase mt-1 leading-[0.92]">Conformité<br/><span className="text-blue-300">_ACTIVE</span></h3>
              </div>
              <div className="w-9 h-9 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shrink-0">
                <Compass className="w-4 h-4 text-blue-400 animate-[spin_10s_linear_infinite]" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                <p className="text-[9px] font-black uppercase text-blue-300/70 mb-2 tracking-widest">{t('Garde-fou prioritaire', 'Priority guardrail')}</p>
                <p className="text-xs font-bold leading-relaxed italic text-slate-200">
                  "{t('Aucun document final ne doit sortir du coffre-fort sans conservation 6 ans, journal de conformité et validation humaine.', 'No final document may leave the Vault without 6-year retention, compliance log and human validation.')}"
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button className="w-full py-3 bg-blue-600 text-[11px] font-black uppercase rounded-2xl shadow-xl hover:bg-blue-500 transition-all tracking-widest">{t('Vérifier le coffre', 'Check_Vault')}</button>
                <button className="w-full py-3 bg-white/5 text-[11px] font-black uppercase rounded-2xl border border-white/10 hover:bg-white/10 transition-all tracking-widest">{t('Journal de conformité', 'Compliance log')}</button>
              </div>
            </div>
          </div>

          {/* Signature rapide */}
          <div className="bg-vault p-8 rounded-[32px] border border-white/10 shadow-[0_22px_65px_rgba(0,0,0,0.4)] relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform duration-500 origin-top" />
             <div className="flex gap-4">
               <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-500 transition-colors duration-500">
                 <Users className="w-6 h-6 text-blue-400 group-hover:text-white transition-colors duration-500" />
               </div>
               <div>
                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('Session active', 'Active_Session')}</p>
                  <h4 className="text-xl font-black italic tracking-tighter uppercase leading-none text-white">{profile?.displayName}</h4>
                  <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mt-1">{t('Courtier principal @ OACIQ_001', 'Prime_Broker @ OACIQ_001')}</p>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
