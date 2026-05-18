/**
 * Revenus & Dépenses — Grille CPA lecture seule (Phase 3b).
 * SSOT : buildRevenusDepensesGrid() + useFinancialData() — zéro calcul local.
 */

import React, { useMemo } from 'react';
import { Coins, Info, ShieldCheck, ShieldOff } from 'lucide-react';
import { buildRevenusDepensesGrid } from '@primexpert/core/financial';
import { formatCurrency as formatCurrencyCore } from '@primexpert/core/utils/formatting';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { ProvenanceStrip } from '../../financial/ProvenanceStrip';
import {
  inst,
  InstitutionalKpi,
  InstitutionalPageHeader,
} from '../institutional/InstitutionalUi';
import type { Residence } from '../../../services/residences';

export interface RevenusDepensesTabProps {
  residence: Residence;
}

function fmt(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) ? formatCurrencyCore(n, { fallback: '—' }) : '—';
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(1).replace('.', ',')} %`;
}

function gapStyle(declaredPct: number | null, marketPct: number | null): string {
  if (declaredPct == null || marketPct == null) return 'text-[#000000]';
  const gap = declaredPct - marketPct;
  if (gap > 3) return 'text-amber-700';
  if (gap < -3) return 'text-emerald-700';
  return 'text-[#000000]';
}

export function RevenusDepensesTab({ residence }: RevenusDepensesTabProps) {
  const { t } = useLanguage();
  const { financialData, loading, error, isInProvider } = useFinancialData();

  const residenceHints = useMemo(
    () => ({
      ...residence,
      prixDemande: residence.price,
      askingPrice: residence.price,
    }),
    [residence]
  );

  const grid = useMemo(
    () => buildRevenusDepensesGrid(financialData, residenceHints),
    [financialData, residenceHints]
  );

  if (!isInProvider) {
    return <div className={inst.alertAmber}>{t('Provider financier manquant.', 'Financial provider missing.')}</div>;
  }

  if (loading) {
    return (
      <div className={inst.loading}>
        <p className={inst.loadingText}>
          {t(
            'Chargement de la grille comptable professionnel agréé (CPA)…',
            'Loading chartered professional accountant (CPA) grid…'
          )}
        </p>
      </div>
    );
  }

  if (error) {
    return <div className={inst.alertRed}>{error.message}</div>;
  }

  if (!grid.hasFinancials || grid.rows.length === 0) {
    return (
      <div className={cn(inst.section, 'p-6')}>
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
          <div>
            <p className={inst.pageTitle}>{t('Revenus & Dépenses', 'Revenue & expenses')}</p>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">
              {t(
                'Aucune grille financial/dataV2 pour cette fiche (1 des 76 sans données financières complètes). Téléversez des états financiers ou complétez la grille sur Copilote, puis relancez la migration des sous-collections.',
                'No financial/dataV2 grid for this file. Upload statements or complete the grid in Copilote, then re-run subcollection migration.'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const verifiedCount = grid.rows.filter((r) => r.verification.obtained).length;

  return (
    <div className={cn('space-y-5', inst.page)}>
      <InstitutionalPageHeader
        icon={<Coins className="h-5 w-5 text-slate-700 shrink-0" />}
        title={t(
          'Grille comptable professionnel agréé (CPA) · Lecture seule',
          'Chartered professional accountant (CPA) grid · Read-only'
        )}
        meta={`${verifiedCount}/${grid.rows.length} ${t('preuves A2 validées', 'A2 proofs verified')}`}
      />

      <ProvenanceStrip
        lastUpdated={grid.provenance.lastUpdated}
        source={grid.provenance.source}
        confidenceTier={grid.provenance.confidenceTier}
        coveragePercent={grid.provenance.coveragePercent}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InstitutionalKpi
          label={t('Revenu brut effectif (RBE)', 'Effective gross income (EGI)')}
          value={fmt(grid.rbe)}
        />
        <InstitutionalKpi
          label={t('Dépenses normalisées', 'Normalized expenses')}
          value={fmt(grid.depensesNormaliseesTotal)}
        />
        <InstitutionalKpi label="RNE" value={fmt(grid.noiDeclare)} />
      </div>

      <p className={inst.note}>
        {t(
          'Normalisation comptable professionnel agréé (CPA) : montant normalisé = déclaré + ajustement expert. La colonne « % réf. marché » utilise les références sectorielles résidence pour aînés (RPA) (benchmark portefeuille V2 à brancher).',
          'Chartered professional accountant (CPA) normalization: normalized = declared + expert adjustment. Market ref % uses seniors residence (RPA) sector references (portfolio benchmark coming in V2).'
        )}
      </p>

      <section className={inst.section}>
        <div className={inst.tableWrap}>
          <table className={cn(inst.table, 'min-w-[720px]')}>
            <thead>
              <tr>
                <th className={inst.th}>{t('Poste', 'Line item')}</th>
                <th className={inst.thRight}>
                  % {t('revenu brut effectif (RBE)', 'effective gross income (EGI)')}
                </th>
                <th className={inst.thRight}>{t('Déclaré', 'Declared')}</th>
                <th className={inst.thRight}>{t('% réf. marché', 'Market ref %')}</th>
                <th className={inst.thRight}>{t('Ajustement', 'Adjustment')}</th>
                <th className={inst.thRight}>{t('Normalisé', 'Normalized')}</th>
                <th className={cn(inst.thRight, 'text-center')}>{t('Preuve A2', 'A2 proof')}</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.key} className={cn(inst.tr, row.isPrimary && 'bg-slate-50')}>
                  <td className={inst.td}>
                    {row.isPrimary && <span className="text-[#D4AF37] mr-1">★</span>}
                    <span className="font-semibold text-[#000000]">{row.label}</span>
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right font-mono text-xs font-bold tabular-nums',
                      gapStyle(row.pctOfRbe, row.marketRefPct)
                    )}
                  >
                    {fmtPct(row.pctOfRbe)}
                  </td>
                  <td className={inst.tdValueMono}>{fmt(row.declared)}</td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right font-mono text-xs font-bold tabular-nums',
                      gapStyle(row.pctOfRbe, row.marketRefPct)
                    )}
                  >
                    {fmtPct(row.marketRefPct)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                    {row.adjustment !== 0 ? fmt(row.adjustment) : '—'}
                  </td>
                  <td className={inst.tdValueMono}>{fmt(row.normalized)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {row.verification.obtained ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-emerald-800"
                        title={row.verification.note || undefined}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {t('Fait', 'Done')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-slate-600">
                        <ShieldOff className="h-3 w-3" />
                        {t('À valider', 'Pending')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={5} className="px-4 py-3 font-bold text-[#000000]">
                  {t('Total dépenses normalisées', 'Total normalized expenses')}
                </td>
                <td className="px-3 py-3 text-right font-black text-[#000000] tabular-nums">
                  {fmt(grid.depensesNormaliseesTotal)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {grid.rows.some((r) => r.verification.note?.trim()) && (
        <section className={cn(inst.section, 'p-4 space-y-2')}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
            {t('Notes justificatives A2', 'A2 supporting notes')}
          </p>
          {grid.rows
            .filter((r) => r.verification.note?.trim())
            .map((r) => (
              <p key={`note-${r.key}`} className="text-xs text-slate-700">
                <span className="font-semibold text-[#000000]">{r.label}:</span> {r.verification.note}
              </p>
            ))}
        </section>
      )}
    </div>
  );
}
