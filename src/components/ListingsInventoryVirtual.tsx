import React, { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';
import { ListingRow } from './ListingRow';
import type { RadarListingView } from '../lib/radarAccess';
import type { RadarPropertyType } from '../lib/radarAccess';
import type { CallAnalysisRow } from '../services/transcriptionService';
import type { SavedMailboxAnalysis } from '../services/mailboxAnalysis';
import { isListingStale } from '../services/followUpIntel';
import { useLanguage } from '../lib/i18n';

const ROW_ESTIMATE = 52;

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
}

export function ListingsInventoryVirtual({
  rows,
  loading,
  hasMore,
  onLoadMore,
  onOpen,
  intelCalls,
  intelMails,
  usingDemo,
}: ListingsInventoryVirtualProps) {
  const { t, language } = useLanguage();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 12,
  });

  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onScroll = () => {
      if (!hasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 280 && !loading) {
        onLoadMoreRef.current();
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasMore, loading, rows.length]);

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="max-h-[min(70vh,640px)] min-h-[320px] overflow-auto rounded-2xl border border-white/10 bg-vault-bright shadow-inner custom-scrollbar"
    >
      {rows.length === 0 && loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-[11px] font-black uppercase tracking-widest">{t('Chargement…', 'Loading…')}</span>
        </div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-[12px] font-semibold text-slate-500 px-6">
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
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${vi.size}px`,
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <ListingRow
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
      {hasMore && rows.length > 0 && (
        <div className="flex justify-center border-t border-white/10 py-3">
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('Chargement au défilement…', 'Loading as you scroll…')}
          </span>
        </div>
      )}
    </div>
  );
}
