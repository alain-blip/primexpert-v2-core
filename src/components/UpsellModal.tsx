/**
 * Modal d’upsell — extension Plex ou Commercial manquante.
 */

import React from 'react';
import { X, Lock, Shield } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { useWorkhubNav } from '../lib/workhubNav';
import { requestOpenFinanceTab } from '../lib/financeNavigation';
import { upsellExtensionLabel, type RadarPropertyType } from '../lib/radarAccess';
import { useAuth } from '../lib/auth';

interface UpsellModalProps {
  open: boolean;
  propertyType: RadarPropertyType;
  onClose: () => void;
}

export function UpsellModal({ open, propertyType, onClose }: UpsellModalProps) {
  const { t, language } = useLanguage();
  const workhubNav = useWorkhubNav();
  const { profile } = useAuth();
  const locale = language === 'fr' ? 'fr' : 'en';
  const extension = upsellExtensionLabel(propertyType, locale);
  const isDirector = profile?.role === 'admin_system';

  if (!open) return null;

  const handleUpgrade = () => {
    requestOpenFinanceTab();
    workhubNav?.setActiveTab('settings');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#FACC15]/40 bg-slate-950 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-500 hover:text-white"
          aria-label={t('Fermer', 'Close')}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#FACC15]/50 bg-[#FACC15]/10">
            <Lock className="h-6 w-6 text-[#FACC15]" aria-hidden />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[#FACC15]">
              {t('Extension requise', 'Extension required')}
            </p>
            <h2 className="text-lg font-black text-white">{extension}</h2>
          </div>
        </div>

        <p className="text-sm font-semibold leading-relaxed text-slate-300">
          {propertyType === 'commercial'
            ? t(
                'Débloquez les fiches commerciales : données hors-marché, historique des loyers et export pour vos présentations CMA.',
                'Unlock commercial listings: off-market data, rent history, and exports for your CMA presentations.'
              )
            : t(
                'Débloquez le silo Plex : multilogements, indicateurs de rétention et fiches sectorielles exportables pour vos mandats.',
                'Unlock the Plex silo: multi-unit metrics, retention indicators, and exportable sector sheets for your mandates.'
              )}
        </p>

        <button
          type="button"
          onClick={handleUpgrade}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#FACC15] bg-[#FACC15]/15 px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#FACC15] transition hover:bg-[#FACC15]/25"
        >
          <Shield className="h-4 w-4 shrink-0" aria-hidden />
          {isDirector
            ? t('Accéder à la Finance', 'Open Finance')
            : t('Voir les forfaits (Paramètres)', 'View plans (Settings)')}
        </button>

        {!isDirector ? (
          <p className="mt-3 text-center text-[9px] font-semibold text-slate-500">
            {t(
              'Contactez votre direction pour activer cette extension sur votre compte.',
              'Contact your organization admin to enable this extension on your account.'
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
