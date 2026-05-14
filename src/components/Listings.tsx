import React, { useEffect, useMemo, useState } from 'react';
import { Home, Plus, Search, Filter, MoreVertical, MapPin, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { listResidences, type Residence } from '../services/residences';

const STATUS_LABELS = {
  prospect: "01 / Prospection",
  mandate: "02 / En Mandat",
  promise: "03 / En Promesse",
  expired: "04 / Expirés",
  unsigned: "05 / Non signé",
  sold: "06 / Vendu"
};

const STATUS_COLORS = {
  prospect: "bg-orange-50 text-orange-700 border-orange-200",
  mandate: "bg-blue-500/10 text-blue-300 border-blue-200",
  promise: "bg-amber-500/[0.06] text-amber-400 border-amber-500/20",
  expired: "bg-red-50 text-red-700 border-red-200",
  unsigned: "bg-gray-100 text-gray-700 border-gray-200",
  sold: "bg-green-500/10 text-green-700 border-green-200"
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

  return (
    <div className="space-y-8">
      {/* Multi-tenant status banner — preuve de vie Phase B */}
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-sm',
          usingDemo
            ? 'border-amber-500/20 bg-amber-50/70 text-amber-300'
            : 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
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
            brokerId={profile?.uid ?? '<non chargé>'} · {liveCount} {t('résidence(s) Firestore', 'Firestore listing(s)')}
          </p>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-[#0F172A]/65 backdrop-blur-md px-5 py-2.5 rounded-xl border border-gray-200 shadow-sm w-full md:w-96 group focus-within:border-blue-400 transition-colors">
          <Search className="w-4 h-4 text-gray-400 group-focus-within:text-blue-400" />
          <input 
            type="text" 
            placeholder="Rechercher une propriété..." 
            className="text-[10px] font-black uppercase tracking-widest bg-transparent border-none focus:ring-0 w-full placeholder:text-gray-300"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-[#0F172A]/65 backdrop-blur-md text-gray-900 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-all border border-gray-200 shadow-sm">
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
              <div className="flex items-center justify-between px-1 border-b-2 border-gray-200 pb-2">
                <span className="text-[11px] font-black uppercase tracking-tighter text-gray-900">{label}</span>
                <span className="bg-gray-900 text-white text-[9px] font-black w-5 h-5 rounded flex items-center justify-center italic">{count}</span>
              </div>

              <div className="space-y-4">
                {listings.filter(l => l.status === key).map((l) => (
                  <motion.div
                    key={l.id}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className={cn(
                      "bg-[#0F172A]/65 backdrop-blur-md p-5 rounded-xl border-l-4 shadow-sm hover:shadow-xl transition-all cursor-pointer group",
                      STATUS_BORDERS[key as keyof typeof STATUS_BORDERS]
                    )}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-9 h-9 rounded bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                        <Home className="w-4 h-4 text-blue-400 group-hover:text-white" />
                      </div>
                      <MoreVertical className="w-4 h-4 text-gray-300 hover:text-gray-900" />
                    </div>
                    <p className="text-sm font-black text-gray-900 italic tracking-tighter mb-1 leading-tight">{l.address}</p>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{l.city}</p>
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-50">
                      <span className="text-xs font-black text-blue-300 italic">{formatCurrency(l.price)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-blue-400" />
                    </div>
                  </motion.div>
                ))}
                
                {count === 0 && (
                  <div className="py-12 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                    <p className="text-[9px] text-gray-300 font-black uppercase tracking-[0.2em] italic">{t('AUCUN ACTIF', '0_ACTIVE')}</p>
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
