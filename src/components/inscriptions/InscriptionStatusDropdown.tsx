/**
 * Menu déroulant — statut d'inscription (courtage commercial / Off-Market).
 */

import React, { useCallback, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import {
  INSCRIPTION_BROKERAGE_STATUS_OPTIONS,
  isInscriptionStatusEditable,
  labelForInscriptionBrokerageStatus,
  resolveInscriptionBrokerageStatus,
  buildInscriptionBrokerageStatusPatch,
  type InscriptionBrokerageStatus,
  resolveListingSource,
} from '@primexpert/core/residence';
import type { Residence } from '../../services/residences';
import { buildResidenceTenantContext } from '../../services/residences';
import { useAuth } from '../../lib/auth';
import {
  enableManualStatusOverride,
  updateInscriptionStatus,
} from '../../services/inscriptionsService';

export interface InscriptionStatusDropdownProps {
  residence: Residence;
  onUpdated?: (patch: Partial<Residence>) => void;
  className?: string;
}

export function InscriptionStatusDropdown({
  residence,
  onUpdated,
  className,
}: InscriptionStatusDropdownProps) {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const locale = language === 'fr' ? 'fr' : 'en';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localOverride, setLocalOverride] = useState(residence.isManuallyOverridden === true);

  const listingSource = resolveListingSource(residence.listingSource);
  const docLike = {
    listingSource,
    isManuallyOverridden: localOverride || residence.isManuallyOverridden === true,
    status: residence.status,
    statut: residence.statut ?? residence.status,
  };
  const editable = isInscriptionStatusEditable(docLike);
  const currentStatus = resolveInscriptionBrokerageStatus(docLike);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value as InscriptionBrokerageStatus;
      if (!profile?.uid || next === currentStatus) return;
      setSaving(true);
      setError(null);
      try {
        const ctx = buildResidenceTenantContext(profile);
        await updateInscriptionStatus(ctx, residence.id, next);
        setLocalOverride(true);
        const patch = buildInscriptionBrokerageStatusPatch(next);
        onUpdated?.({
          status: patch.status as Residence['status'],
          statut: patch.statut,
          isManuallyOverridden: true,
          lastManualStatusUpdateAt: Date.now(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [profile, currentStatus, residence.id, residence.status, onUpdated]
  );

  const handleEnableOverride = useCallback(async () => {
    if (!profile?.uid) return;
    setSaving(true);
    setError(null);
    try {
      const ctx = buildResidenceTenantContext(profile);
      await enableManualStatusOverride(ctx, residence.id);
      setLocalOverride(true);
      onUpdated?.({ isManuallyOverridden: true, lastManualStatusUpdateAt: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [profile, residence.id, onUpdated]);

  const sourceLabel =
    listingSource === 'off_market'
      ? t('Hors marché (Off-Market)', 'Off-Market')
      : t('Centris (MLS)', 'Centris (MLS)');

  if (!editable) {
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {labelForInscriptionBrokerageStatus(currentStatus, locale)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {sourceLabel}
        </span>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleEnableOverride()}
          className="text-[10px] font-bold uppercase tracking-wide text-[#142c6a] underline underline-offset-2 hover:text-[#2656b7] disabled:opacity-50"
        >
          {t('Modifier manuellement', 'Edit manually')}
        </button>
        {error ? <p className="w-full text-[10px] font-semibold text-red-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <label className="sr-only" htmlFor={`inscription-status-${residence.id}`}>
        {t('Statut d\'inscription', 'Listing status')}
      </label>
      <select
        id={`inscription-status-${residence.id}`}
        value={currentStatus}
        disabled={saving}
        onChange={(e) => void handleChange(e)}
        className="rounded-lg border-2 border-[#142c6a]/30 bg-white px-3 py-1.5 text-[11px] font-bold text-[#142c6a] focus:border-[#D4AF37] focus:outline-none disabled:opacity-60"
      >
        {INSCRIPTION_BROKERAGE_STATUS_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {locale === 'fr' ? opt.labelFr : opt.labelEn}
          </option>
        ))}
      </select>
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
        <Unlock className="h-3 w-3" aria-hidden />
        {sourceLabel}
      </span>
      {error ? <p className="w-full text-[10px] font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
