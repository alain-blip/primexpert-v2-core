/**
 * Formulaire de création d'inscription — sélecteur Centris / hors marché (Off-Market).
 */

import React, { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { buildResidenceTenantContext } from '../../services/residences';
import {
  createInscription,
  type ListingSource,
} from '../../services/inscriptionsService';
import {
  INSCRIPTION_BROKERAGE_STATUS_OPTIONS,
  type InscriptionBrokerageStatus,
} from '@primexpert/core/residence';
import type { AssetNiche } from '../../types/residence';

export interface CreateInscriptionFormProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (inscriptionId: string) => void;
}

const NICHE_OPTIONS: { id: AssetNiche; labelFr: string; labelEn: string }[] = [
  { id: 'RPA', labelFr: 'Résidence pour aînés (RPA)', labelEn: 'Retirement home (RPA)' },
  { id: 'CPE', labelFr: 'Copropriété / CPE', labelEn: 'Condo / CPE' },
  { id: 'PLEX', labelFr: 'Plex / multilogement', labelEn: 'Plex / multi-unit' },
];

export function CreateInscriptionForm({ open, onClose, onCreated }: CreateInscriptionFormProps) {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const locale = language === 'fr' ? 'fr' : 'en';

  const [listingSource, setListingSource] = useState<ListingSource>('centris');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [price, setPrice] = useState('');
  const [assetNiche, setAssetNiche] = useState<AssetNiche>('RPA');
  const [initialStatus, setInitialStatus] = useState<InscriptionBrokerageStatus>('active');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setListingSource('centris');
    setAddress('');
    setCity('');
    setPrice('');
    setAssetNiche('RPA');
    setInitialStatus('active');
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!profile?.uid) return;
      setSubmitting(true);
      setError(null);
      try {
        const ctx = buildResidenceTenantContext(profile);
        const parsedPrice = price.trim() ? Number(price.replace(/\s/g, '').replace(',', '.')) : 0;
        const result = await createInscription(ctx, {
          listingSource,
          address,
          city,
          price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
          assetNiche,
          initialStatus: listingSource === 'off_market' ? initialStatus : undefined,
        });
        onCreated?.(result.id);
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [
      profile,
      listingSource,
      address,
      city,
      price,
      assetNiche,
      initialStatus,
      onCreated,
      handleClose,
    ]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-inscription-title"
    >
      <div className="w-full max-w-lg rounded-2xl border-2 border-[#142c6a]/20 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4AF37]">
              {t('Mes inscriptions', 'My listings')}
            </p>
            <h2 id="create-inscription-title" className="text-lg font-black text-[#142c6a]">
              {t('Nouvelle inscription', 'New listing')}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label={t('Fermer', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-[#142c6a]">
              {t('Source de l\'inscription', 'Listing source')}
            </label>
            <select
              value={listingSource}
              onChange={(e) => setListingSource(e.target.value as ListingSource)}
              className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold text-[#142c6a] focus:border-[#D4AF37] focus:outline-none"
            >
              <option value="centris">{t('Centris (MLS)', 'Centris (MLS)')}</option>
              <option value="off_market">
                {t('Hors marché (Off-Market)', 'Off-Market (private)')}
              </option>
            </select>
            {listingSource === 'off_market' ? (
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {t(
                  'Fiche privée — statut éditable manuellement. Les rapports PDF porteront la mention « DOCUMENT CONFIDENTIEL — DIFFUSION RESTREINTE ».',
                  'Private listing — status editable manually. PDF reports will show « CONFIDENTIAL DOCUMENT — RESTRICTED DISTRIBUTION ».'
                )}
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-slate-600">
                {t(
                  'Synchronisation Centris — le statut est piloté par le flux MLS (override manuel possible).',
                  'Centris sync — status driven by MLS feed (manual override available).'
                )}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {t('Adresse', 'Address')}
              </label>
              <input
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {t('Ville', 'City')}
              </label>
              <input
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {t('Prix demandé ($)', 'Asking price ($)')}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {t('Classe d\'actif', 'Asset class')}
              </label>
              <select
                value={assetNiche}
                onChange={(e) => setAssetNiche(e.target.value as AssetNiche)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {NICHE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {locale === 'fr' ? opt.labelFr : opt.labelEn}
                  </option>
                ))}
              </select>
            </div>
            {listingSource === 'off_market' ? (
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  {t('Statut initial', 'Initial status')}
                </label>
                <select
                  value={initialStatus}
                  onChange={(e) =>
                    setInitialStatus(e.target.value as InscriptionBrokerageStatus)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {INSCRIPTION_BROKERAGE_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {locale === 'fr' ? opt.labelFr : opt.labelEn}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-700"
            >
              {t('Annuler', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                'rounded-xl border-2 border-[#142c6a] bg-[#142c6a] px-5 py-2 text-[11px] font-black uppercase tracking-widest text-white',
                'hover:bg-[#2656b7] disabled:opacity-60'
              )}
            >
              {submitting
                ? t('Création…', 'Creating…')
                : t('Créer l\'inscription', 'Create listing')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
