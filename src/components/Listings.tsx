import React, { useEffect, useMemo, useState } from 'react';
import {
  Home,
  Plus,
  Search,
  Filter,
  MoreVertical,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Landmark,
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { peekListingsFocusResidenceId, consumeListingsFocusResidenceId } from '../lib/listingsFocus';
import {
  getResidenceById,
  type Residence,
  type ResidenceStatus,
} from '../services/residences';
import { fetchRecentCallAnalyses, type CallAnalysisRow } from '../services/transcriptionService';
import { fetchRecentMailboxAnalyses, type SavedMailboxAnalysis } from '../services/mailboxAnalysis';
import {
  isListingStale,
  sentimentDailyAvgsLast7Days,
} from '../services/followUpIntel';
import { ResidenceDetail } from './residence/ResidenceDetail';
import { ListingsInventoryVirtual } from './ListingsInventoryVirtual';
import { useListingsPipeline, useListingsInventory } from '../hooks/useListings';
import { useSilo } from '../context/SiloContext';
import { residenceMatchesNiche, type AssetNiche } from '../types/residence';
import { filterListingsForRadar, type RadarListingView, type RadarPropertyType } from '../lib/radarAccess';
import { resolveUserSpecialties } from '../lib/userSpecialties';
import { UpsellModal } from './UpsellModal';
import { RadarLockBadge } from './RadarLockBadge';

const STATUS_LABELS: Record<ResidenceStatus, string> = {
  prospect: '01 / Prospection',
  mandate: '02 / En Mandat',
  promise: '03 / En Promesse',
  expired: '04 / Expirés',
  unsigned: '05 / Non signé',
  sold: '06 / Vendu',
};

const STATUS_BORDERS: Record<ResidenceStatus, string> = {
  prospect: 'border-orange-500',
  mandate: 'border-blue-600',
  promise: 'border-amber-500',
  expired: 'border-red-500',
  unsigned: 'border-gray-400',
  sold: 'border-green-500',
};

/** Colonnes Kanban pipeline « chaud » — archive `unsigned` exclue. */
const PIPELINE_STATUS_KEYS: ResidenceStatus[] = [
  'prospect',
  'mandate',
  'promise',
  'expired',
  'sold',
];

const DEMO_LISTINGS: Residence[] = [
  { id: 'demo-1', address: '789 Ave Mont-Royal E', city: 'Montréal', price: 650000, status: 'mandate', date: '2024-03-15', assetNiche: 'RPA' },
  { id: 'demo-2', address: '456 Rue De La Commune', city: 'Montréal', price: 1200000, status: 'promise', date: '2024-03-10', assetNiche: 'PLEX' },
  { id: 'demo-3', address: '123 Chemin De La Montagne', city: 'Bromont', price: 899000, status: 'sold', date: '2024-02-28', assetNiche: 'RPA' },
  { id: 'demo-4', address: '1010 Rue Peel', city: 'Montréal', price: 450000, status: 'prospect', date: '2024-03-18', assetNiche: 'CPE' },
  { id: 'demo-5', address: '2200 Bd Rosemont', city: 'Montréal', price: 540000, status: 'expired', date: '2023-12-01', assetNiche: 'PLEX' },
  {
    id: 'demo-commercial-1',
    address: '5000 Rue Sherbrooke O',
    city: 'Montréal',
    price: 2100000,
    status: 'mandate',
    date: '2024-03-20',
    propertyType: 'commercial',
  },
];

const DEMO_INVENTORY_ALL: Residence[] = (() => {
  const statuses: ResidenceStatus[] = ['prospect', 'mandate', 'promise', 'expired', 'unsigned', 'sold'];
  const niches: AssetNiche[] = ['RPA', 'CPE', 'PLEX'];
  const rows: Residence[] = [...DEMO_LISTINGS];
  for (let i = 0; i < 220; i++) {
    rows.push({
      id: `demo-archive-${i}`,
      address: `${1200 + i} Boulevard Inventaire`,
      city: i % 3 === 0 ? 'Longueuil' : 'Montréal',
      price: 310000 + (i % 50) * 17000,
      status: statuses[i % statuses.length],
      date: '2024-01-01',
      assetNiche: niches[i % niches.length],
    });
  }
  return rows;
})();

type ListingsTab = 'pipeline' | 'inventory';

export function Listings() {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const { activeSilo } = useSilo();
  const { profile } = useAuth();
  const [tab, setTab] = useState<ListingsTab>('pipeline');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedResidence, setSelectedResidence] = useState<Residence | null>(null);
  const [intelCalls, setIntelCalls] = useState<CallAnalysisRow[]>([]);
  const [intelMails, setIntelMails] = useState<SavedMailboxAnalysis[]>([]);
  const [upsellType, setUpsellType] = useState<RadarPropertyType | null>(null);

  const userSpecialtyKeys = useMemo(
    () => resolveUserSpecialties(profile).map((s) => s),
    [profile]
  );

  const pipelineHook = useListingsPipeline(Boolean(profile?.uid));

  const inventoryHook = useListingsInventory({
    enabled: Boolean(profile?.uid) && tab === 'inventory',
    searchPrefix: debouncedSearch,
  });

  useEffect(() => {
    const tmr = window.setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => window.clearTimeout(tmr);
  }, [searchInput]);

  useEffect(() => {
    if (debouncedSearch.trim().length > 0) {
      setTab('inventory');
    }
  }, [debouncedSearch]);

  /** Données de démo uniquement si explicitement demandé (build prod : laisser false ou absent). */
  const useFictitiousData = import.meta.env.VITE_USE_FICTITIOUS_DATA === 'true';
  const usingDemo =
    useFictitiousData &&
    Boolean(profile?.uid) &&
    !pipelineHook.loading &&
    pipelineHook.residences.length === 0;

  const pipelineRaw = usingDemo
    ? DEMO_LISTINGS.filter((l) => l.status !== 'unsigned')
    : pipelineHook.residences;

  const pipelineListings = useMemo(() => {
    const siloFiltered = pipelineRaw.filter((l) => residenceMatchesNiche(l.assetNiche, activeSilo));
    return filterListingsForRadar(siloFiltered, userSpecialtyKeys);
  }, [pipelineRaw, activeSilo, userSpecialtyKeys]);

  const inventoryRowsLive = inventoryHook.residences;
  const inventoryRowsDemo = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return DEMO_INVENTORY_ALL;
    return DEMO_INVENTORY_ALL.filter(
      (r) =>
        r.address.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [debouncedSearch]);

  const inventoryRowsBase = usingDemo ? inventoryRowsDemo : inventoryRowsLive;

  const inventoryRows = useMemo(() => {
    const siloFiltered = inventoryRowsBase.filter((l) =>
      residenceMatchesNiche(l.assetNiche, activeSilo)
    );
    return filterListingsForRadar(siloFiltered, userSpecialtyKeys);
  }, [inventoryRowsBase, activeSilo, userSpecialtyKeys]);

  const openListing = (l: RadarListingView) => {
    if (l.isLocked) {
      setUpsellType(l.propertyType);
      return;
    }
    if (profile?.uid) setSelectedResidence(l);
  };
  const inventoryLoading = usingDemo ? false : inventoryHook.loading;
  const inventoryHasMore = usingDemo ? false : Boolean(inventoryHook.hasMore);
  const loadMoreInventory = inventoryHook.loadMore ?? (async () => {});

  useEffect(() => {
    if (!profile?.uid || usingDemo) {
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
  }, [profile?.uid, usingDemo]);

  useEffect(() => {
    if (!profile?.uid || pipelineHook.loading) return;
    const id = peekListingsFocusResidenceId();
    if (!id) return;

    const inPipe = pipelineListings.find((l) => l.id === id);
    if (inPipe) {
      consumeListingsFocusResidenceId();
      setSelectedResidence(inPipe);
      return;
    }

    const inInv = inventoryRows.find((l) => l.id === id);
    if (inInv) {
      consumeListingsFocusResidenceId();
      setSelectedResidence(inInv);
      return;
    }

    if (usingDemo) {
      consumeListingsFocusResidenceId();
      return;
    }

    let cancelled = false;
    getResidenceById({ tenantId: profile.uid, mode: 'strict' }, id, { silo: activeSilo }).then((r) => {
      if (cancelled) return;
      consumeListingsFocusResidenceId();
      if (r) {
        setSelectedResidence(r);
        if (r.status === 'unsigned') setTab('inventory');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    profile?.uid,
    pipelineHook.loading,
    usingDemo,
    pipelineListings,
    inventoryRows,
    activeSilo,
    inventoryHook.loading,
  ]);

  if (selectedResidence && profile?.uid) {
    return (
      <div className="space-y-8">
        <ResidenceDetail
          brokerId={profile.uid}
          residence={selectedResidence}
          onClose={() => setSelectedResidence(null)}
        />
      </div>
    );
  }

  const livePipelineCount = pipelineListings.length;
  const liveInventoryCount = inventoryRows.length;

  return (
    <div className="space-y-8">
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
              ? t('Mode démo — données fictives (pipeline + inventaire)', 'Demo mode — sample pipeline + inventory')
              : t('Multi-tenant actif — pipeline chargé par statuts actifs', 'Multi-tenant — pipeline loaded for active statuses')}
          </p>
          <p className="text-[10px] font-mono tracking-tight mt-0.5 opacity-70">
            brokerId={profile?.uid ?? '<non chargé>'} · silo={activeSilo} ·{' '}
            {tab === 'pipeline'
              ? t(`${livePipelineCount} actif(s) pipeline`, `${livePipelineCount} active pipeline`)
              : t(`${liveInventoryCount} ligne(s) affichée(s)`, `${liveInventoryCount} row(s) shown`)}
          </p>
          {!usingDemo && (
            <p className="text-[10px] font-semibold text-emerald-200/80 mt-2 leading-relaxed">
              {t(
                'Inventaire complet : chargement paresseux par paquets de 50 au défilement. Recherche : bascule auto sur la vue liste.',
                'Full inventory: lazy-loaded in batches of 50 on scroll. Search auto-switches to list view.'
              )}
            </p>
          )}
        </div>
      </div>

      {/* Onglets style Cobalt */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label={t('Mode affichage inscriptions', 'Listings display mode')}
          className="flex w-full max-w-xl rounded-2xl border border-blue-500/25 bg-slate-950/40 p-1 shadow-[0_12px_40px_rgba(37,99,235,0.12)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pipeline'}
            onClick={() => setTab('pipeline')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] transition-all',
              tab === 'pipeline'
                ? 'bg-blue-600 text-white shadow-[0_8px_24px_rgba(37,99,235,0.45)]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            )}
          >
            <Zap className="h-4 w-4 shrink-0" />
            {t('Pipeline actif', 'Active pipeline')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'inventory'}
            onClick={() => setTab('inventory')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] transition-all',
              tab === 'inventory'
                ? 'bg-blue-600 text-white shadow-[0_8px_24px_rgba(37,99,235,0.45)]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            )}
          >
            <Landmark className="h-4 w-4 shrink-0" />
            {t('Toutes les inscriptions', 'All listings')}
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-vault px-4 py-2.5 shadow-sm focus-within:border-blue-400 transition-colors sm:max-w-md">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('Recherche (adresse, ville, id)…', 'Search address, city, id…')}
              className="min-w-0 flex-1 bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-0"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-vault px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-300 shadow-sm transition-all hover:bg-white/[0.03]"
            >
              <Filter className="h-4 w-4" />
              {t('Filtres', 'Filters')}
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-blue-600 hover:scale-[1.02] active:scale-95"
            >
              <Plus className="h-4 w-4" />
              {t('Nouv. Inscription', 'New listing')}
            </button>
          </div>
        </div>
      </div>

      {tab === 'pipeline' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 xl:grid-cols-5">
          {PIPELINE_STATUS_KEYS.map((key) => {
            const label = STATUS_LABELS[key];
            const count = pipelineListings.filter((l) => l.status === key).length;
            return (
              <div key={key} className="space-y-4">
                <div className="flex items-center justify-between border-b-2 border-white/10 px-1 pb-2">
                  <span className="text-[11px] font-black uppercase tracking-tighter text-slate-300">
                    {label}
                  </span>
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-[9px] font-black italic text-white">
                    {count}
                  </span>
                </div>

                <div className="space-y-4">
                  {pipelineListings
                    .filter((l) => l.status === key)
                    .map((l) => {
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
                          onClick={() => openListing(l)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openListing(l);
                            }
                          }}
                          whileHover={l.isLocked ? undefined : { y: -4, scale: 1.02 }}
                          className={cn(
                            'group w-full cursor-pointer rounded-xl border-l-4 bg-vault-bright p-5 text-left shadow-sm transition-all hover:shadow-xl',
                            STATUS_BORDERS[key],
                            l.isLocked && 'opacity-75'
                          )}
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <div className="flex h-9 w-9 items-center justify-center rounded bg-blue-500/10 transition-colors group-hover:bg-blue-600">
                              <Home className="h-4 w-4 text-blue-400 group-hover:text-white" />
                            </div>
                            <button
                              type="button"
                              className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                              aria-label={t('Actions', 'Actions')}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                          {l.isLocked ? (
                            <div className="mb-2">
                              <RadarLockBadge propertyType={l.propertyType} locale={locale} />
                            </div>
                          ) : null}
                          {stale && !l.isLocked ? (
                            <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-amber-200">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {t('Action requise — 48 h+ sans IA', 'Action — 48h+ no IA')}
                            </div>
                          ) : null}
                          <p
                            className={cn(
                              'mb-1 text-sm font-black italic tracking-tighter text-slate-300',
                              l.isLocked && 'select-none blur-[5px]'
                            )}
                          >
                            {l.address}
                          </p>
                          <p
                            className={cn(
                              'text-[9px] font-black uppercase tracking-widest text-slate-400',
                              l.isLocked && 'select-none blur-[4px]'
                            )}
                          >
                            {l.city}
                          </p>
                          {!usingDemo && (
                            <div
                              className="mt-3"
                              title={t(
                                'Sentiment client (appels analysés, 7 j)',
                                'Client sentiment from analyzed calls, 7d'
                              )}
                            >
                              <p className="mb-1 text-[8px] font-black uppercase tracking-widest text-slate-500">
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
                                <p className="mt-0.5 text-[8px] font-semibold text-slate-600">—</p>
                              )}
                            </div>
                          )}
                          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                            <span className="text-xs font-black italic text-blue-300">
                              {formatCurrency(l.price)}
                            </span>
                            <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-blue-400" />
                          </div>
                        </motion.div>
                      );
                    })}

                  {count === 0 && (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] py-12 text-center">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 italic">
                        {t('AUCUN ACTIF', '0_ACTIVE')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {t(
              'Vue inventaire — virtualisation + pagination Firestore (50 / page).',
              'Inventory view — virtualization + Firestore pagination (50 per page).'
            )}
          </p>
          <ListingsInventoryVirtual
            rows={inventoryRows}
            loading={inventoryLoading}
            hasMore={inventoryHasMore}
            onLoadMore={loadMoreInventory}
            onOpen={openListing}
            onLockedClick={setUpsellType}
            intelCalls={intelCalls}
            intelMails={intelMails}
            usingDemo={usingDemo}
          />
        </div>
      )}

      {upsellType ? (
        <UpsellModal
          open
          propertyType={upsellType}
          onClose={() => setUpsellType(null)}
        />
      ) : null}
    </div>
  );
}
