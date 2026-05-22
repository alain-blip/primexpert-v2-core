import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileText, Loader2, UploadCloud } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import type { OrganizationContact } from '@primexpert/core/crm';
import {
  buildContactMirrorFolders,
  contactMirrorTitle,
  type VirtualMirrorFile,
} from '../../lib/unifiedDocumentsMirror';
import {
  AGENCY_DOCUMENT_CATEGORIES,
  subscribeAgencyDocuments,
  uploadAgencyDocument,
  type AgencyDocumentCategory,
  type AgencyDocumentRecord,
} from '../../services/agencyDocumentsService';
import { ResidenceDocumentsMirrorView } from './ResidenceDocumentsMirrorView';
import { DocumentPreviewModal } from './DocumentPreviewModal';

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

function agencyToMirror(row: AgencyDocumentRecord): VirtualMirrorFile {
  const cat = AGENCY_DOCUMENT_CATEGORIES.find((c) => c.id === row.category);
  return {
    id: `agency:${row.id}`,
    source: 'agency',
    fileName: row.fileName,
    storagePath: row.storagePath,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedAtMillis: row.uploadedAtMillis,
    folderKey: row.category,
    folderLabelFr: cat?.labelFr ?? row.category,
    folderLabelEn: cat?.labelEn ?? row.category,
    agencyDocumentId: row.id,
  };
}

export type DocumentFolderViewProps =
  | {
      mode: 'residence';
      propertyId: string;
      propertyTitle: string;
      onBack: () => void;
    }
  | {
      mode: 'contact';
      contact: OrganizationContact;
      onBack: () => void;
    }
  | {
      mode: 'workspace';
      onBack: () => void;
    };

export function DocumentFolderView(props: DocumentFolderViewProps) {
  if (props.mode === 'residence') {
    return (
      <ResidenceDocumentsMirrorView
        propertyId={props.propertyId}
        propertyTitle={props.propertyTitle}
        onBack={props.onBack}
      />
    );
  }
  if (props.mode === 'contact') {
    return <ContactDocumentsMirrorView contact={props.contact} onBack={props.onBack} />;
  }
  return <WorkspaceDocumentsView onBack={props.onBack} />;
}

function ContactDocumentsMirrorView({
  contact,
  onBack,
}: {
  contact: OrganizationContact;
  onBack: () => void;
}) {
  const { language, t } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const folders = useMemo(() => buildContactMirrorFolders(contact), [contact]);
  const [activeFolderKey, setActiveFolderKey] = useState(folders[0]?.key ?? '');
  const [previewFile, setPreviewFile] = useState<VirtualMirrorFile | null>(null);

  const activeFolder = folders.find((f) => f.key === activeFolderKey) ?? folders[0];

  return (
    <div className="space-y-4">
      <Header
        onBack={onBack}
        badge={t('Miroir contact — source unique', 'Contact mirror — single source')}
        title={contactMirrorTitle(contact)}
        subtitle={t(
          'Fichiers lus depuis la fiche contact (CRM) — chemins Storage officiels.',
          'Files read from the CRM contact record — official Storage paths.'
        )}
      />
      <MirrorShell
        folders={folders}
        activeFolderKey={activeFolderKey}
        onFolderChange={setActiveFolderKey}
        activeFolder={activeFolder}
        locale={locale}
        onPreview={setPreviewFile}
        uploadSlot={
          <p className="py-8 text-center text-[11px] font-medium text-slate-500">
            {t(
              'Pour ajouter une pièce, utilisez la fiche contact (répertoire clients).',
              'To add a document, use the contact record (CRM directory).'
            )}
          </p>
        }
      />
      <DocumentPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} locale={locale} />
    </div>
  );
}

function WorkspaceDocumentsView({ onBack }: { onBack: () => void }) {
  const { language, t } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const { profile } = useAuth();
  const orgId = profile?.orgId ?? '';
  const brokerId = profile?.uid ?? '';
  const inputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<AgencyDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<AgencyDocumentCategory>('gabarits');
  const [previewFile, setPreviewFile] = useState<VirtualMirrorFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    const unsub = subscribeAgencyDocuments(
      orgId,
      (docs) => {
        setRows(docs);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [orgId]);

  const folders = useMemo(() => {
    return AGENCY_DOCUMENT_CATEGORIES.map((cat) => ({
      key: cat.id,
      labelFr: cat.labelFr,
      labelEn: cat.labelEn,
      files: rows.filter((r) => r.category === cat.id).map(agencyToMirror),
    }));
  }, [rows]);

  const [activeFolderKey, setActiveFolderKey] = useState('gabarits');
  const activeFolder = folders.find((f) => f.key === activeFolderKey) ?? folders[0];

  const handleUpload = async (files: FileList | File[]) => {
    if (!orgId || !brokerId) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadAgencyDocument({ orgId, category, file, uploadedBy: brokerId });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Header
        onBack={onBack}
        badge={t('Espace de travail agence', 'Agency workspace')}
        title={t('Gabarits et documents généraux', 'Templates & general files')}
        subtitle={t(
          'Index Firestore organizations/…/agencyDocuments — Storage primexpert/…/agency_documents/.',
          'Firestore index organizations/…/agencyDocuments — Storage primexpert/…/agency_documents/.'
        )}
      />
      <div className="flex gap-2 flex-wrap">
        {AGENCY_DOCUMENT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategory(cat.id)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-wider',
              category === cat.id
                ? 'border-blue-400/50 bg-blue-500/20 text-white'
                : 'border-white/15 text-slate-400'
            )}
          >
            {locale === 'fr' ? cat.labelFr : cat.labelEn}
          </button>
        ))}
      </div>
      <MirrorShell
        folders={folders}
        activeFolderKey={activeFolderKey}
        onFolderChange={setActiveFolderKey}
        activeFolder={activeFolder}
        locale={locale}
        loading={loading}
        onPreview={setPreviewFile}
        uploadSlot={
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void handleUpload(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length) void handleUpload(e.dataTransfer.files);
              }}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/20 py-8 hover:border-blue-400/40"
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-blue-300" />
              ) : (
                <UploadCloud className="h-8 w-8 text-slate-500" />
              )}
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">
                {t('Téléverser (espace agence)', 'Upload (agency space)')}
              </span>
            </button>
          </>
        }
      />
      {error ? <p className="text-sm font-bold text-red-400">{error}</p> : null}
      <DocumentPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} locale={locale} />
    </div>
  );
}

function Header({
  onBack,
  badge,
  title,
  subtitle,
}: {
  onBack: () => void;
  badge: string;
  title: string;
  subtitle: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/5"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('Retour', 'Back')}
      </button>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-300/80">{badge}</p>
        <h2 className="text-xl font-black italic uppercase tracking-tight text-white">{title}</h2>
        <p className="mt-1 max-w-2xl text-[11px] font-medium text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function MirrorShell({
  folders,
  activeFolderKey,
  onFolderChange,
  activeFolder,
  locale,
  onPreview,
  uploadSlot,
  loading = false,
}: {
  folders: { key: string; labelFr: string; labelEn: string; files: VirtualMirrorFile[] }[];
  activeFolderKey: string;
  onFolderChange: (key: string) => void;
  activeFolder?: { key: string; labelFr: string; labelEn: string; files: VirtualMirrorFile[] };
  locale: 'fr' | 'en';
  onPreview: (f: VirtualMirrorFile) => void;
  uploadSlot: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-[400px] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <aside className="w-[220px] shrink-0 border-r border-white/10 p-3">
        <nav className="space-y-1">
          {folders.map((folder) => (
            <button
              key={folder.key}
              type="button"
              onClick={() => onFolderChange(folder.key)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide',
                activeFolderKey === folder.key
                  ? 'bg-blue-500/20 text-white'
                  : 'text-slate-400 hover:bg-white/5'
              )}
            >
              <span className="truncate">{locale === 'fr' ? folder.labelFr : folder.labelEn}</span>
              <span className="font-mono text-[9px]">{folder.files.length}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-white/10 p-4">{uploadSlot}</div>
        <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : activeFolder && activeFolder.files.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              {locale === 'fr' ? 'Aucun fichier.' : 'No files.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {activeFolder?.files.map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    onClick={() => onPreview(file)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left hover:bg-white/[0.08]"
                  >
                    <FileText className="h-5 w-5 text-blue-300/80" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{file.fileName}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatDate(file.uploadedAtMillis, locale)} · {formatSize(file.sizeBytes)}
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
  );
}
