import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Landmark,
  Loader2,
  Scale,
  UploadCloud,
  Wrench,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import {
  buildResidenceMirrorFolders,
  mirrorFolderForPropertyUpload,
  RESIDENCE_MIRROR_PROMESSE_KEY,
  type VirtualMirrorFile,
} from '../../lib/unifiedDocumentsMirror';
import {
  subscribeAllPropertyDocuments,
  uploadPropertyDocument,
} from '../../services/propertyDocumentsService';
import {
  validatePropertyDocumentFile,
  validationErrorMessage,
} from '../../lib/propertyDocumentValidation';
import { DocumentPreviewModal } from './DocumentPreviewModal';

const FOLDER_ICONS: Record<string, typeof Landmark> = {
  financier: Landmark,
  legal: Scale,
  technique: Wrench,
  [RESIDENCE_MIRROR_PROMESSE_KEY]: FileText,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(ms: number, locale: 'fr' | 'en'): string {
  return new Date(ms).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export interface ResidenceDocumentsMirrorViewProps {
  propertyId: string;
  propertyTitle: string;
  onBack: () => void;
}

/**
 * Miroir SSOT — lecture/écriture via `residences/{id}/documents` uniquement.
 * Aucune copie dans un drive parallèle.
 */
export function ResidenceDocumentsMirrorView({
  propertyId,
  propertyTitle,
  onBack,
}: ResidenceDocumentsMirrorViewProps) {
  const { language, t } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const { profile } = useAuth();
  const brokerId = profile?.uid ?? '';
  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFolderKey, setActiveFolderKey] = useState<string>('financier');
  const [previewFile, setPreviewFile] = useState<VirtualMirrorFile | null>(null);

  const [foldersState, setFoldersState] = useState(
    buildResidenceMirrorFolders([])
  );

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    const unsub = subscribeAllPropertyDocuments(
      propertyId,
      (rows) => {
        setFoldersState(buildResidenceMirrorFolders(rows));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [propertyId]);

  const activeFolder = useMemo(
    () => foldersState.find((f) => f.key === activeFolderKey) ?? foldersState[0],
    [foldersState, activeFolderKey]
  );

  const uploadTarget = mirrorFolderForPropertyUpload(activeFolderKey);

  const handleUpload = async (files: FileList | File[]) => {
    if (!brokerId || !uploadTarget) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const validation = validatePropertyDocumentFile(file);
        if (!validation.ok) {
          throw new Error(validationErrorMessage(validation.code, locale));
        }
        await uploadPropertyDocument({
          propertyId,
          category: uploadTarget.category,
          file,
          uploadedBy: brokerId,
          promesseScope: uploadTarget.promesseScope,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('Retour', 'Back')}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400/90">
            {t('Miroir inscription — source unique', 'Listing mirror — single source')}
          </p>
          <h2 className="truncate text-xl font-black italic uppercase tracking-tight text-white">
            {propertyTitle}
          </h2>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            {t(
              'Lecture et téléversement synchronisés avec l’Espace Documents de la fiche — aucune copie.',
              'Read and upload stay in sync with the listing Documents tab — no duplicate copies.'
            )}
          </p>
        </div>
      </div>

      <div className="flex min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <aside className="w-[240px] shrink-0 border-r border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 px-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
            {t('Arborescence fiche', 'Listing tree')}
          </p>
          <nav className="space-y-1">
            {foldersState.map((folder) => {
              const Icon = FOLDER_ICONS[folder.key] ?? FileText;
              const active = activeFolderKey === folder.key;
              return (
                <button
                  key={folder.key}
                  type="button"
                  onClick={() => setActiveFolderKey(folder.key)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition',
                    active
                      ? 'border border-blue-400/35 bg-blue-500/15 text-white'
                      : 'border border-transparent text-slate-400 hover:bg-white/5'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-wide">
                    {locale === 'fr' ? folder.labelFr : folder.labelEn}
                  </span>
                  <span className="font-mono text-[9px] text-slate-500">
                    {folder.files.length}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className={cn(
              'border-b border-white/10 p-4',
              uploading && 'opacity-60 pointer-events-none'
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files.length) void handleUpload(e.dataTransfer.files);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
              onChange={(e) => {
                if (e.target.files?.length) void handleUpload(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || !uploadTarget}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/20 bg-white/[0.02] py-8 text-center transition hover:border-blue-400/40 hover:bg-blue-500/10 disabled:opacity-40"
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-blue-300" />
              ) : (
                <UploadCloud className="h-8 w-8 text-slate-500" />
              )}
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">
                {t(
                  'Téléverser dans ce dossier (fiche résidence)',
                  'Upload to this folder (listing record)'
                )}
              </span>
              <span className="text-[10px] font-medium text-slate-500">
                {locale === 'fr' ? activeFolder?.labelFr : activeFolder?.labelEn}
              </span>
            </button>
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-[11px] font-bold uppercase tracking-widest">
                  {t('Synchronisation…', 'Syncing…')}
                </span>
              </div>
            ) : activeFolder && activeFolder.files.length === 0 ? (
              <p className="py-12 text-center text-sm font-semibold text-slate-500">
                {t('Aucun document dans ce dossier.', 'No documents in this folder.')}
              </p>
            ) : (
              <ul className="space-y-2">
                {activeFolder?.files.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => setPreviewFile(file)}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-blue-400/30 hover:bg-white/[0.08]"
                    >
                      <FileText className="h-5 w-5 shrink-0 text-blue-300/80" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">
                          {file.fileName}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {formatDate(file.uploadedAtMillis, locale)} ·{' '}
                          {formatSize(file.sizeBytes)}
                          {file.virusScanStatus === 'pending'
                            ? ` · ${t('Analyse en cours', 'Scan pending')}`
                            : ''}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm font-bold text-red-400">{error}</p>
      ) : null}

      <DocumentPreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        locale={locale}
      />
    </div>
  );
}
