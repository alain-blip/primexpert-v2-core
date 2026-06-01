import { useMemo } from 'react';
import { resolveTransactionBanner } from '@primexpert/core/diffusion';
import { useLanguage } from '../../lib/i18n';
import { useResidenceDocument } from '../../context/ResidenceDocumentContext';

function formatNotaireDate(iso: string, locale: 'fr' | 'en'): string {
  const [y, m, d] = iso.split('-').map((p) => Number(p));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Toronto',
  });
}

export function ResidenceTransactionBanner() {
  const { t, language } = useLanguage();
  const { residenceDoc } = useResidenceDocument();
  const locale = language === 'fr' ? 'fr' : 'en';

  const banner = useMemo(() => {
    if (!residenceDoc) return null;
    const promesseRaw = residenceDoc.promesseAchat;
    const promesseAchat =
      promesseRaw && typeof promesseRaw === 'object' && !Array.isArray(promesseRaw)
        ? (promesseRaw as {
            statut?: string | null;
            dateNotairePrevue?: string | null;
            dateNotaire?: string | null;
          })
        : null;

    return resolveTransactionBanner({
      stage: typeof residenceDoc.stage === 'string' ? residenceDoc.stage : null,
      status: typeof residenceDoc.status === 'string' ? residenceDoc.status : null,
      pipelineStatus:
        typeof residenceDoc.pipelineStatus === 'string' ? residenceDoc.pipelineStatus : null,
      statut: typeof residenceDoc.statut === 'string' ? residenceDoc.statut : null,
      dateNotairePrevu:
        typeof residenceDoc.dateNotairePrevu === 'string'
          ? residenceDoc.dateNotairePrevu
          : null,
      promesseAchat,
    });
  }, [residenceDoc]);

  if (!banner?.kind) return null;

  if (banner.kind === 'pa_acceptee') {
    return (
      <div
        role="status"
        className="rounded-xl border-4 border-amber-400 bg-amber-300 px-5 py-4 text-black shadow-md"
      >
        <p className="text-[15px] font-black uppercase tracking-wide leading-snug">
          {t(
            'Promesse d’achat acceptée — vérifications en cours',
            'Purchase promise accepted — due diligence in progress'
          )}
        </p>
      </div>
    );
  }

  const dateLabel = banner.dateNotaireIso
    ? formatNotaireDate(banner.dateNotaireIso, locale)
    : t('à confirmer', 'to be confirmed');

  return (
    <div
      role="status"
      className="rounded-xl border-4 border-emerald-900 bg-emerald-600 px-5 py-4 text-white shadow-md"
    >
      <p className="text-[15px] font-black uppercase tracking-wide leading-snug">
        {t('Propriété vendue — date du notaire : ', 'Property sold — closing date: ')}
        <span className="tabular-nums">{dateLabel}</span>
      </p>
    </div>
  );
}
