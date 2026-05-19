/**
 * Sprint 5.1 — Axe 1 : structure financière du tronc de l'offre (PA).
 * Charte Confort 66+ : édition inline permanente, sauvegarde onBlur.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  computeSoldeAFinancer,
  type OffreTroncFieldKey,
  type OffreTroncInput,
} from '@primexpert/core/transaction';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { useLanguage } from '../../../lib/i18n';
import { formatCurrency } from '../../../lib/utils';

const LABEL_CLASS =
  'text-[13px] font-black uppercase tracking-wider text-[#142c6a]';

const INPUT_CLASS =
  'h-12 w-full rounded-xl border-2 border-black/20 bg-white px-3 text-[16px] font-black text-black placeholder-slate-400 focus:border-[#142c6a] focus:outline-none focus:ring-2 focus:ring-[#142c6a]/30';

export interface OffreTroncFinancierSectionProps {
  offre: OffreTroncInput;
  locked: boolean;
  onPersist: (next: OffreTroncInput) => Promise<void>;
}

type MoneyField = 'prixOffert' | 'acompteMontant' | 'balanceVenteMontant';

const MONEY_FIELDS: readonly {
  key: MoneyField;
  labelFr: string;
  labelEn: string;
}[] = [
  { key: 'prixOffert', labelFr: 'Prix offert ($)', labelEn: 'Offered price ($)' },
  { key: 'acompteMontant', labelFr: 'Acompte ($)', labelEn: 'Deposit ($)' },
  {
    key: 'balanceVenteMontant',
    labelFr: 'Balance de prix de vente ($)',
    labelEn: 'Balance of sale price ($)',
  },
];

function draftFromOffre(offre: OffreTroncInput): Record<MoneyField, string> {
  return {
    prixOffert: offre.prixOffert != null ? String(offre.prixOffert) : '',
    acompteMontant: offre.acompteMontant != null ? String(offre.acompteMontant) : '',
    balanceVenteMontant:
      offre.balanceVenteMontant != null ? String(offre.balanceVenteMontant) : '',
  };
}

function parseMoneyDraft(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export function OffreTroncFinancierSection({
  offre,
  locked,
  onPersist,
}: OffreTroncFinancierSectionProps) {
  const { language } = useLanguage();
  const { saving } = useResidenceDocument();
  const t = (fr: string, en: string) => (language === 'fr' ? fr : en);

  const [drafts, setDrafts] = useState(() => draftFromOffre(offre));
  const [savingField, setSavingField] = useState<OffreTroncFieldKey | null>(null);

  useEffect(() => {
    setDrafts(draftFromOffre(offre));
  }, [offre]);

  const solde = useMemo(() => computeSoldeAFinancer(offre), [offre]);

  const saveField = useCallback(
    async (key: MoneyField) => {
      if (locked) return;
      const parsed = parseMoneyDraft(drafts[key]);
      const current = offre[key];
      if (parsed === current || (parsed === undefined && current === undefined)) {
        return;
      }
      setSavingField(key);
      try {
        await onPersist({ ...offre, [key]: parsed });
      } finally {
        setSavingField(null);
      }
    },
    [drafts, locked, offre, onPersist]
  );

  return (
    <section className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm border-l-8 border-l-green-600">
      <header className="border-b-2 border-slate-100 bg-slate-50/80 px-5 py-4">
        <h3 className="text-[13px] font-black uppercase tracking-[0.18em] text-[#142c6a]">
          {t(
            "[ STRUCTURE FINANCIÈRE DE L'OFFRE ]",
            '[ OFFER FINANCIAL STRUCTURE ]'
          )}
        </h3>
      </header>

      <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {MONEY_FIELDS.map(({ key, labelFr, labelEn }) => {
          const savingThis = savingField === key;
          return (
            <div
              key={key}
              className="min-w-0 rounded-xl border-2 border-black/10 bg-white py-4 px-4"
            >
              <p className={`${LABEL_CLASS} mb-2 flex items-center gap-2`}>
                <span>{t(labelFr, labelEn)}</span>
                {savingThis ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                ) : null}
              </p>
              <input
                type="number"
                min={0}
                step={1}
                disabled={locked || saving}
                value={drafts[key]}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                }
                onBlur={() => void saveField(key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                className={INPUT_CLASS}
                placeholder="0"
              />
            </div>
          );
        })}

        <div className="min-w-0 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 py-4 px-4 sm:col-span-2 lg:col-span-3">
          <p className={`${LABEL_CLASS} mb-2`}>
            {t('Solde à financer', 'Balance to finance')}
          </p>
          <p className="text-[20px] font-black tabular-nums text-black">
            {solde != null ? formatCurrency(solde) : '—'}
          </p>
          <p className="mt-2 text-[13px] font-semibold text-slate-600">
            {t(
              'Calcul : prix offert − acompte − balance de prix de vente',
              'Calculation: offered price − deposit − balance of sale price'
            )}
          </p>
        </div>
      </div>

      {(offre.acheteurNom || offre.acheteurId) && (
        <div className="border-t-2 border-slate-100 px-5 py-4">
          <p className={`${LABEL_CLASS} mb-1`}>{t('Acheteur (offre)', 'Buyer (offer)')}</p>
          <p className="text-[16px] font-black text-black">
            {offre.acheteurNom ?? '—'}
            {offre.acheteurId ? (
              <span className="ml-2 text-[13px] font-semibold text-slate-500">
                · {offre.acheteurId}
              </span>
            ) : null}
          </p>
        </div>
      )}
    </section>
  );
}
