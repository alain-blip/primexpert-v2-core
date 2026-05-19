import React, { useCallback } from 'react';
import type { RentPricingView } from '@primexpert/core/identity';
import { formatCurrency } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';
import { IdentitySectionCard } from './IdentitySectionCard';
import { RaphaelBadge } from '../../msss/RaphaelBadge';
import { useIdentityFieldSave } from '../../../hooks/useIdentityFieldSave';

/**
 * Tarification des loyers — charte Confort 66+, édition inline permanente.
 *
 * Plus de toggle "Modifier" : chaque cellule numérique est un <input> natif
 * en texte noir massif (16 px font-black). La sauvegarde Firestore est
 * déclenchée à la sortie du champ via `useIdentityFieldSave`.
 */
export interface RentPricingTableSectionProps {
  rentPricing: RentPricingView;
  language: 'fr' | 'en';
}

const NUMBER_INPUT_CLASSES =
  'h-11 w-24 rounded-xl border-2 border-black/30 bg-white px-2 text-right text-[16px] font-black tabular-nums text-black focus:border-[#142c6a] focus:outline-none focus:ring-2 focus:ring-[#142c6a]/30';

export function RentPricingTableSection({ rentPricing, language }: RentPricingTableSectionProps) {
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
    >
      <p className="mb-5 text-[15px] font-semibold leading-relaxed text-slate-700">
        {t(
          'Diligence raisonnable financière : si le revenu brut effectif (RBE) est absent, la somme des revenus potentiels alimente la normalisation finance.',
          'Financial due diligence: if effective gross income (EGI) is missing, total potential revenue feeds finance normalization.'
        )}
      </p>

      <div className="overflow-x-auto rounded-xl border-2 border-black/10">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-black/10 bg-[#142c6a] text-white">
              <th className="px-4 py-3 text-left text-[12px] font-black uppercase tracking-wider">
                {t('Type', 'Type')}
              </th>
              <th className="px-4 py-3 text-right text-[12px] font-black uppercase tracking-wider">
                {t('Qté', 'Qty')}
              </th>
              <th className="px-4 py-3 text-right text-[12px] font-black uppercase tracking-wider">
                {t('Occupation %', 'Occupancy %')}
              </th>
              <th className="px-4 py-3 text-right text-[12px] font-black uppercase tracking-wider">
                {t('Loyer moyen', 'Avg rent')}
              </th>
              <th className="px-4 py-3 text-right text-[12px] font-black uppercase tracking-wider">
                {t('Revenu potentiel / an', 'Potential revenue / yr')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rentPricing.rows.map((row, idx) => {
              const label = language === 'fr' ? row.labelFr : row.labelEn;
              return (
                <tr
                  key={row.typeKey}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fafaf6]'}
                >
                  <td className="border-t border-black/10 px-4 py-3 text-[15px] font-black text-[#142c6a]">
                    <span className="inline-flex items-center gap-2">
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
                      <td
                        key={col}
                        className="border-t border-black/10 px-3 py-3 text-right"
                      >
                        <span className="inline-flex items-center justify-end gap-2">
                          <input
                            type="number"
                            min={0}
                            value={draft}
                            onChange={(e) => setDraft(fieldId, e.target.value)}
                            onBlur={(e) => void handleBlur(fieldId, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            className={NUMBER_INPUT_CLASSES}
                            placeholder="0"
                          />
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                          ) : null}
                        </span>
                      </td>
                    );
                  })}
                  <td className="border-t border-black/10 px-4 py-3 text-right text-[16px] font-black tabular-nums text-black">
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
              <tr className="border-t-2 border-amber-700 bg-amber-100">
                <td
                  colSpan={4}
                  className="px-4 py-3 text-right text-[13px] font-black uppercase tracking-wider text-amber-900"
                >
                  {t(
                    'Total revenus potentiels (diligence revenu brut effectif (RBE))',
                    'Total potential revenue (effective gross income (EGI) due diligence)'
                  )}
                </td>
                <td className="px-4 py-3 text-right text-[18px] font-black tabular-nums text-black">
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
