/**
 * Hub Finance — sous-navigation CFO (hub-and-spoke).
 * Charte institutionnelle : fond clair, cartes blanches, texte noir.
 */

import React, { useMemo, useState } from 'react';
import { BarChart3, Coins, Landmark, Microscope, Percent, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { FinanceHubLockProvider } from '../../../context/FinanceHubLockContext';
import { normalizeFinancialData } from '@primexpert/core/financial';
import { isFinanceHubSealed } from '@primexpert/core/diffusion';
import type { Residence } from '../../../services/residences';
import { FinanceHubMasterPanel } from '../finance/FinanceHubMasterPanel';
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
  { id: 'analyse-360', icon: Microscope, labelFr: 'Vérification performance', labelEn: 'Performance verification' },
];

export interface FinanceHubTabProps {
  residence: Residence;
}

function resolveFinanceLockInput(
  doc: Record<string, unknown> | null | undefined
): Parameters<typeof isFinanceHubSealed>[0] {
  if (!doc) return {};
  const promesseRaw = doc.promesseAchat;
  const promesseAchat =
    promesseRaw && typeof promesseRaw === 'object' && !Array.isArray(promesseRaw)
      ? (promesseRaw as {
          statut?: string | null;
          dateNotairePrevue?: string | null;
          dateNotaire?: string | null;
        })
      : null;
  return {
    stage: typeof doc.stage === 'string' ? doc.stage : null,
    status: typeof doc.status === 'string' ? doc.status : null,
    pipelineStatus: typeof doc.pipelineStatus === 'string' ? doc.pipelineStatus : null,
    statut: typeof doc.statut === 'string' ? doc.statut : null,
    promesseAchat,
  };
}

export function FinanceHubTab({ residence }: FinanceHubTabProps) {
  const { language, t } = useLanguage();
  const [subTab, setSubTab] = useState<FinanceSubTab>('bilan');
  const { financialData, loading } = useFinancialData();
  const { residenceDoc } = useResidenceDocument();

  const inputsLocked = useMemo(
    () => isFinanceHubSealed(resolveFinanceLockInput(residenceDoc ?? undefined)),
    [residenceDoc]
  );

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

  const openAnalyse360 = () => setSubTab('analyse-360');

  return (
    <FinanceHubLockProvider inputsLocked={inputsLocked}>
      {inputsLocked ? (
        <div
          role="status"
          className="flex items-start gap-3 border-b-4 border-amber-500 bg-amber-100 px-5 py-4 text-amber-950"
        >
          <ShieldAlert className="h-6 w-6 shrink-0" aria-hidden />
          <p className="text-[15px] font-black uppercase tracking-wide leading-snug">
            {t(
              'Données financières scellées — Transaction en cours',
              'Financial data sealed — Transaction in progress'
            )}
          </p>
        </div>
      ) : null}

      <FinanceHubMasterPanel onOpenAnalyse360={openAnalyse360} residence={residence} />

      {!loading && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-b border-[#142c6a]/15 bg-white px-5 py-3">
          <span
            className={cn(
              'text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border',
              hasFinancials
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border-[#142c6a]/20 bg-slate-50 text-[#142c6a]'
            )}
          >
            {hasFinancials
              ? t('Données V2 actives', 'V2 data active')
              : t('Aucun dataV2', 'No dataV2')}
          </span>
        </div>
      )}

      <motion.div
        role="tablist"
        className="flex gap-2 overflow-x-auto border-b border-[#142c6a]/15 bg-white px-4 py-3"
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
                  ? 'border-[#142c6a] bg-amber-50/80 text-[#142c6a] shadow-sm ring-1 ring-[#142c6a]/20'
                  : 'border-transparent bg-transparent text-slate-600 hover:bg-slate-50 hover:text-[#142c6a]'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', active ? 'text-[#142c6a]' : 'text-slate-500')} />
              {label}
            </button>
          );
        })}
      </motion.div>

      <motion.div key={subTab} role="tabpanel" className="p-5 min-h-[320px] bg-white">
        {panel}
      </motion.div>
    </FinanceHubLockProvider>
  );
}
