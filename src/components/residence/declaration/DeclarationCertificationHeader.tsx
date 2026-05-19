/**
 * En-tête certification — progression (draft), scellé (lock) ou fourni (uploaded).
 */

import React, { useCallback, useState } from 'react';
import { Download, ExternalLink, FileCheck, Loader2, Lock, Shield } from 'lucide-react';
import type { DeclarationProgressView, DeclarationVendeurDoc } from '@primexpert/core/declaration';
import { useLanguage } from '../../../lib/i18n';
import { cn } from '../../../lib/utils';
import { generateDVDocument } from '../../../services/vendorDeclarationPdf';

export interface DeclarationCertificationHeaderProps {
  residenceId: string;
  declaration: DeclarationVendeurDoc;
  progress: DeclarationProgressView;
  certifiedByLabel?: string | null;
}

export function DeclarationCertificationHeader({
  residenceId,
  declaration,
  progress,
  certifiedByLabel,
}: DeclarationCertificationHeaderProps) {
  const { t, language } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const isUploaded = progress.isUploaded;
  const isLocked = progress.isLocked;
  const fileUrl = declaration.fileUrl?.trim() || null;

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await generateDVDocument(residenceId, lang);
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      if (code === 'DECLARATION_NOT_CERTIFIED') {
        setDownloadError(
          t(
            'Certifiez la déclaration avant de télécharger le document (PDF).',
            'Certify the disclosure before downloading the document (PDF).'
          )
        );
      } else {
        setDownloadError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setDownloading(false);
    }
  }, [residenceId, lang, t]);

  const authorDisplay =
    certifiedByLabel?.trim() ||
    progress.certifiedBy?.trim() ||
    declaration.certifiedBy?.trim() ||
    '—';

  const criticalMessage =
    lang === 'fr' ? progress.criticalLockMessageFr : progress.criticalLockMessageEn;

  const progressLabel =
    lang === 'fr'
      ? `Progression du formulaire : ${progress.completionPct} %`
      : `Form progress: ${progress.completionPct}%`;

  if (isUploaded) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-start gap-3">
              <FileCheck className="h-6 w-6 shrink-0 mt-0.5 text-[#142c6a]" aria-hidden />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37]">
                  {t('Gold Signature', 'Gold Signature')}
                </p>
                <h2 className="text-xl font-black text-[#142c6a] tracking-tight">
                  {t('Déclaration du vendeur', 'Seller disclosure')}
                </h2>
              </div>
            </div>
        </div>

        <DeclarationProvidedNotice lang={lang} fileUrl={fileUrl} t={t} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {isLocked ? (
            <Lock className="h-6 w-6 shrink-0 mt-0.5 text-[#142c6a]" aria-hidden />
          ) : (
            <Shield className="h-6 w-6 shrink-0 mt-0.5 text-[#D4AF37]" aria-hidden />
          )}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37]">
              {t('Gold Signature', 'Gold Signature')}
            </p>
            <h2 className="text-xl font-black text-[#142c6a] tracking-tight">
              {isLocked
                ? t('Déclaration certifiée', 'Certified disclosure')
                : t('Déclaration du vendeur', 'Seller disclosure')}
            </h2>
            {!isLocked ? (
              <p className="text-[11px] text-slate-600 mt-1 max-w-xl">
                {t(
                  'Remplissez le formulaire de déclaration à votre rythme. Votre courtier validera la conformité avant la signature finale.',
                  'Complete the disclosure form at your own pace. Your broker will confirm compliance before final signature.'
                )}
              </p>
            ) : null}
          </div>
        </div>

        {isLocked ? (
          <button
            type="button"
            disabled={downloading}
            onClick={() => void handleDownload()}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border border-[#142c6a] bg-white px-5 py-2.5',
              'text-[10px] font-black uppercase tracking-[0.14em] text-[#142c6a]',
              'transition hover:border-[#D4AF37] hover:text-[#142c6a] disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            {t('Télécharger le document (PDF)', 'Download document (PDF)')}
          </button>
        ) : null}
      </div>

      {isLocked ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/40 px-5 py-4">
          <p className="text-sm font-bold text-[#142c6a]">
            {t('Déclaration scellée et verrouillée', 'Disclosure sealed and locked')}
          </p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-[#142c6a]">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t('Date de certification', 'Certification date')}
              </dt>
              <dd className="font-semibold tabular-nums">
                {progress.certifiedAtLabel ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t('Certifié par', 'Certified by')}
              </dt>
              <dd className="font-semibold">{authorDisplay}</dd>
            </div>
            {progress.confirmationTag ? (
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t('Code de sécurité', 'Security code')}
                </dt>
                <dd className="font-mono text-sm font-bold text-[#142c6a] tracking-wide">
                  {progress.confirmationTag}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-sm font-semibold text-[#142c6a] mb-2 tabular-nums">
            {progressLabel}
          </p>
          <div
            className="h-2 rounded-full bg-slate-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={progress.completionPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={progressLabel}
          >
            <div
              className="h-full rounded-full bg-[#D4AF37] transition-all duration-500 ease-out"
              style={{ width: `${progress.completionPct}%` }}
            />
          </div>

          {!progress.criticalLocksMet && criticalMessage ? (
            <p
              className="mt-3 text-[11px] font-medium text-[#142c6a] border border-slate-200 rounded-lg bg-white px-3 py-2 leading-relaxed"
              role="status"
            >
              {criticalMessage}
            </p>
          ) : null}
        </div>
      )}

      {downloadError ? (
        <p className="mt-3 text-sm text-red-800 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          {downloadError}
        </p>
      ) : null}
    </div>
  );
}

/** Avis officiel — déclaration téléversée hors application (texte Alain). */
function DeclarationProvidedNotice({
  lang,
  fileUrl,
  t,
}: {
  lang: 'fr' | 'en';
  fileUrl: string | null;
  t: (fr: string, en: string) => string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-wide text-[#142c6a]">
            {lang === 'fr' ? 'DÉCLARATION FOURNIE' : 'DISCLOSURE PROVIDED'}
          </p>
          <p className="mt-2 text-sm text-[#142c6a] leading-relaxed">
            {lang === 'fr'
              ? 'Un document signé a été téléchargé. Contactez votre courtier pour toute modification.'
              : 'A signed document has been uploaded. Contact your broker for any changes.'}
          </p>
        </div>

        {fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border border-[#142c6a] bg-white px-5 py-2.5',
              'text-[10px] font-black uppercase tracking-[0.14em] text-[#142c6a]',
              'transition hover:border-[#D4AF37] shrink-0'
            )}
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            {t('Visualiser le document signé', 'View signed document')}
          </a>
        ) : null}
      </div>
    </div>
  );
}
