/**
 * Panneau filtres régions — inventaire Mes inscriptions (Phase 2).
 * Rendu via portail pour échapper au overflow-hidden / transform du Workhub.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { QUEBEC_REGIONS } from '@primexpert/core/residence';

export interface ListingsRegionFilterPanelProps {
  open: boolean;
  selectedRegions: string[];
  onChange: (regions: string[]) => void;
  onClose: () => void;
  onApply?: () => void;
  t: (fr: string, en: string) => string;
}

export function ListingsRegionFilterPanel({
  open,
  selectedRegions,
  onChange,
  onClose,
  onApply,
  t,
}: ListingsRegionFilterPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const toggleRegion = (region: string) => {
    if (selectedRegions.includes(region)) {
      onChange(selectedRegions.filter((r) => r !== region));
    } else {
      onChange([...selectedRegions, region]);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 p-4 pt-16 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={t('Filtres régions', 'Region filters')}
      onClick={onClose}
    >
      <div
        className="relative z-[10000] w-full max-w-lg rounded-2xl border-2 border-primexpert-dark bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-primexpert-dark px-5 py-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-primexpert-dark">
              {t('Filtres — Régions administratives', 'Filters — Administrative regions')}
            </h2>
            <p className="mt-1 text-[11px] font-medium text-slate-600">
              {t(
                'Sélection multiple — inventaire et recherche.',
                'Multi-select — inventory and search.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border-2 border-primexpert-dark p-1.5 text-primexpert-dark hover:bg-primexpert-light"
            aria-label={t('Fermer', 'Close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(50vh,420px)] overflow-y-auto px-5 py-4 custom-scrollbar">
          <ul className="space-y-1">
            {QUEBEC_REGIONS.map((region) => {
              const checked = selectedRegions.includes(region);
              return (
                <li key={region}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-[12px] font-semibold transition',
                      checked
                        ? 'border-primexpert-dark bg-primexpert-light text-primexpert-dark'
                        : 'border-slate-200 text-slate-700 hover:border-primexpert-dark/40'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRegion(region)}
                      className="h-4 w-4 accent-primexpert-dark"
                    />
                    {region}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 border-t-2 border-primexpert-dark px-5 py-4">
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-primexpert-dark"
          >
            {t('Effacer tout', 'Clear all')}
          </button>
          <button
            type="button"
            onClick={() => {
              onApply?.();
              onClose();
            }}
            className="rounded-xl border-2 border-primexpert-dark bg-primexpert-dark px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primexpert-blue"
          >
            {t('Appliquer', 'Apply')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
