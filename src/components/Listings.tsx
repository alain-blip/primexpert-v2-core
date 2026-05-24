import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Filter, ShieldCheck, AlertTriangle, Zap, Landmark } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { peekListingsFocusResidenceId, consumeListingsFocusResidenceId } from '../lib/listingsFocus';
import {
  getResidenceById,
  updateResidencePipelineStatus,
  type Residence,
} from '../services/residences';
import {
  PIPELINE_KANBAN_COLUMNS,
  type PipelineColumnId,
  type ResidenceStatus,
} from '../config/pipelineStages';
import { fetchRecentCallAnalyses, type CallAnalysisRow } from '../services/transcriptionService';
import { fetchRecentMailboxAnalyses, type SavedMailboxAnalysis } from '../services/mailboxAnalysis';
import { ListingsInventoryVirtual } from './ListingsInventoryVirtual';
import {
  institutionalPanelSubtitleClass,
  institutionalPanelTitleClass,
} from '../lib/institutionalTheme';
import { useListingsPipeline, useListingsInventory } from '../hooks/useListings';
import { useSilo } from '../context/SiloContext';
import { residenceMatchesNiche, type AssetNiche } from '../types/residence';
import { filterListingsForRadar, type RadarListingView, type RadarPropertyType } from '../lib/radarAccess';
import { resolveUserSpecialties } from '../lib/userSpecialties';
import { UpsellModal } from './UpsellModal';
import {
  assessMandateCompleteness,
  calculatePipelineColumnTotals,
  residenceMatchesRegionFilter,
} from '@primexpert/core/residence';
import { ListingsPipelineKanban } from './listings/ListingsPipelineKanban';
import { ListingsRegionFilterPanel } from './listings/ListingsRegionFilterPanel';
import { useInstitutionalToast } from '../hooks/useInstitutionalToast';
import { InstitutionalToastBanner } from './residence/diffusion/InstitutionalToastBanner';

const ResidenceDetailLazy = lazy(() =>
  import('./residence/ResidenceDetail').then((m) => ({ default: m.ResidenceDetail }))
);

function ResidenceDetailFallback() {
  const { t } = useLanguage();
  return (
    <div
      className="flex h-[420px] w-full items-center justify-center"
      aria-label={t('Chargement fiche…', 'Loading listing…')}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400/40 border-t-blue-300" />
    </div>
  );
}

/** Colonnes Kanban — SSOT libellés via pipelineStages (slugs Firestore inchangés). */
const PIPELINE_COLUMN_IDS: PipelineColumnId[] = PIPELINE_KANBAN_COLUMNS.map((c) => c.id);

const DEMO_LISTINGS: Residence[] = [
  {
    id: 'demo-1',
    address: '789 Ave Mont-Royal E',
    city: 'Montréal',
    price: 650000,
    status: 'mandate',
    date: '2024-03-15',
    assetNiche: 'RPA',
    commissionRate: 5,
    residenceName: 'Résidence Mont-Royal',
    unitesRPA: 42,
    residenceType: 'RPA',
    region: 'Montréal',
  },
  {
    id: 'demo-2',
    address: '456 Rue De La Commune',
    city: 'Montréal',
    price: 1200000,
    status: 'promise',
    date: '2024-03-10',
    assetNiche: 'PLEX',
    commissionRate: 4,
    residenceType: 'PLEX',
    unitesRPA: 6,
    prixAccepte: 1150000,
    region: 'Montréal',
  },
  {
    id: 'demo-3',
    address: '123 Chemin De La Montagne',
    city: 'Bromont',
    price: 899000,
    status: 'sold',
    date: '2024-02-28',
    assetNiche: 'RPA',
    commissionRate: 5,
    residenceType: 'RPA',
    unitesRPA: 55,
    region: 'Montérégie',
  },
  {
    id: 'demo-4',
    address: '1010 Rue Peel',
    city: 'Montréal',
    price: 450000,
    status: 'prospect',
    date: '2024-03-18',
    assetNiche: 'CPE',
    region: 'Montréal',
  },
  { id: 'demo-5', address: '2200 Bd Rosemont', city: 'Montréal', price: 540000, status: 'expired', date: '2023-12-01', assetNiche: 'PLEX' },
  {
    id: 'demo-commercial-1',
    address: '5000 Rue Sherbrooke O',
    city: 'Montréal',
    price: 2100000,
    status: 'mandate',
    date: '2024-03-20',
    propertyType: 'commercial',
    commissionRate: 3,
  },
  {
    id: 'demo-incomplete',
    address: '88 Rue Incomplete',
    city: 'Montréal',
    price: 780000,
    status: 'mandate',
    date: '2024-03-22',
    assetNiche: 'RPA',
    commissionRate: 5,
    residenceName: 'Mandat à compléter (démo)',
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
  const { activeSilo } = useSilo();
  const { profile } = useAuth();
  const [tab, setTab] = useState<ListingsTab>('pipeline');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedResidence, setSelectedResidence] = useState<Residence | null>(null);
  const [intelCalls, setIntelCalls] = useState<CallAnalysisRow[]>([]);
  const [intelMails, setIntelMails] = useState<SavedMailboxAnalysis[]>([]);
  const [upsellType, setUpsellType] = useState<RadarPropertyType | null>(null);
  const [incompleteMandateFilter, setIncompleteMandateFilter] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [pipelineUpdating, setPipelineUpdating] = useState(false);
  const [demoPipelineRows, setDemoPipelineRows] = useState<Residence[]>(() =>
    DEMO_LISTINGS.filter((l) => l.status !== 'unsigned')
  );
  const { toast, showInfo, showError, dismiss: dismissToast } = useInstitutionalToast();

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
    ? demoPipelineRows
    : pipelineHook.residences;

  useEffect(() => {
    if (usingDemo) {
      setDemoPipelineRows(DEMO_LISTINGS.filter((l) => l.status !== 'unsigned'));
    }
  }, [usingDemo]);

  const pipelineListings = useMemo(() => {
    const siloFiltered = pipelineRaw.filter(
      (l) => residenceMatchesNiche(l.assetNiche, activeSilo) && l.status !== 'expired'
    );
    return filterListingsForRadar(siloFiltered, userSpecialtyKeys);
  }, [pipelineRaw, activeSilo, userSpecialtyKeys]);

  const incompleteMandateCount = useMemo(
    () =>
      pipelineListings.filter((l) => {
        const check = assessMandateCompleteness(l);
        return check.applies && !check.isComplete;
      }).length,
    [pipelineListings]
  );

  const pipelineListingsFiltered = useMemo(() => {
    if (!incompleteMandateFilter) return pipelineListings;
    return pipelineListings.filter((l) => {
      const check = assessMandateCompleteness(l);
      return check.applies && !check.isComplete;
    });
  }, [pipelineListings, incompleteMandateFilter]);

  const columnTotals = useMemo(() => {
    const totals: Partial<Record<PipelineColumnId, ReturnType<typeof calculatePipelineColumnTotals>>> =
      {};
    for (const colId of PIPELINE_COLUMN_IDS) {
      const rows = pipelineListingsFiltered.filter((l) => l.status === colId);
      totals[colId] = calculatePipelineColumnTotals(rows);
    }
    return totals;
  }, [pipelineListingsFiltered]);

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
    const radarFiltered = filterListingsForRadar(siloFiltered, userSpecialtyKeys);
    if (selectedRegions.length === 0) return radarFiltered;
    return radarFiltered.filter((l) => residenceMatchesRegionFilter(l, selectedRegions));
  }, [inventoryRowsBase, activeSilo, userSpecialtyKeys, selectedRegions]);

  const handlePipelineStatusChange = useCallback(
    async (residenceId: string, newStatus: PipelineColumnId, previousStatus: PipelineColumnId) => {
      if (usingDemo) {
        setDemoPipelineRows((prev) =>
          prev.map((r) => (r.id === residenceId ? { ...r, status: newStatus } : r))
        );
        return;
      }
      if (!profile?.uid) return;

      pipelineHook.patchResidenceStatus(residenceId, newStatus);
      setPipelineUpdating(true);
      try {
        await updateResidencePipelineStatus(
          { tenantId: profile.uid, mode: 'strict' },
          residenceId,
          newStatus
        );
      } catch (e) {
        pipelineHook.patchResidenceStatus(residenceId, previousStatus);
        showError(
          e instanceof Error
            ? e.message
            : t('Échec de la mise à jour du statut.', 'Status update failed.')
        );
      } finally {
        setPipelineUpdating(false);
      }
    },
    [usingDemo, profile?.uid, pipelineHook, showError, t]
  );

  const handleBlockedPipelineMove = useCallback(
    (message: string) => {
      showInfo(message);
    },
    [showInfo]
  );

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
        <Suspense fallback={<ResidenceDetailFallback />}>
          <ResidenceDetailLazy
            brokerId={profile.uid}
            residence={selectedResidence}
            onClose={() => setSelectedResidence(null)}
          />
        </Suspense>
      </div>
    );
  }

  const listingsLoadError = pipelineHook.error ?? (tab === 'inventory' ? inventoryHook.error : null);

  const livePipelineCount = pipelineListings.length;
  const liveInventoryCount = inventoryRows.length;

  return (
    <section className="rounded-2xl bg-primexpert-blue p-6 space-y-6">
      <header className="px-1">
        <h1 className={institutionalPanelTitleClass}>{t('Mes inscriptions', 'My listings')}</h1>
        <p className={institutionalPanelSubtitleClass}>
          {t(
            'Pipeline actif et inventaire — cartes coupe-feu institutionnelles.',
            'Active pipeline and inventory — institutional firebreak cards.'
          )}
        </p>
      </header>

      {listingsLoadError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border-2 border-red-500 bg-red-50 px-5 py-3 text-red-900"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <div className="text-[11px] font-medium leading-relaxed">
            <p className="font-black uppercase tracking-[0.16em]">
              {t('Chargement des inscriptions impossible', 'Unable to load listings')}
            </p>
            <p className="mt-1 font-mono text-[10px] opacity-90">{listingsLoadError}</p>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border-2 border-primexpert-dark bg-primexpert-light px-5 py-3 text-primexpert-dark',
          usingDemo && 'border-amber-500 bg-amber-50'
        )}
      >
        {usingDemo ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-800" />
        ) : (
          <ShieldCheck className="h-4 w-4 shrink-0" />
        )}
        <div className="flex-1 min-w-0 text-[11px] font-medium leading-relaxed">
          <p className="font-black uppercase tracking-[0.16em]">
            {usingDemo
              ? t('Mode démo — données fictives', 'Demo mode — sample data')
              : t('Multi-tenant actif', 'Multi-tenant active')}
          </p>
          <p className="font-mono mt-1 text-[10px] opacity-80">
            {tab === 'pipeline'
              ? t(`${livePipelineCount} actif(s) pipeline`, `${livePipelineCount} active pipeline`)
              : t(`${liveInventoryCount} ligne(s) affichée(s)`, `${liveInventoryCount} row(s) shown`)}
            {' · '}
            silo={activeSilo}
            {tab === 'pipeline' && incompleteMandateCount > 0
              ? ` · ${t(
                  `${incompleteMandateCount} dossier(s) incomplet(s)`,
                  `${incompleteMandateCount} incomplete file(s)`
                )}`
              : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label={t('Mode affichage inscriptions', 'Listings display mode')}
          className="flex w-full max-w-xl rounded-xl border-2 border-primexpert-dark bg-primexpert-light p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pipeline'}
            onClick={() => setTab('pipeline')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition',
              tab === 'pipeline'
                ? 'bg-primexpert-dark text-white'
                : 'text-primexpert-dark hover:bg-white'
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
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition',
              tab === 'inventory'
                ? 'bg-primexpert-dark text-white'
                : 'text-primexpert-dark hover:bg-white'
            )}
          >
            <Landmark className="h-4 w-4 shrink-0" />
            {t('Toutes les inscriptions', 'All listings')}
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex w-full min-w-0 items-center gap-3 rounded-xl border-2 border-primexpert-dark bg-white px-4 py-2.5 sm:max-w-md focus-within:ring-2 focus-within:ring-primexpert-gold/40">
            <Search className="h-4 w-4 shrink-0 text-primexpert-dark" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('Recherche (adresse, ville, id)…', 'Search address, city, id…')}
              className="min-w-0 flex-1 bg-transparent text-[10px] font-black uppercase tracking-widest text-primexpert-dark placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {tab === 'pipeline' && incompleteMandateCount > 0 ? (
              <button
                type="button"
                onClick={() => setIncompleteMandateFilter((v) => !v)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition',
                  incompleteMandateFilter
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-red-500 bg-white text-red-800 hover:bg-red-50'
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                {t(
                  `Conformité (${incompleteMandateCount})`,
                  `Compliance (${incompleteMandateCount})`
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={cn(
                'flex items-center gap-2 rounded-xl border-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition',
                selectedRegions.length > 0
                  ? 'border-primexpert-gold bg-amber-50 text-primexpert-dark'
                  : 'border-primexpert-dark bg-primexpert-light text-primexpert-dark hover:bg-white'
              )}
            >
              <Filter className="h-4 w-4" />
              {selectedRegions.length > 0
                ? t(`Filtres (${selectedRegions.length})`, `Filters (${selectedRegions.length})`)
                : t('Filtres', 'Filters')}
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border-2 border-primexpert-dark bg-primexpert-dark px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primexpert-blue"
            >
              <Plus className="h-4 w-4" />
              {t('Nouv. Inscription', 'New listing')}
            </button>
          </div>
        </div>
      </div>

      {toast ? <InstitutionalToastBanner toast={toast} onDismiss={dismissToast} /> : null}

      {tab === 'pipeline' ? (
        <div className="overflow-x-auto pb-1 custom-scrollbar">
          <ListingsPipelineKanban
            columnIds={PIPELINE_COLUMN_IDS}
            listings={pipelineListingsFiltered}
            columnTotals={columnTotals}
            language={language === 'fr' ? 'fr' : 'en'}
            t={t}
            usingDemo={usingDemo}
            updating={pipelineUpdating}
            intelCalls={intelCalls}
            intelMails={intelMails}
            onOpen={openListing}
            onLockedClick={setUpsellType}
            onStatusChange={handlePipelineStatusChange}
            onBlockedMove={handleBlockedPipelineMove}
          />
        </div>
      ) : (
        <ListingsInventoryVirtual
          embedded
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
      )}

      {upsellType ? (
        <UpsellModal open propertyType={upsellType} onClose={() => setUpsellType(null)} />
      ) : null}

      <ListingsRegionFilterPanel
        open={filtersOpen}
        selectedRegions={selectedRegions}
        onChange={setSelectedRegions}
        onClose={() => setFiltersOpen(false)}
        onApply={() => {
          if (selectedRegions.length > 0) setTab('inventory');
        }}
        t={t}
      />
    </section>
  );
}
