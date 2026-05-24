/**
 * Kanban pipeline — glisser-déposer entre colonnes (Phase 2).
 */

import React, { useCallback, useMemo } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { cn } from '../../lib/utils';
import { ListingInstitutionalCard } from '../ListingInstitutionalCard';
import type { RadarListingView, RadarPropertyType } from '../../lib/radarAccess';
import type { CallAnalysisRow } from '../../services/transcriptionService';
import type { SavedMailboxAnalysis } from '../../services/mailboxAnalysis';
import { isListingStale } from '../../services/followUpIntel';
import { getPipelineColumnLabel, type PipelineColumnId } from '../../config/pipelineStages';
import {
  formatListingMoneyCad,
  validatePipelineColumnMove,
  type PipelineColumnTotals,
} from '@primexpert/core/residence';

export interface ListingsPipelineKanbanProps {
  columnIds: PipelineColumnId[];
  listings: RadarListingView[];
  columnTotals: Partial<Record<PipelineColumnId, PipelineColumnTotals>>;
  language: 'fr' | 'en';
  t: (fr: string, en: string) => string;
  usingDemo: boolean;
  updating?: boolean;
  intelCalls: CallAnalysisRow[];
  intelMails: SavedMailboxAnalysis[];
  onOpen: (r: RadarListingView) => void;
  onLockedClick: (propertyType: RadarPropertyType) => void;
  onStatusChange: (
    residenceId: string,
    newStatus: PipelineColumnId,
    previousStatus: PipelineColumnId
  ) => void | Promise<void>;
  onBlockedMove: (message: string) => void;
}

function groupByColumn(
  listings: RadarListingView[],
  columnIds: PipelineColumnId[]
): Record<PipelineColumnId, RadarListingView[]> {
  const groups = Object.fromEntries(columnIds.map((id) => [id, [] as RadarListingView[]])) as Record<
    PipelineColumnId,
    RadarListingView[]
  >;
  for (const listing of listings) {
    const col = listing.status as PipelineColumnId;
    if (groups[col]) groups[col].push(listing);
  }
  return groups;
}

export function ListingsPipelineKanban({
  columnIds,
  listings,
  columnTotals,
  language,
  t,
  usingDemo,
  updating = false,
  intelCalls,
  intelMails,
  onOpen,
  onLockedClick,
  onStatusChange,
  onBlockedMove,
}: ListingsPipelineKanbanProps) {
  const columns = useMemo(() => groupByColumn(listings, columnIds), [listings, columnIds]);

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) {
        return;
      }

      const sourceColumn = source.droppableId as PipelineColumnId;
      const destColumn = destination.droppableId as PipelineColumnId;
      if (sourceColumn === destColumn) return;

      const dragged = columns[sourceColumn]?.[source.index];
      if (!dragged) return;

      const validation = validatePipelineColumnMove(dragged, destColumn);
      if (!validation.allowed) {
        const msg =
          language === 'fr'
            ? validation.messageFr ?? validation.messageEn ?? ''
            : validation.messageEn ?? validation.messageFr ?? '';
        if (msg) onBlockedMove(msg);
        return;
      }

      void onStatusChange(draggableId, destColumn, sourceColumn);
    },
    [columns, language, onBlockedMove, onStatusChange]
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div
        className={cn(
          'grid min-w-[980px] grid-cols-4 gap-4',
          updating && 'pointer-events-none opacity-90'
        )}
      >
        {columnIds.map((key) => {
          const label = getPipelineColumnLabel(key, language);
          const columnRows = columns[key] ?? [];
          const count = columnRows.length;
          const totals = columnTotals[key] ?? {
            totalPrice: 0,
            totalCommission: 0,
            countWithCommission: 0,
            countTotal: 0,
          };

          return (
            <div key={key} className="min-w-0 space-y-2">
              <div className="space-y-1 border-b-2 border-white/30 px-1 pb-2">
                <div className="flex items-center justify-between">
                  <span className="truncate text-[11px] font-black uppercase tracking-tight text-white">
                    {label}
                  </span>
                  <span className="ml-2 flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded bg-primexpert-dark px-1.5 text-[10px] font-black text-white">
                    {count}
                  </span>
                </div>
                {totals.totalPrice > 0 ? (
                  <div className="text-[10px] leading-snug text-white/90">
                    <p className="font-black text-white">
                      {t('Cette colonne vaut', 'This column totals')}:{' '}
                      {formatListingMoneyCad(totals.totalPrice)}
                    </p>
                    {totals.totalCommission > 0 ? (
                      <p className="font-semibold text-emerald-200">
                        {t('Commissions estimées', 'Estimated commissions')}:{' '}
                        {formatListingMoneyCad(totals.totalCommission)}
                        <span className="ml-1 font-normal text-white/70">
                          ({totals.countWithCommission}/{count})
                        </span>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <Droppable droppableId={key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'min-h-[120px] rounded-xl transition-colors',
                      snapshot.isDraggingOver && 'bg-white/15 ring-2 ring-white/40'
                    )}
                  >
                    {columnRows.map((l, index) => {
                      const stale = !usingDemo && isListingStale(l, intelCalls, intelMails);

                      return (
                        <Draggable
                          key={l.id}
                          draggableId={l.id}
                          index={index}
                          isDragDisabled={Boolean(l.isLocked)}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={cn(
                                dragSnapshot.isDragging && 'rotate-1 scale-[1.02] shadow-2xl'
                              )}
                            >
                              <ListingInstitutionalCard
                                residence={l}
                                onOpen={onOpen}
                                isLocked={l.isLocked}
                                propertyType={l.propertyType}
                                onLockedClick={onLockedClick}
                                stale={stale}
                                t={t}
                                language={language}
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    })}

                    {count === 0 ? (
                      <p className="rounded-xl border-2 border-dashed border-white/40 bg-white/10 py-8 text-center text-[10px] font-black uppercase tracking-widest text-white/80">
                        {t('Aucun actif', 'No active')}
                      </p>
                    ) : null}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
