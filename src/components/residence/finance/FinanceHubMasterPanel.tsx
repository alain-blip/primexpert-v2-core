/**
 * Bandeau maître Hub Finance — KPIs dataV2, actions or, glossaire (miroir portail / Confort 66+).
 */

import { useCallback, useMemo, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { extractBuyerPreviewKpis } from '@primexpert/core/diffusion';
import { FINANCE_HUB_GLOSSARY, normalizeFinancialData } from '@primexpert/core/financial';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { useAuth } from '../../../lib/auth';
import { useLanguage } from '../../../lib/i18n';
import { formatCurrency } from '../../../lib/utils';
import {
  buildBrokerFooterFromProfile,
  downloadCertifiableFinancialReportPdf,
} from '../../../services/certifiableReportPdfService';
import { downloadDetailedFinancialReportPdf } from '../../../services/financialReportPdfService';
import type { Residence } from '../../../services/residences';

const GOLD_BTN =
  'flex-1 min-w-0 min-h-[52px] rounded-lg border-2 border-black bg-[#D4AF37] px-3 py-3 text-[13px] sm:text-[14px] font-black text-black text-center hover:bg-[#c9a432] transition disabled:opacity-50 disabled:cursor-not-allowed';

export interface FinanceHubMasterPanelProps {
  onOpenAnalyse360: () => void;
  residence: Residence;
}

export function FinanceHubMasterPanel({ onOpenAnalyse360, residence }: FinanceHubMasterPanelProps) {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const { financialData, loading, error: financialLoadError } = useFinancialData();
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [detailPdfPending, setDetailPdfPending] = useState(false);

  const residenceHints = useMemo(
    () => ({
      prixDemande: residence.price,
      askingPrice: residence.price,
    }),
    [residence.price]
  );

  const normalized = useMemo(
    () => normalizeFinancialData(financialData, residenceHints),
    [financialData, residenceHints]
  );

  /** SSOT affichage + export — calculatedResults Firestore ou calc normalisé (derivedData). */
  const calculatedResults =
    financialData?.calculatedResults ?? normalized.calc ?? undefined;

  const kpis = useMemo(
    () => extractBuyerPreviewKpis(calculatedResults),
    [calculatedResults]
  );

  const fmt = (n: number | null) =>
    n != null && Number.isFinite(n) ? formatCurrency(n, { maxDecimals: 0 }) : '—';

  const hasKpisOnScreen =
    kpis.revenuNetExploitation != null ||
    kpis.cashFlow != null ||
    kpis.empruntMaximum != null ||
    kpis.miseDeFonds != null;

  const canExportPdf = !loading && Boolean(calculatedResults) && (hasKpisOnScreen || normalized.hasFinancials);

  const exportFinancialData = useMemo(() => {
    if (!financialData || !calculatedResults) return null;
    return { ...financialData, calculatedResults };
  }, [financialData, calculatedResults]);

  const handleCertifiablePdf = useCallback(() => {
    setPdfError(null);
    if (!exportFinancialData) {
      setPdfError(
        t(
          'Aucun calculatedResults — complétez la grille financière V2.',
          'No calculatedResults — complete the V2 financial grid.'
        )
      );
      return;
    }
    setPdfPending(true);
    try {
      downloadCertifiableFinancialReportPdf({
        financialData: exportFinancialData,
        residence: {
          id: residence.id,
          address: residence.address,
          city: residence.city,
          residenceName: residence.residenceName,
          nomCommercial: residence.nomCommercial,
          name: residence.name,
          prixDemande: residence.price,
          askingPrice: residence.price,
        },
        broker: buildBrokerFooterFromProfile(profile),
        locale: language === 'fr' ? 'fr' : 'en',
      });
    } catch (e) {
      console.error('[FinanceHubMasterPanel] certifiable PDF failed', e);
      setPdfError(
        t(
          'Échec de génération du rapport certifiable.',
          'Certifiable report generation failed.'
        )
      );
    } finally {
      setPdfPending(false);
    }
  }, [exportFinancialData, residence, profile, language, t]);

  const handleDetailedPdf = useCallback(async () => {
    setPdfError(null);
    if (!exportFinancialData) {
      setPdfError(
        t(
          'Aucun calculatedResults — complétez la grille financière V2.',
          'No calculatedResults — complete the V2 financial grid.'
        )
      );
      return;
    }
    setDetailPdfPending(true);
    try {
      await downloadDetailedFinancialReportPdf({
        financialData: exportFinancialData,
        residence: {
          id: residence.id,
          address: residence.address,
          city: residence.city,
          residenceName: residence.residenceName,
          nomCommercial: residence.nomCommercial,
          name: residence.name,
          prixDemande: residence.price,
          askingPrice: residence.price,
        },
        broker: buildBrokerFooterFromProfile(profile),
        locale: language === 'fr' ? 'fr' : 'en',
      });
    } catch (e) {
      console.error('[FinanceHubMasterPanel] detailed PDF failed', e);
      const detail = e instanceof Error ? e.message : String(e);
      setPdfError(
        t(
          `Échec de génération du rapport financier détaillé. (${detail})`,
          `Detailed financial report generation failed. (${detail})`
        )
      );
    } finally {
      setDetailPdfPending(false);
    }
  }, [exportFinancialData, residence, profile, language, t]);

  return (
    <section className="space-y-4 border-b border-[#142c6a]/15 bg-[#f8fafc] px-5 py-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <FinanceKpiTile
          label={t('Revenu net d’exploitation (RNE)', 'Net operating income (NOI)')}
          value={loading ? '…' : fmt(kpis.revenuNetExploitation)}
        />
        <FinanceKpiTile label={t('Cash flow', 'Cash flow')} value={loading ? '…' : fmt(kpis.cashFlow)} />
        <FinanceKpiTile
          label={t('Emprunt maximum', 'Maximum loan')}
          value={loading ? '…' : fmt(kpis.empruntMaximum)}
        />
        <FinanceKpiTile
          label={t('Mise de fonds requise (MFR)', 'Required down payment (RFR)')}
          value={loading ? '…' : fmt(kpis.miseDeFonds)}
        />
      </div>

      <div className="flex flex-row flex-wrap gap-2 sm:gap-3">
        <button
          type="button"
          className={GOLD_BTN}
          onClick={() => setGlossaryOpen((o) => !o)}
          aria-expanded={glossaryOpen}
        >
          {glossaryOpen ? '▲' : '▼'} {t('Comprendre ce tableau', 'Understand this table')}
        </button>
        <button type="button" className={GOLD_BTN} onClick={onOpenAnalyse360}>
          📊 {t('Analyse financière complète', 'Full financial analysis')}
        </button>
        <button
          type="button"
          className={GOLD_BTN}
          disabled={!canExportPdf || pdfPending}
          onClick={handleCertifiablePdf}
          title={
            canExportPdf
              ? undefined
              : t('Données calculatedResults requises', 'calculatedResults data required')
          }
        >
          📄{' '}
          {pdfPending
            ? t('Génération…', 'Generating…')
            : t('Générer le Rapport Certifiable', 'Generate certifiable report')}
        </button>
        <button
          type="button"
          className={GOLD_BTN}
          disabled={!calculatedResults || loading || detailPdfPending}
          onClick={handleDetailedPdf}
          title={
            calculatedResults && !loading
              ? undefined
              : t('Données calculatedResults requises', 'calculatedResults data required')
          }
        >
          📑{' '}
          {detailPdfPending
            ? t('Génération…', 'Generating…')
            : t('Rapport Financier Détaillé', 'Detailed financial report')}
        </button>
        <button
          type="button"
          disabled
          className={GOLD_BTN}
          aria-disabled="true"
          title={t(
            'Favoris — réservé à l’espace acheteur sur le portail public',
            'Favourites — buyer portal only'
          )}
        >
          ❤️ {t('Ajouter à mes favoris', 'Add to my favourites')}
        </button>
      </div>

      {financialLoadError ? (
        <p className="text-[13px] font-bold text-amber-900" role="status">
          {t(
            'Accès Firestore limité (financial/dataV2) — vérifiez que vous êtes courtier responsable de cette résidence.',
            'Limited Firestore access (financial/dataV2) — confirm you are the responsible broker for this residence.'
          )}{' '}
          ({financialLoadError.message})
        </p>
      ) : null}

      {pdfError ? (
        <p className="text-[13px] font-bold text-red-700 px-1" role="alert">
          {pdfError}
        </p>
      ) : null}

      {glossaryOpen ? (
        <div
          className="rounded-xl border-2 border-[#142c6a] bg-white p-5 space-y-4 max-h-[320px] overflow-y-auto"
          role="region"
          aria-label={t('Glossaire financier', 'Financial glossary')}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-black uppercase tracking-wide text-[#142c6a]">
              {t('Acronymes et ratios', 'Acronyms and ratios')}
            </p>
            <button
              type="button"
              onClick={() => setGlossaryOpen(false)}
              className="inline-flex items-center gap-1 text-[13px] font-bold text-[#142c6a] hover:underline"
            >
              <ChevronUp className="h-4 w-4" />
              {t('Replier', 'Collapse')}
            </button>
          </div>
          <ul className="space-y-3">
            {FINANCE_HUB_GLOSSARY.map((entry) => (
              <li key={entry.code} className="border-b border-slate-100 pb-3 last:border-0">
                <p className="text-[15px] font-black text-black">
                  {language === 'fr' ? entry.titleFr : entry.titleEn}
                </p>
                <p className="mt-1 text-[14px] text-slate-800 leading-relaxed">
                  {language === 'fr' ? entry.bodyFr : entry.bodyEn}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function FinanceKpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-[#142c6a] bg-white px-4 py-4 text-center min-w-0 shadow-sm">
      <p className="text-[11px] sm:text-[12px] font-black uppercase tracking-wide text-[#142c6a] leading-snug">
        {label}
      </p>
      <p className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-black leading-none">
        {value}
      </p>
    </div>
  );
}
