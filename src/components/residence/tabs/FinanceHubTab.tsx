/**
 * Hub Finance — sous-navigation CFO (hub-and-spoke).
 * Charte institutionnelle : fond clair, cartes blanches, texte noir.
 */

import React, { useMemo, useState } from 'react';
import { BarChart3, Coins, Landmark, Microscope, Percent } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { normalizeFinancialData } from '@primexpert/core/financial';
import type { Residence } from '../../../services/residences';
import { BilanExecutifTab } from './BilanExecutifTab';
import { RevenusDepensesTab } from './RevenusDepensesTab';
import { FinancabiliteTab } from './FinancabiliteTab';
import { Analyse360FinanceTab } from './Analyse360FinanceTab';
import { PerformanceRatiosTab } from '../../financial/PerformanceRatiosTab';

export type FinanceSubTab =
  | 'bilan'
  | 'revenus-depenses'
  | 'financabilite'
  | 'ratios'
  | 'analyse-360';

const SUB_TABS: {
  id: FinanceSubTab;
  icon: typeof BarChart3;
  labelFr: string;
  labelEn: string;
}[] = [
  { id: 'bilan', icon: BarChart3, labelFr: 'Bilan exécutif', labelEn: 'Executive summary' },
  { id: 'revenus-depenses', icon: Coins, labelFr: 'Revenus & Dépenses', labelEn: 'Revenue & expenses' },
  { id: 'financabilite', icon: Landmark, labelFr: 'Finançabilité', labelEn: 'Financing' },
  { id: 'ratios', icon: Percent, labelFr: 'Ratios performance', labelEn: 'Performance ratios' },
  { id: 'analyse-360', icon: Microscope, labelFr: 'Audit performance', labelEn: 'Performance audit' },
];

export interface FinanceHubTabProps {
  residence: Residence;
}

export function FinanceHubTab({ residence }: FinanceHubTabProps) {
  const { language, t } = useLanguage();
  const [subTab, setSubTab] = useState<FinanceSubTab>('bilan');
  const { financialData, loading } = useFinancialData();

  const hasFinancials = useMemo(() => {
    const hints = { prixDemande: residence.price, askingPrice: residence.price };
    return normalizeFinancialData(financialData, hints).hasFinancials;
  }, [financialData, residence.price]);

  const panel = useMemo(() => {
    switch (subTab) {
      case 'bilan':
        return <BilanExecutifTab residence={residence} />;
      case 'revenus-depenses':
        return <RevenusDepensesTab residence={residence} />;
      case 'financabilite':
        return <FinancabiliteTab residence={residence} />;
      case 'ratios':
        return <PerformanceRatiosTab residence={residence} />;
      case 'analyse-360':
        return <Analyse360FinanceTab residence={residence} />;
      default:
        return null;
    }
  }, [subTab, residence]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden">
      {/* En-tête Hub */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">
          {t('Hub Finance institutionnel', 'Institutional Finance Hub')}
        </p>
        {!loading && (
          <span
            className={cn(
              'text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border',
              hasFinancials
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-slate-100 text-slate-600'
            )}
          >
            {hasFinancials
              ? t('Données V2 actives', 'V2 data active')
              : t('Aucun dataV2', 'No dataV2')}
          </span>
        )}
      </div>

      {/* Sous-onglets */}
      <div
        role="tablist"
        className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3"
        aria-label={t('Sous-onglets finance', 'Finance sub-tabs')}
      >
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          const label = language === 'fr' ? tab.labelFr : tab.labelEn;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(tab.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[10px] font-bold uppercase tracking-wide border transition',
                active
                  ? 'border-slate-300 bg-white text-[#000000] shadow-sm ring-1 ring-slate-200'
                  : 'border-transparent bg-transparent text-slate-600 hover:bg-slate-50 hover:text-[#000000]'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', active ? 'text-slate-800' : 'text-slate-500')} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Contenu onglet actif */}
      <div key={subTab} role="tabpanel" className="bg-slate-50 p-5 min-h-[320px]">
        {panel}
      </div>
    </div>
  );
}
