import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  institutionalPanelShellClass,
  institutionalPanelSubtitleClass,
  institutionalPanelTitleClass,
} from '../../lib/institutionalTheme';
import { canDownloadPropertyDocument } from '../../lib/propertyDocumentValidation';
import { getPropertyDocumentDownloadUrl } from '../../services/propertyDocumentsService';
import { getAgencyDocumentDownloadUrl } from '../../services/agencyDocumentsService';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import type { VirtualMirrorFile } from '../../lib/unifiedDocumentsMirror';

export interface DocumentPreviewModalProps {
  file: VirtualMirrorFile | null;
  onClose: () => void;
  locale: 'fr' | 'en';
}

async function resolveDownloadUrl(file: VirtualMirrorFile): Promise<string> {
  if (file.source === 'property') {
    return getPropertyDocumentDownloadUrl(file.storagePath);
  }
  if (file.source === 'agency') {
    return getAgencyDocumentDownloadUrl(file.storagePath);
  }
  return getDownloadURL(ref(storage, file.storagePath));
}

function isPdfPreview(file: VirtualMirrorFile): boolean {
  return (
    file.mimeType === 'application/pdf' || file.fileName.toLowerCase().endsWith('.pdf')
  );
}

function isImagePreview(file: VirtualMirrorFile): boolean {
  return file.mimeType.startsWith('image/');
}

function triggerFileDownload(url: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  anchor.target = '_blank';
  anchor.click();
}

/** Blob URL `application/pdf` — contourne Content-Disposition / octet-stream des signed URLs. */
async function buildPdfInlineUrl(signedUrl: string): Promise<string> {
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  const blob = new Blob([buffer], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

function PdfInlineViewer({ signedUrl, title }: { signedUrl: string; title: string }) {
  const [inlineUrl, setInlineUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<'iframe' | 'embed'>('iframe');
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setHydrating(true);
    setMode('iframe');
    void buildPdfInlineUrl(signedUrl)
      .then((u) => {
        objectUrl = u;
        if (!cancelled) setInlineUrl(u);
      })
      .catch(() => {
        if (!cancelled) setInlineUrl(signedUrl);
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [signedUrl]);

  const src = inlineUrl ?? signedUrl;
  const viewerClass = 'h-[min(75vh,800px)] w-full rounded-md border-2 border-primexpert-dark bg-white';

  if (hydrating) {
    return (
      <div className={cn(viewerClass, 'flex items-center justify-center')}>
        <Loader2 className="h-6 w-6 animate-spin text-primexpert-dark/60" />
      </div>
    );
  }

  if (mode === 'embed') {
    return (
      <embed
        src={src}
        type="application/pdf"
        title={title}
        className={cn(viewerClass, 'min-h-[min(75vh,800px)]')}
      />
    );
  }

  return (
    <iframe
      title={title}
      src={src}
      className={cn(viewerClass, 'border-0')}
      onError={() => setMode('embed')}
    />
  );
}

export function DocumentPreviewModal({ file, onClose, locale }: DocumentPreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDownload = useMemo(() => {
    if (!file || !url) return false;
    if (file.source === 'property') {
      return canDownloadPropertyDocument(file.virusScanStatus);
    }
    return true;
  }, [file, url]);

  const previewSupported = file ? isPdfPreview(file) || isImagePreview(file) : false;

  useEffect(() => {
    if (!file) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void resolveDownloadUrl(file)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  const handleDownload = useCallback(() => {
    if (!file || !url || !canDownload) return;
    triggerFileDownload(url, file.fileName);
  }, [file, url, canDownload]);

  if (!file) return null;

  const labels = {
    close: locale === 'fr' ? 'Fermer' : 'Close',
    download: locale === 'fr' ? 'Télécharger' : 'Download',
    loading: locale === 'fr' ? 'Chargement…' : 'Loading…',
    previewUnavailable:
      locale === 'fr'
        ? 'Aperçu indisponible pour ce type de fichier.'
        : 'Preview not available for this file type.',
    downloadBlocked:
      locale === 'fr'
        ? 'Téléchargement bloqué : vérification de sécurité en cours.'
        : 'Download blocked: security verification in progress.',
    downloadHint:
      locale === 'fr'
        ? 'Utilisez le bouton Télécharger pour obtenir le fichier.'
        : 'Use the Download button to retrieve the file.',
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          institutionalPanelShellClass,
          'flex max-h-[92vh] w-11/12 max-w-6xl flex-col overflow-hidden !p-0 shadow-2xl'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-white/20 px-4 py-3 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p id="doc-preview-title" className={cn(institutionalPanelTitleClass, 'truncate text-sm')}>
              {file.fileName}
            </p>
            <p className={cn(institutionalPanelSubtitleClass, 'mt-0.5 text-[10px] uppercase tracking-widest')}>
              {locale === 'fr' ? file.folderLabelFr : file.folderLabelEn}
            </p>
          </div>
          <button
            type="button"
            disabled={!url || loading || !canDownload}
            onClick={handleDownload}
            title={!canDownload && file.source === 'property' ? labels.downloadBlocked : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition',
              canDownload && url && !loading
                ? 'border-blue-400/40 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30'
                : 'cursor-not-allowed border-white/10 bg-white/5 text-slate-500'
            )}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{labels.download}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label={labels.close}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-[min(50vh,400px)] flex-1 overflow-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex h-[min(60vh,560px)] items-center justify-center gap-2 text-white/80">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">{labels.loading}</span>
            </div>
          ) : error ? (
            <p className="py-12 text-center text-sm font-bold text-red-200">{error}</p>
          ) : url && previewSupported && isPdfPreview(file) ? (
            <PdfInlineViewer signedUrl={url} title={file.fileName} />
          ) : url && previewSupported && isImagePreview(file) ? (
            <img
              src={url}
              alt={file.fileName}
              className="mx-auto max-h-[min(75vh,800px)] max-w-full rounded-lg object-contain"
            />
          ) : url ? (
            <div className="flex h-[min(50vh,400px)] flex-col items-center justify-center gap-4 rounded-xl border-2 border-primexpert-dark bg-white px-4 text-center">
              <p className="max-w-md text-sm font-semibold text-primexpert-dark">
                {labels.previewUnavailable}
              </p>
              <p className="text-[11px] text-slate-600">{labels.downloadHint}</p>
              {!canDownload && file.source === 'property' ? (
                <p className="text-[11px] font-bold text-amber-400/90">{labels.downloadBlocked}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/20 px-4 py-2.5">
          <p className="text-[10px] text-white/80">
            {previewSupported
              ? locale === 'fr'
                ? 'Aperçu à l’écran — téléchargement sur demande.'
                : 'On-screen preview — download on demand.'
              : labels.previewUnavailable}
          </p>
          <button
            type="button"
            disabled={!url || loading || !canDownload}
            onClick={handleDownload}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition',
              canDownload && url && !loading
                ? 'border-blue-400/40 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30'
                : 'cursor-not-allowed border-white/10 text-slate-500'
            )}
          >
            <Download className="h-4 w-4" />
            {labels.download}
          </button>
        </footer>
      </div>
    </div>
  );
}
