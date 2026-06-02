/**
 * Sélecteur de contexte de propriété — Synthèse 360° (v3.5).
 * Persiste `propertyContext` sur `residences/{id}` après confirmation humaine.
 */

import React, { useCallback, useState } from 'react';
import { AlertTriangle, Layers } from 'lucide-react';
import {
  PROPERTY_CONTEXTS,
  propertyContextSelectorLabel,
  type PropertyContext,
} from '@primexpert/core/canonical';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import {
  institutionalListingsCardShellClass,
  institutionalListingsCardHeaderClass,
  institutionalListingsCardTitleClass,
} from '../../lib/institutionalTheme';

export interface PropertyContextSelectorProps {
  value: PropertyContext;
  onConfirmChange: (next: PropertyContext) => Promise<void>;
  saving?: boolean;
  disabled?: boolean;
}

function PropertyContextConfirmModal({
  open,
  pendingLabel,
  busy,
  onCancel,
  onConfirm,
  t,
}: {
  open: boolean;
  pendingLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  t: (fr: string, en: string) => string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="property-context-confirm-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border-4 border-amber-500 bg-white shadow-2xl overflow-hidden">
        <div className="bg-amber-500 px-6 py-6 flex flex-col items-center text-center text-amber-950">
          <AlertTriangle className="h-10 w-10" aria-hidden />
          <p className="mt-3 text-[11px] font-black uppercase tracking-[0.2em]">
            {t('Changement de catégorie', 'Category change')}
          </p>
        </div>
        <div className="px-6 py-6 space-y-4 text-[#142c6a]">
          <h2 id="property-context-confirm-title" className="text-lg font-black text-center">
            {t('Confirmer le nouveau contexte', 'Confirm new context')}
          </h2>
          <p className="text-[14px] font-semibold leading-relaxed text-center">
            {pendingLabel}
          </p>
          <p className="text-[14px] font-semibold leading-relaxed">
            {t(
              'Attention, modifier la catégorie de cette propriété réorganise vos onglets et réinitialise la méthode d\'analyse comparative de marché (ACM). Souhaitez-vous continuer ?',
              'Warning: changing this property category reorganizes your tabs and resets the comparative market analysis (CMA) method. Do you wish to continue?'
            )}
          </p>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-700 disabled:opacity-50"
            >
              {t('Annuler', 'Cancel')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="rounded-lg border-2 border-[#142c6a] bg-[#142c6a] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50"
            >
              {busy ? t('Enregistrement…', 'Saving…') : t('Confirmer', 'Confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PropertyContextSelector({
  value,
  onConfirmChange,
  saving = false,
  disabled = false,
}: PropertyContextSelectorProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const [pending, setPending] = useState<PropertyContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = useCallback(
    (next: PropertyContext) => {
      if (disabled || saving || next === value) return;
      setError(null);
      setPending(next);
    },
    [disabled, saving, value]
  );

  const handleCancel = useCallback(() => {
    setPending(null);
    setError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pending) return;
    setError(null);
    try {
      await onConfirmChange(pending);
      setPending(null);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setError(
        t(`Échec de l'enregistrement (${detail}).`, `Save failed (${detail}).`)
      );
    }
  }, [pending, onConfirmChange, t]);

  const pendingLabel = pending
    ? propertyContextSelectorLabel(pending, locale)
    : '';

  return (
    <>
      <section className={institutionalListingsCardShellClass} aria-labelledby="property-context-heading">
        <header className={institutionalListingsCardHeaderClass}>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#142c6a]" aria-hidden />
            <div>
              <p className={institutionalListingsCardTitleClass}>
                {t('Catégorie de propriété', 'Property category')}
              </p>
              <h3
                id="property-context-heading"
                className="mt-0.5 text-[13px] font-semibold text-slate-700"
              >
                {t(
                  'Contexte d\'exploitation — détermine les onglets et la méthode d\'analyse comparative de marché (ACM)',
                  'Operating context — drives tabs and comparative market analysis (CMA) method'
                )}
              </h3>
            </div>
          </div>
        </header>
        <div className="p-4">
          <fieldset disabled={disabled || saving} className="space-y-2">
            <legend className="sr-only">
              {t('Sélection du contexte de propriété', 'Property context selection')}
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROPERTY_CONTEXTS.map((ctx) => {
                const selected = value === ctx;
                const label = propertyContextSelectorLabel(ctx, locale);
                return (
                  <label
                    key={ctx}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 transition',
                      selected
                        ? 'border-[#142c6a] bg-[#eef2fb] shadow-sm'
                        : 'border-[#142c6a]/15 bg-white hover:border-[#142c6a]/40',
                      (disabled || saving) && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <input
                      type="radio"
                      name="propertyContext"
                      value={ctx}
                      checked={selected}
                      onChange={() => handleSelect(ctx)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#142c6a]"
                    />
                    <span className="text-[12px] font-bold leading-snug text-black">{label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {error ? (
            <p className="mt-3 text-[12px] font-bold text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <PropertyContextConfirmModal
        open={pending != null}
        pendingLabel={pendingLabel}
        busy={saving}
        onCancel={handleCancel}
        onConfirm={() => void handleConfirm()}
        t={t}
      />
    </>
  );
}
