import React, { useEffect, useMemo, useState } from 'react';
import { Home, Plus, Search, Filter, MoreVertical, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { peekListingsFocusResidenceId, consumeListingsFocusResidenceId } from '../lib/listingsFocus';
import { listResidences, type Residence } from '../services/residences';
import { fetchRecentCallAnalyses, type CallAnalysisRow } from '../services/transcriptionService';
import { fetchRecentMailboxAnalyses, type SavedMailboxAnalysis } from '../services/mailboxAnalysis';
import {
  isListingStale,
  sentimentDailyAvgsLast7Days,
} from '../services/followUpIntel';
import { ResidenceIntelligencePanel } from './ResidenceIntelligencePanel';

const STATUS_LABELS = {
  prospect: "01 / Prospection",
  mandate: "02 / En Mandat",
  promise: "03 / En Promesse",
  expired: "04 / Expirés",
  unsigned: "05 / Non signé",
  sold: "06 / Vendu"
};

const STATUS_COLORS = {
  prospect: "bg-orange-500/[0.08] text-orange-300 border-orange-400/30",
  mandate: "bg-blue-500/10 text-blue-300 border-blue-400/30",
  promise: "bg-amber-500/[0.06] text-amber-400 border-amber-500/20",
  expired: "bg-red-500/[0.08] text-red-300 border-red-400/30",
  unsigned: "bg-white/[0.04] text-slate-300 border-white/10",
  sold: "bg-green-500/10 text-green-300 border-green-400/30"
};

const STATUS_BORDERS = {
  prospect: "border-orange-500",
  mandate: "border-blue-600",
  promise: "border-amber-500",
  expired: "border-red-500",
  unsigned: "border-gray-400",
  sold: "border-green-500"
};

const DEMO_LISTINGS: Residence[] = [
  { id: 'demo-1', address: '789 Ave Mont-Royal E', city: 'Montréal', price: 650000, status: 'mandate', date: '2024-03-15' },
  { id: 'demo-2', address: '456 Rue De La Commune', city: 'Montréal', price: 1200000, status: 'promise', date: '2024-03-10' },
  { id: 'demo-3', address: '123 Chemin De La Montagne', city: 'Bromont', price: 899000, status: 'sold', date: '2024-02-28' },
  { id: 'demo-4', address: '1010 Rue Peel', city: 'Montréal', price: 450000, status: 'prospect', date: '2024-03-18' },
  { id: 'demo-5', address: '2200 Bd Rosemont', city: 'Montréal', price: 540000, status: 'expired', date: '2023-12-01' },
];

export function Listings() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [filter, setFilter] = useState('all');
  const [firestoreListings, setFirestoreListings] = useState<Residence[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedResidence, setSelectedResidence] = useState<Residence | null>(null);
  const [intelCalls, setIntelCalls] = useState<CallAnalysisRow[]>([]);
  const [intelMails, setIntelMails] = useState<SavedMailboxAnalysis[]>([]);

  useEffect(() => {
    if (!profile?.uid) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    listResidences({ tenantId: profile.uid, mode: 'strict' })
      .then((rows) => {
        if (!cancelled) setFirestoreListings(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.uid]);

  const liveCount = firestoreListings?.length ?? 0;
  const usingDemo = !loading && liveCount === 0;
  const listings: Residence[] = useMemo(
    () => (usingDemo ? DEMO_LISTINGS : firestoreListings ?? []),
    [usingDemo, firestoreListings]
  );

  useEffect(() => {
    if (!profile?.uid || loading) return;
    if (usingDemo) {
      setIntelCalls([]);
      setIntelMails([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [calls, mails] = await Promise.all([
        fetchRecentCallAnalyses(profile.uid, 500),
        fetchRecentMailboxAnalyses(profile.uid, 500),
      ]);
      if (!cancelled) {
        setIntelCalls(calls);
        setIntelMails(mails);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.uid, loading, usingDemo]);

  useEffect(() => {
    if (!profile?.uid || loading) return;
    const id = peekListingsFocusResidenceId();
    if (!id) return;
    const match = listings.find((l) => l.id === id);
    if (match) {
      consumeListingsFocusResidenceId();
      setSelectedResidence(match);
      return;
    }
    if (usingDemo || firestoreListings !== null) {
      consumeListingsFocusResidenceId();
    }
  }, [profile?.uid, loading, usingDemo, listings, firestoreListings]);

  if (selectedResidence && profile?.uid) {
    return (
      <div className="space-y-8">
        <ResidenceIntelligencePanel
          brokerId={profile.uid}
          residence={selectedResidence}
          onClose={() => setSelectedResidence(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Multi-tenant status banner — preuve de vie Phase B */}
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-sm',
          usingDemo
            ? 'border-amber-500/20 bg-amber-500/[0.08] text-amber-300'
            : 'border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-300'
        )}
      >
        {usingDemo ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em]">
            {usingDemo
              ? t('Mode démo — aucune résidence trouvée pour ce courtier', 'Demo mode — no residence found for this broker')
              : t('Multi-tenant actif — résidences filtrées par courtiersResponsables', 'Multi-tenant active — listings scoped by courtiersResponsables')}
          </p>
          <p className="text-[10px] font-mono tracking-tight mt-0.5 opacity-70">
            brokerId={profile?.uid ?? '<non chargé>'} · {liveCount}{' '}
            {t('inscription(s) Firestore', 'Firestore listing(s)')}
          </p>
          {!usingDemo && (
            <p className="text-[10px] font-semibold text-emerald-200/80 mt-2 leading-relaxed">
              {t(
                'Astuce : clique une carte pour ouvrir la vue 360° (appels + courriels IA pour cette propriété).',
                'Tip: click a card to open the 360° view (calls + AI emails for this property).'
              )}
            </p>
          )}
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-vault px-5 py-2.5 rounded-xl border border-white/10 shadow-sm w-full md:w-96 group focus-within:border-blue-400 transition-colors">
          <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-400" />
          <input 
            type="text" 
            placeholder="Rechercher une propriété..." 
            className="text-[10px] font-black uppercase tracking-widest bg-transparent border-none focus:ring-0 w-full placeholder:text-slate-300"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-vault text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/[0.03] transition-all border border-white/10 shadow-sm">
            <Filter className="w-4 h-4" />
            Filtres
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-800 transition-all shadow-lg hover:scale-105 active:scale-95">
            <Plus className="w-4 h-4" />
            Nouv. Inscription
          </button>
        </div>
      </div>

      {/* Kanban View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {Object.entries(STATUS_LABELS).map(([key, label], i) => {
          const count = listings.filter(l => l.status === key).length;
          return (
            <div key={key} className="space-y-4">
              <div className="flex items-center justify-between px-1 border-b-2 border-white/10 pb-2">
                <span className="text-[11px] font-black uppercase tracking-tighter text-slate-300">{label}</span>
                <span className="bg-slate-800 text-white text-[9px] font-black w-5 h-5 rounded flex items-center justify-center italic">{count}</span>
              </div>

              <div className="space-y-4">
                {listings.filter(l => l.status === key).map((l) => {
                  const stale = !usingDemo && isListingStale(l, intelCalls, intelMails);
                  const daily = !usingDemo
                    ? sentimentDailyAvgsLast7Days(intelCalls, l.id)
                    : [0, 0, 0, 0, 0, 0, 0];
                  const hasSentimentSignal = daily.some((v) => v > 0);
                  return (
                  <motion.div
                    key={l.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (profile?.uid) setSelectedResidence(l);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (profile?.uid) setSelectedResidence(l);
                      }
                    }}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className={cn(
                      "bg-vault-bright p-5 rounded-xl border-l-4 shadow-sm hover:shadow-xl transition-all cursor-pointer group text-left w-full",
                      STATUS_BORDERS[key as keyof typeof STATUS_BORDERS]
                    )}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-9 h-9 rounded bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                        <Home className="w-4 h-4 text-blue-400 group-hover:text-white" />
                      </div>
                      <button
                        type="button"
                        className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
                        aria-label={t('Actions', 'Actions')}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    {stale && (
                      <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-amber-200">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {t('Action requise — 48 h+ sans IA', 'Action — 48h+ no IA')}
                      </div>
                    )}
                    <p className="text-sm font-black text-slate-300 italic tracking-tighter mb-1 leading-tight">{l.address}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{l.city}</p>
                    {!usingDemo && (
                      <div className="mt-3" title={t('Sentiment client (appels analysés, 7 j)', 'Client sentiment from analyzed calls, 7d')}>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">
                          {t('Sentiment 7 j', '7d sentiment')}
                        </p>
                        <div className="flex h-7 items-end gap-0.5">
                          {daily.map((v, i) => (
                            <div
                              key={i}
                              className="flex h-7 min-w-0 flex-1 flex-col justify-end rounded-sm bg-white/[0.06]"
                              style={{ maxWidth: 14 }}
                            >
                              <div
                                className={cn(
                                  'w-full rounded-sm',
                                  v <= 0
                                    ? 'h-0.5 bg-slate-600'
                                    : v >= 0.66
                                      ? 'bg-emerald-400/80'
                                      : v >= 0.4
                                        ? 'bg-amber-400/75'
                                        : 'bg-rose-400/80'
                                )}
                                style={{
                                  height:
                                    v > 0
                                      ? `${Math.max(15, Math.min(100, Math.round(v * 100)))}%`
                                      : undefined,
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        {!hasSentimentSignal && (
                          <p className="text-[8px] text-slate-600 mt-0.5 font-semibold">—</p>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10">
                      <span className="text-xs font-black text-blue-300 italic">{formatCurrency(l.price)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-blue-400" />
                    </div>
                  </motion.div>
                  );
                })}
                
                {count === 0 && (
                  <div className="py-12 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.03]">
                    <p className="text-[9px] text-slate-300 font-black uppercase tracking-[0.2em] italic">{t('AUCUN ACTIF', '0_ACTIVE')}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
