import React, { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';
import { ListingInstitutionalCard } from './ListingInstitutionalCard';
import type { RadarListingView } from '../lib/radarAccess';
import type { RadarPropertyType } from '../lib/radarAccess';
import type { CallAnalysisRow } from '../services/transcriptionService';
import type { SavedMailboxAnalysis } from '../services/mailboxAnalysis';
import { isListingStale } from '../services/followUpIntel';
import { useLanguage } from '../lib/i18n';
import {
  institutionalPanelSubtitleClass,
  institutionalPanelTitleClass,
} from '../lib/institutionalTheme';

/** Hauteur estimée carte coupe-feu (4 lignes + bannière). */
const ROW_ESTIMATE = 180;

export interface ListingsInventoryVirtualProps {
  rows: RadarListingView[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onOpen: (r: RadarListingView) => void;
  onLockedClick: (propertyType: RadarPropertyType) => void;
  intelCalls: CallAnalysisRow[];
  intelMails: SavedMailboxAnalysis[];
  usingDemo: boolean;
  /** Intégré dans le panneau bleu parent (Mes inscriptions). */
  embedded?: boolean;
}

export function ListingsInventoryVirtual({
  rows,
  loading,
  hasMore,
  onLoadMore,
  onOpen,
  onLockedClick,
  intelCalls,
  intelMails,
  usingDemo,
  embedded = false,
}: ListingsInventoryVirtualProps) {
  const { t, language } = useLanguage();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 6,
  });

  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onScroll = () => {
      if (!hasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 320 && !loading) {
        onLoadMoreRef.current();
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasMore, loading, rows.length]);

  const items = virtualizer.getVirtualItems();

  const listBody = (
    <div
      ref={parentRef}
        className="max-h-[min(70vh,720px)] min-h-[320px] overflow-auto custom-scrollbar px-1"
      >
        {rows.length === 0 && loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[11px] font-black uppercase tracking-widest">
              {t('Chargement…', 'Loading…')}
            </span>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm font-semibold text-white/90 px-6">
            {t('Aucune inscription à afficher.', 'No listings to display.')}
          </p>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {items.map((vi) => {
              const row = rows[vi.index];
              if (!row) return null;
              const stale = !usingDemo && isListingStale(row, intelCalls, intelMails);
              return (
                <div
                  key={row.id}
                  ref={virtualizer.measureElement}
                  data-index={vi.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vi.start}px)`,
                  }}
                  className="px-1 pb-2"
                >
                  <ListingInstitutionalCard
                    residence={row}
                    onOpen={onOpen}
                    isLocked={row.isLocked}
                    propertyType={row.propertyType}
                    onLockedClick={onLockedClick}
                    stale={stale}
                    t={t}
                    language={language}
                  />
                </div>
              );
            })}
          </div>
        )}
        {hasMore && rows.length > 0 ? (
          <div className="flex justify-center py-4">
            <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/80">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('Chargement au défilement…', 'Loading as you scroll…')}
            </span>
          </div>
        ) : null}
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/90 font-medium px-1">
          {t(
            'Inventaire complet — virtualisation, paquets de 50 au défilement.',
            'Full inventory — virtualization, 50-item batches on scroll.'
          )}
        </p>
        {listBody}
      </div>
    );
  }

  return (
    <section className="rounded-2xl bg-primexpert-blue p-6">
      <header className="mb-5 px-1">
        <h2 className={institutionalPanelTitleClass}>
          {t('Inventaire — toutes les inscriptions', 'Inventory — all listings')}
        </h2>
        <p className={institutionalPanelSubtitleClass}>
          {t(
            'Virtualisation · paquets de 50 · cartes coupe-feu institutionnelles.',
            'Virtualization · batches of 50 · institutional firebreak cards.'
          )}
        </p>
      </header>
      {listBody}
    </section>
  );
}
