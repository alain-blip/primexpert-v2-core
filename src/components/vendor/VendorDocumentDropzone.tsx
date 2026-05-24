import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileCheck, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { uploadPropertyDocument } from '../../services/propertyDocumentsService';

export function VendorDocumentDropzone({
  propertyId,
  brokerId,
  t,
}: {
  propertyId: string;
  brokerId: string;
  t: (fr: string, en: string) => string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [successName, setSuccessName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file || !propertyId || !brokerId) return;
      setUploading(true);
      setError(null);
      setSuccessName(null);
      try {
        await uploadPropertyDocument({
          propertyId,
          category: 'legal',
          file,
          uploadedBy: brokerId,
        });
        setSuccessName(file.name);
      } catch (e) {
        console.error('[VendorDocumentDropzone]', e);
        setError(
          e instanceof Error
            ? e.message
            : t('Téléversement impossible.', 'Upload failed.')
        );
      } finally {
        setUploading(false);
      }
    },
    [propertyId, brokerId, t]
  );

  return (
    <div className="space-y-3">
      <motion.div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        animate={{
          borderColor: dragOver ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
          scale: dragOver ? 1.01 : 1,
        }}
        className={cn(
          'cursor-pointer rounded-2xl border-2 border-dashed bg-white/5 p-8 text-center transition-shadow',
          dragOver && 'shadow-[0_0_40px_rgba(255,255,255,0.12)]'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        {uploading ? (
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-white/80" aria-hidden />
        ) : (
          <Upload className="mx-auto h-10 w-10 text-white/70" aria-hidden />
        )}
        <p className="mt-4 text-sm font-black uppercase tracking-widest text-white">
          {t('Glisser-déposer une pièce manquante', 'Drag and drop a missing document')}
        </p>
        <p className="mt-2 text-xs font-medium text-white/70">
          {t(
            'PDF, images ou documents Word — vérification automatique après dépôt.',
            'PDF, images, or Word documents — automatic verification after upload.'
          )}
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {successName ? (
          <motion.div
            key="ok"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-500/15 px-4 py-3 text-emerald-100"
          >
            <FileCheck className="h-4 w-4 shrink-0" aria-hidden />
            <p className="text-xs font-semibold">
              {t('Pièce reçue :', 'Document received:')} {successName}
            </p>
          </motion.div>
        ) : null}
        {error ? (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 rounded-xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-red-100"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs font-semibold">{error}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
