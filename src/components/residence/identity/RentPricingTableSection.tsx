import React, { useCallback, useState } from 'react';
import type { RentPricingView } from '@primexpert/core/identity';
import { formatCurrency } from '../../../lib/utils';
import { Pencil, X, Loader2 } from 'lucide-react';
import { IdentitySectionCard } from './IdentitySectionCard';
import { RaphaelBadge } from '../../msss/RaphaelBadge';
import { useIdentityFieldSave } from '../../../hooks/useIdentityFieldSave';
import { cn } from '../../../lib/utils';

export interface RentPricingTableSectionProps {
  rentPricing: RentPricingView;
  language: 'fr' | 'en';
}

export function RentPricingTableSection({ rentPricing, language }: RentPricingTableSectionProps) {
  const [editing, setEditing] = useState(false);
  const { savingFieldId, getDraftValue, setDraft, saveIdentityField } = useIdentityFieldSave();

  const t = (fr: string, en: string) => (language === 'fr' ? fr : en);

  const handleBlur = useCallback(
    async (fieldId: string, value: string) => {
      setDraft(fieldId, value);
      await saveIdentityField(fieldId, value);
    },
    [setDraft, saveIdentityField]
  );

  return (
    <IdentitySectionCard
      title={t('Tarification des loyers', 'Rent pricing')}
      accent="#b45309"
      headerAction={
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition',
            editing
              ? 'border-slate-300 bg-white text-slate-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-[#D4AF37]/50 hover:text-[#000000]'
          )}
        >
          {editing ? (
            <>
              <X className="h-3 w-3" />
              {t('Terminer', 'Done')}
            </>
          ) : (
            <>
              <Pencil className="h-3 w-3" />
              {t('Modifier', 'Edit')}
            </>
          )}
        </button>
      }
    >
      <p className="text-xs text-slate-600 mb-4">
        {t(
          'Fail-safe financier : si le revenu brut effectif (RBE) est absent, la somme des revenus potentiels alimente la normalisation finance.',
          'Financial fail-safe: if effective gross income (EGI) is missing, total potential revenue feeds finance normalization.'
        )}
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                {t('Type', 'Type')}
              </th>
              <th className="text-right px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                {t('Qté', 'Qty')}
              </th>
              <th className="text-right px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                {t('Occupation %', 'Occupancy %')}
              </th>
              <th className="text-right px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                {t('Loyer moyen', 'Avg rent')}
              </th>
              <th className="text-right px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                {t('Revenu potentiel / an', 'Potential revenue / yr')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rentPricing.rows.map((row) => {
              const label = language === 'fr' ? row.labelFr : row.labelEn;
              return (
                <tr key={row.typeKey} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-[#000000]">
                    <span className="inline-flex items-center gap-1">
                      {label}
                      <RaphaelBadge show={row.showRaphaelBadge} />
                    </span>
                  </td>
                  {(['qty', 'occupation', 'loyer'] as const).map((col) => {
                    const fieldId = row.fieldIds[col];
                    const saving = savingFieldId === fieldId;
                    const display =
                      col === 'qty'
                        ? String(row.qty || '')
                        : col === 'occupation'
                          ? row.occupationPct != null
                            ? String(row.occupationPct)
                            : ''
                          : row.loyerMoyen != null
                            ? String(row.loyerMoyen)
                            : '';
                    const draft = getDraftValue(fieldId, display);

                    return (
                      <td key={col} className="px-4 py-2 text-right">
                        {editing ? (
                          <span className="inline-flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min={0}
                              value={draft}
                              onChange={(e) => setDraft(fieldId, e.target.value)}
                              onBlur={(e) => void handleBlur(fieldId, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                              }}
                              className="w-24 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-right text-sm font-semibold text-[#000000] focus:border-[#D4AF37]/60 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/30"
                            />
                            {saving ? (
                              <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                            ) : null}
                          </span>
                        ) : (
                          <span className="font-black text-[#000000] tabular-nums">
                            {col === 'loyer' && row.loyerMoyen != null
                              ? formatCurrency(row.loyerMoyen)
                              : col === 'loyer'
                                ? '—'
                                : display || '—'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right font-black text-[#000000] tabular-nums">
                    {row.revenuPotentielAnnuel != null
                      ? formatCurrency(row.revenuPotentielAnnuel)
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rentPricing.totalRevenuPotentielAnnuel != null && (
            <tfoot>
              <tr className="bg-amber-50/60 border-t border-slate-200">
                <td
                  colSpan={4}
                  className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-600 text-right"
                >
                  {t(
                    'Total revenus potentiels (fail-safe revenu brut effectif (RBE))',
                    'Total potential revenue (effective gross income (EGI) fail-safe)'
                  )}
                </td>
                <td className="px-4 py-3 text-right font-black text-[#000000] tabular-nums">
                  {formatCurrency(rentPricing.totalRevenuPotentielAnnuel)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </IdentitySectionCard>
  );
}
