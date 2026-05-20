/**
 * Toggle ternaire OUI / NON / — (charte Confort visuel 66+).
 * Composant stabilisé partagé entre Identité, PA et conformité.
 */

import React from 'react';
import type { TernaryBool } from '@primexpert/core/transaction';
import { cn } from '../../lib/utils';

export interface TernaryToggleProps {
  value: TernaryBool;
  onChange: (next: TernaryBool) => void;
  disabled?: boolean;
  language: 'fr' | 'en';
  ariaLabel: string;
}

export function TernaryToggle({
  value,
  onChange,
  disabled = false,
  language,
  ariaLabel,
}: TernaryToggleProps) {
  const items: Array<{ key: string; tile: TernaryBool; label: string }> = [
    { key: 'yes', tile: true, label: language === 'fr' ? 'OUI' : 'YES' },
    { key: 'no', tile: false, label: language === 'fr' ? 'NON' : 'NO' },
    { key: 'unknown', tile: null, label: '—' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-2"
    >
      {items.map(({ key, tile, label }) => {
        const active = value === tile;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(tile)}
            className={cn(
              'min-w-[68px] rounded-xl border-2 px-4 py-2 text-[16px] font-black uppercase tracking-wider transition-colors',
              active
                ? 'border-black bg-black text-white shadow-sm'
                : 'border-black bg-white text-black hover:bg-slate-50',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
