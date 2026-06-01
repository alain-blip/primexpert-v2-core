/**
 * Présentation ACM — mise en marché institutionnelle (export PDF).
 */

import { useCallback, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useLanguage } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { FinancialDataProvider } from '../../../context/FinancialDataContext';
import type { Residence } from '../../../services/residences';
import {
  buildAcmBrokerFromProfile,
  downloadAcmPresentationPdf,
} from '../../../services/acmPresentationPdfService';
import { inst } from '../institutional/InstitutionalUi';
import {
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
} from '../../../lib/institutionalTheme';

const GOLD_BTN =
  'inline-flex items-center justify-center gap-2 min-h-[52px] rounded-lg border-2 border-black bg-[#D4AF37] px-5 py-3 text-[14px] font-black text-black hover:bg-[#c9a432] transition disabled:opacity-50 disabled:cursor-not-allowed';

export interface AcmTabProps {
  residence: Residence;
}

function AcmTabContent({ residence }: AcmTabProps) {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const { financialData, loading } = useFinancialData();
  const { residenceDoc } = useResidenceDocument();
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const canExport = Boolean(financialData?.calculatedResults) && !loading;

  const broker = useMemo(
    () => buildAcmBrokerFromProfile(profile, language === 'fr' ? 'fr' : 'en'),
    [profile, language]
  );

  const handleExport = useCallback(async () => {
    setPdfError(null);
    if (!financialData?.calculatedResults) {
      setPdfError(
        t(
          'Grille financière V2 requise (calculatedResults).',
          'V2 financial grid required (calculatedResults).'
        )
      );
      return;
    }
    setPdfPending(true);
    try {
      await downloadAcmPresentationPdf({
        financialData,
        residence: {
          id: residence.id,
          city: residence.city,
          nombreUnites: residence.nicheMetadata?.nombreUnites,
          nombreUnitesTotal: residence.nicheMetadata?.nombreUnites,
          prixDemande: residence.price,
          askingPrice: residence.price,
          listingSource: residence.listingSource,
        },
        residenceDoc: residenceDoc ?? undefined,
        broker,
        locale: language === 'fr' ? 'fr' : 'en',
      });
    } catch (e) {
      console.error('[AcmTab] PDF export failed', e);
      setPdfError(
        t(
          'Échec de génération de la présentation ACM.',
          'ACM presentation generation failed.'
        )
      );
    } finally {
      setPdfPending(false);
    }
  }, [financialData, residence, residenceDoc, broker, language, t]);

  return (
    <section className={`${institutionalListingsCardShellClass} space-y-4 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={institutionalListingsCardTitleClass}>
            {t('Mise en marché · analyse comparative de marché (ACM)', 'Market launch · CMA')}
          </p>
          <h3 className="mt-2 text-xl font-black text-black leading-snug">
            {t(
              'Présentation institutionnelle (confidentielle)',
              'Institutional presentation (confidential)'
            )}
          </h3>
          <p className="mt-2 text-[15px] text-slate-800 leading-relaxed max-w-2xl">
            {t(
              'Document de pitch sans photographie — positionnement marché, finançabilité (calculatedResults) et plan de propulsion multi-portails.',
              'Pitch document without photographs — market positioning, financing (calculatedResults) and multi-portal launch plan.'
            )}
          </p>
        </div>
        <button
          type="button"
          className={GOLD_BTN}
          disabled={!canExport || pdfPending}
          onClick={handleExport}
        >
          <FileText className="h-5 w-5 shrink-0" aria-hidden />
          {pdfPending
            ? t('Génération…', 'Generating…')
            : t('Générer la Présentation ACM', 'Generate CMA presentation')}
        </button>
      </div>
      {pdfError ? (
        <p className="text-[13px] font-bold text-red-700" role="alert">
          {pdfError}
        </p>
      ) : null}
      {!canExport && !loading ? (
        <p className={inst.alertAmber}>
          {t(
            'Activez les données financières V2 (onglet Hub Finance) avant d’exporter la présentation.',
            'Activate V2 financial data (Finance Hub tab) before exporting the presentation.'
          )}
        </p>
      ) : null}
    </section>
  );
}

export function AcmTab({ residence }: AcmTabProps) {
  return (
    <FinancialDataProvider residenceId={residence.id}>
      <AcmTabContent residence={residence} />
    </FinancialDataProvider>
  );
}
