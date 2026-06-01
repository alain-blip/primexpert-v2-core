import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Download, FileText, Loader2, Pencil, Shield, Trash2 } from 'lucide-react';
import {
  ensureOriginalFileExtension,
  splitPropertyDocumentFileName,
} from '../../../lib/propertyDocumentValidation';
import { renamePropertyDocument } from '../../../services/propertyDocumentsService';
import { cn } from '../../../lib/utils';
import {
  canDownloadPropertyDocument,
  documentNeedsIaParse,
  formatParsingErrorMessage,
  isPermanentParseFailure,
} from '../../../lib/propertyDocumentValidation';
import { parsePropertyDocumentNow } from '../../../services/propertyDocumentsService';
import type {
  PropertyDocumentExtractedData,
  PropertyDocumentRecord,
} from '../../../types/propertyDocument';
import type { AssetNiche } from '../../../types/residence';
import type { MarketSiloType } from '../../../types/marketAnalytics';
import { capitalizationRateToPercent } from '@primexpert/core/financial';
import {
  MARKET_SILO_OPTIONS,
  formatCertificateDate,
  formatExtractedCurrency,
  hasExtractedCertificateLocalisation,
  hasExtractedEvaluationSubject,
  isCertificateExpiredByDate,
  isExtractionCL,
  hasExtractedFinancialAmounts,
  isExtractionFinancial,
  listExtractedAmounts,
  listExtractedComparables,
  resolveRegionAdministrative,
  resolveSiloFromResidence,
} from '../../../lib/extractedDataInjection';
import {
  injectCertificateLocalisationToResidence,
  injectExtractedDataToResidence,
} from '../../../services/extractedDataInjectionService';
import { useFinancialHubDraft } from '../../../context/FinancialHubDraftContext';
import { inst } from '../institutional/InstitutionalUi';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(ms: number, locale: 'fr' | 'en'): string {
  return new Date(ms).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function StatusBadge({
  tone,
  children,
}: {
  tone: 'amber' | 'emerald' | 'red' | 'slate' | 'blue' | 'gold';
  children: React.ReactNode;
}) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    gold: 'border-[#D4AF37]/40 bg-amber-50 text-[#142c6a]',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold leading-snug',
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function securityBadge(doc: PropertyDocumentRecord, locale: 'fr' | 'en') {
  switch (doc.virusScanStatus) {
    case 'clean':
      return (
        <StatusBadge tone="emerald">
          {locale === 'fr' ? '✅ Fichier sain' : '✅ File verified clean'}
        </StatusBadge>
      );
    case 'infected':
      return (
        <StatusBadge tone="red">
          {locale === 'fr' ? '⛔ Fichier infecté — accès bloqué' : '⛔ Infected file — access blocked'}
        </StatusBadge>
      );
    default:
      return (
        <StatusBadge tone="amber">
          {locale === 'fr' ? '🛡️ Vérification en cours…' : '🛡️ Security scan in progress…'}
        </StatusBadge>
      );
  }
}

function parsingBadge(doc: PropertyDocumentRecord, locale: 'fr' | 'en') {
  if (!doc.parsingEligible) {
    return (
      <StatusBadge tone="slate">
        {locale === 'fr' ? 'Analyse IA : non applicable' : 'AI analysis: not applicable'}
      </StatusBadge>
    );
  }

  switch (doc.parsingStatus) {
    case 'verified':
      return (
        <StatusBadge tone="gold">
          {locale === 'fr' ? '✓ Montants validés par le courtier' : '✓ Amounts validated by broker'}
        </StatusBadge>
      );
    case 'completed':
      return (
        <StatusBadge tone="emerald">
          {locale === 'fr' ? '📊 Données extraites' : '📊 Data extracted'}
        </StatusBadge>
      );
    case 'failed':
      return (
        <StatusBadge tone="red">
          {locale === 'fr' ? 'Analyse IA échouée' : 'AI analysis failed'}
        </StatusBadge>
      );
    case 'pending':
      return (
        <StatusBadge tone="blue">
          {locale === 'fr' ? '🧠 Analyse du document…' : '🧠 Analyzing document…'}
        </StatusBadge>
      );
    default:
      if (doc.virusScanStatus !== 'clean') {
        return (
          <StatusBadge tone="slate">
            {locale === 'fr'
              ? 'Analyse IA : en attente du scan antivirus'
              : 'AI analysis: waiting for antivirus scan'}
          </StatusBadge>
        );
      }
      return (
        <StatusBadge tone="slate">
          {locale === 'fr' ? 'Analyse IA : en file d’attente' : 'AI analysis: queued'}
        </StatusBadge>
      );
  }
}

export interface DocumentMetadataPanelProps {
  document: PropertyDocumentRecord | null;
  propertyId: string;
  brokerId: string;
  residenceCity?: string;
  residenceRegionHint?: string;
  assetNiche?: AssetNiche;
  propertyType?: string;
  locale: 'fr' | 'en';
  busy: boolean;
  onDownload: (doc: PropertyDocumentRecord) => Promise<void>;
  onDelete: (doc: PropertyDocumentRecord) => Promise<void>;
  onInjectionComplete?: () => void;
  labels: {
    title: string;
    empty: string;
    name: string;
    size: string;
    date: string;
    type: string;
    taxonomy?: string;
    security: string;
    analysis: string;
    securityPendingNote: string;
    securityInfectedNote: string;
    downloadBlocked: string;
    download: string;
    delete: string;
    confirmDelete: string;
  };
}

export function DocumentMetadataPanel({
  document,
  propertyId,
  brokerId,
  residenceCity,
  residenceRegionHint,
  assetNiche,
  propertyType,
  locale,
  busy,
  onDownload,
  onDelete,
  onInjectionComplete,
  labels,
}: DocumentMetadataPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [injectError, setInjectError] = useState<string | null>(null);
  const { queueIaPrefill } = useFinancialHubDraft();
  const [parseRetrying, setParseRetrying] = useState(false);
  const [parseRetryError, setParseRetryError] = useState<string | null>(null);
  const detectedSilo = useMemo(
    () => resolveSiloFromResidence(assetNiche, propertyType),
    [assetNiche, propertyType]
  );
  const [siloType, setSiloType] = useState<MarketSiloType>(detectedSilo);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [checkedComparableIds, setCheckedComparableIds] = useState<Set<string>>(new Set());

  const downloadAllowed = useMemo(
    () => (document ? canDownloadPropertyDocument(document.virusScanStatus) : false),
    [document]
  );

  const amountRows = useMemo(
    () => (document?.extractedData ? listExtractedAmounts(document.extractedData) : []),
    [document?.extractedData]
  );

  const comparableRows = useMemo(
    () => (document?.extractedData ? listExtractedComparables(document.extractedData, locale) : []),
    [document?.extractedData, locale]
  );

  const hasEvaluationSubject = useMemo(
    () => (document?.extractedData ? hasExtractedEvaluationSubject(document.extractedData) : false),
    [document?.extractedData]
  );

  const hasCLMetadata = useMemo(
    () =>
      document?.extractedData
        ? hasExtractedCertificateLocalisation(document.extractedData)
        : false,
    [document?.extractedData]
  );

  const regionInfo = useMemo(
    () => resolveRegionAdministrative(residenceCity, residenceRegionHint),
    [residenceCity, residenceRegionHint]
  );

  const siloLabel = useMemo(() => {
    const opt = MARKET_SILO_OPTIONS.find((o) => o.id === siloType);
    return locale === 'fr' ? opt?.labelFr ?? siloType : opt?.labelEn ?? siloType;
  }, [siloType, locale]);

  useEffect(() => {
    setSiloType(detectedSilo);
  }, [detectedSilo, document?.id]);

  useEffect(() => {
    setCheckedIds(new Set(amountRows.map((r) => r.id)));
    setCheckedComparableIds(new Set(comparableRows.map((r) => r.id)));
    setInjectError(null);
  }, [document?.id, amountRows, comparableRows]);

  const toggleRow = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleComparable = useCallback((id: string) => {
    setCheckedComparableIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const extracted = document?.extractedData;
  const parseReady =
    document &&
    document.parsingEligible &&
    (document.parsingStatus === 'completed' || document.parsingStatus === 'verified');

  const showCLVerification =
    Boolean(parseReady && extracted && isExtractionCL(extracted));

  const showFinancialVerification =
    Boolean(
      parseReady &&
        extracted &&
        !showCLVerification &&
        isExtractionFinancial(extracted)
    );

  const isVerified = document?.parsingStatus === 'verified' || document?.isValidated === true;
  const isCLValidated = document?.isValidated === true && hasCLMetadata;

  const parseFailurePermanent = isPermanentParseFailure(document?.parsingError);
  const parseFailureMessage = formatParsingErrorMessage(document?.parsingError, locale);
  const showParseLaunch =
    Boolean(document && documentNeedsIaParse(document) && document.parsingStatus === 'not_applicable');

  const handleRetryParse = async () => {
    if (!document || !propertyId) return;
    if (parseFailurePermanent) return;
    setParseRetrying(true);
    setParseRetryError(null);
    try {
      const result = await parsePropertyDocumentNow(propertyId, document.id);
      if (result.parsingStatus === 'failed') {
        setParseRetryError(
          locale === 'fr'
            ? 'L’analyse IA a de nouveau échoué. Voir le détail ci-dessus.'
            : 'AI analysis failed again. See details above.'
        );
      }
    } catch (e) {
      setParseRetryError(e instanceof Error ? e.message : String(e));
    } finally {
      setParseRetrying(false);
    }
  };

  const handleInjectCL = async () => {
    if (!document || !propertyId || !brokerId) return;
    setInjecting(true);
    setInjectError(null);
    try {
      await injectCertificateLocalisationToResidence({
        propertyId,
        document,
        brokerId,
      });
      onInjectionComplete?.();
    } catch (e) {
      setInjectError(e instanceof Error ? e.message : String(e));
    } finally {
      setInjecting(false);
    }
  };

  const handleInject = async () => {
    if (!document || !propertyId || !brokerId) return;
    const selected = amountRows.filter((r) => checkedIds.has(r.id));
    const selectedComparables = comparableRows.filter((r) => checkedComparableIds.has(r.id));
    const canInject =
      selected.length > 0 || selectedComparables.length > 0 || hasEvaluationSubject;
    if (!canInject) {
      setInjectError(
        locale === 'fr'
          ? 'Sélectionnez au moins un élément à injecter.'
          : 'Select at least one item to inject.'
      );
      return;
    }

    setInjecting(true);
    setInjectError(null);
    try {
      await injectExtractedDataToResidence({
        propertyId,
        document,
        selectedRows: selected,
        selectedComparableRows: selectedComparables,
        siloType,
        brokerId,
        residenceCity,
        residenceRegionHint,
      });

      if (
        selected.length > 0 &&
        document.extractedData &&
        hasExtractedFinancialAmounts(document.extractedData)
      ) {
        queueIaPrefill(
          document.extractedData,
          { documentId: document.id, fileName: document.fileName },
          { selectedRows: selected }
        );
      }

      onInjectionComplete?.();
    } catch (e) {
      setInjectError(e instanceof Error ? e.message : String(e));
    } finally {
      setInjecting(false);
    }
  };

  return (
    <>
    <aside className="flex h-full w-[300px] shrink-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className={inst.sectionHeader}>
        <h3 className={inst.sectionTitle}>{labels.title}</h3>
      </header>

      {!document ? (
        <EmptyState labels={labels} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 space-y-2 border-b border-slate-100 px-5 py-3">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
              {labels.security}
            </p>
            {securityBadge(document, locale)}
            <p className="mt-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
              {labels.analysis}
            </p>
            {parsingBadge(document, locale)}
          </div>

          {showParseLaunch ? (
            <div className="mx-4 mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-[11px] text-blue-950">
                {locale === 'fr'
                  ? 'Ce PDF n’a pas encore été analysé par l’IA (dossier Technique ou Légal).'
                  : 'This PDF has not been analyzed by AI yet (Technical or Legal folder).'}
              </p>
              <button
                type="button"
                disabled={parseRetrying || busy}
                onClick={() => void handleRetryParse()}
                className="mt-2 text-[10px] font-black uppercase tracking-wider text-blue-900 underline disabled:opacity-50"
              >
                {parseRetrying
                  ? locale === 'fr'
                    ? 'Analyse en cours…'
                    : 'Analyzing…'
                  : locale === 'fr'
                    ? 'Lancer l’analyse IA'
                    : 'Run AI analysis'}
              </button>
              {parseRetryError ? (
                <p className="mt-1 text-[10px] text-red-800">{parseRetryError}</p>
              ) : null}
            </div>
          ) : null}

          {document.parsingStatus === 'failed' ? (
            <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-red-950">{parseFailureMessage}</p>
              {!parseFailurePermanent && document.parsingEligible ? (
                <button
                  type="button"
                  disabled={parseRetrying || busy}
                  onClick={() => void handleRetryParse()}
                  className="mt-2 text-[10px] font-black uppercase tracking-wider text-red-900 underline disabled:opacity-50"
                >
                  {parseRetrying
                    ? locale === 'fr'
                      ? 'Nouvelle analyse…'
                      : 'Retrying…'
                    : locale === 'fr'
                      ? 'Réessayer l’analyse IA'
                      : 'Retry AI analysis'}
                </button>
              ) : null}
              {parseRetryError ? (
                <p className="mt-1 text-[10px] text-red-800">{parseRetryError}</p>
              ) : null}
            </div>
          ) : null}

          {document.virusScanStatus === 'pending' ? (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="text-[11px] text-amber-950">{labels.securityPendingNote}</p>
            </div>
          ) : null}

          {document.virusScanStatus === 'infected' ? (
            <div className="mx-4 mt-3 shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-900">
              {labels.securityInfectedNote}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <dl className="space-y-4 px-5 py-4">
              <DocumentFileNameField
                locale={locale}
                propertyId={propertyId}
                document={document}
                label={labels.name}
                busy={busy}
              />
              <MetaField label={labels.size} value={formatSize(document.sizeBytes)} mono />
              <MetaField label={labels.date} value={formatDate(document.uploadedAtMillis, locale)} />
              <MetaField label={labels.type} value={document.mimeType} small />
              {labels.taxonomy && document.extractedData?.documentType ? (
                <MetaField
                  label={labels.taxonomy}
                  value={String(document.extractedData.documentType)}
                  small
                />
              ) : null}

              {showCLVerification ? (
                <CertificateLocalisationSection
                  locale={locale}
                  extractedData={document.extractedData}
                  isValidated={isCLValidated}
                  injectError={injectError}
                  injecting={injecting}
                  busy={busy}
                  onInject={() => void handleInjectCL()}
                />
              ) : null}

              {showFinancialVerification ? (
                <ExtractionVerificationSection
                  locale={locale}
                  isVerified={isVerified}
                  amountRows={amountRows}
                  checkedIds={checkedIds}
                  toggleRow={toggleRow}
                  comparableRows={comparableRows}
                  checkedComparableIds={checkedComparableIds}
                  toggleComparable={toggleComparable}
                  evaluationSubject={document.extractedData.sujet}
                  hasEvaluationSubject={hasEvaluationSubject}
                  siloType={siloType}
                  detectedSilo={detectedSilo}
                  setSiloType={setSiloType}
                  regionDisplayName={regionInfo.displayName}
                  siloLabel={siloLabel}
                  injectError={injectError}
                  injecting={injecting}
                  busy={busy}
                  onInject={() => void handleInject()}
                />
              ) : null}
            </dl>
          </div>

          <DocumentActions
            labels={labels}
            locale={locale}
            document={document}
            downloadAllowed={downloadAllowed}
            busy={busy}
            confirming={confirming}
            setConfirming={setConfirming}
            onDownload={onDownload}
            onDelete={onDelete}
          />
        </div>
      )}
    </aside>
    </>
  );
}

function EmptyState({ labels }: { labels: DocumentMetadataPanelProps['labels'] }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <FileText className="h-10 w-10 text-slate-300" />
      <p className="text-sm text-slate-500">{labels.empty}</p>
    </div>
  );
}

function DocumentFileNameField({
  locale,
  propertyId,
  document,
  label,
  busy,
}: {
  locale: 'fr' | 'en';
  propertyId: string;
  document: PropertyDocumentRecord;
  label: string;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { base, ext } = useMemo(
    () => splitPropertyDocumentFileName(document.fileName),
    [document.fileName]
  );

  useEffect(() => {
    setEditing(false);
    setDraft('');
    setError(null);
  }, [document.id, document.fileName]);

  const startEdit = () => {
    setDraft(base);
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const nextName = ensureOriginalFileExtension(draft, document.fileName);
      await renamePropertyDocument(propertyId, document.id, nextName, document.fileName);
      setEditing(false);
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      if (code === 'EMPTY_DOCUMENT_NAME') {
        setError(locale === 'fr' ? 'Le nom ne peut pas être vide.' : 'Name cannot be empty.');
      } else {
        setError(
          locale === 'fr'
            ? 'Impossible d’enregistrer le nom. Réessayez.'
            : 'Could not save the name. Try again.'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <dt className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</dt>
      <dd className="mt-1">
        {!editing ? (
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 break-words text-[12px] font-black text-[#142c6a]">
              {document.fileName}
            </p>
            <button
              type="button"
              disabled={busy || saving}
              onClick={startEdit}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1',
                'text-[9px] font-black uppercase tracking-widest text-slate-700',
                'hover:border-[#D4AF37]/50 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50'
              )}
              aria-label={locale === 'fr' ? 'Renommer' : 'Rename'}
            >
              <Pencil className="h-3 w-3" />
              {locale === 'fr' ? 'Renommer' : 'Rename'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              autoFocus
              className={cn(
                'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2',
                'text-[12px] font-black text-[#142c6a] outline-none',
                'focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/30'
              )}
              aria-label={locale === 'fr' ? 'Nouveau nom du document' : 'New document name'}
            />
            {ext ? (
              <p className="text-[10px] text-slate-500">
                {locale === 'fr'
                  ? `L’extension ${ext} sera conservée à l’enregistrement.`
                  : `Extension ${ext} will be kept when saving.`}
              </p>
            ) : null}
            {error ? (
              <p className="text-[10px] font-semibold text-red-800" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving || !draft.trim()}
                onClick={() => void handleSave()}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#D4AF37]/60',
                  'bg-white px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#142c6a]',
                  'hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {locale === 'fr' ? 'Enregistrer le nom' : 'Save name'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={cancelEdit}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:bg-white"
              >
                {locale === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
            </div>
          </div>
        )}
      </dd>
    </div>
  );
}

function MetaField({
  label,
  value,
  bold,
  mono,
  small,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    
      <div>
        <dt className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</dt>
        <dd
          className={cn(
            'mt-1 break-words text-[12px] text-slate-800',
            bold && 'font-semibold text-[#142c6a]',
            mono && 'font-mono',
            small && 'break-all text-[11px] text-slate-600'
          )}
        >
          {value}
        </dd>
      </div>
  );
}

function CertificateLocalisationSection({
  locale,
  extractedData,
  isValidated,
  injectError,
  injecting,
  busy,
  onInject,
}: {
  locale: 'fr' | 'en';
  extractedData: PropertyDocumentExtractedData;
  isValidated: boolean;
  injectError: string | null;
  injecting: boolean;
  busy: boolean;
  onInject: () => void;
}) {
  const [clauseCopied, setClauseCopied] = useState(false);
  const meta = extractedData.metadataCL;
  const irregularites = [...(extractedData.irregularites ?? [])].sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' })
  );
  const clause = extractedData.suggestionClauseDV?.trim() ?? '';
  const isExpired =
    extractedData.isExpiredCL === true ||
    isCertificateExpiredByDate(meta?.dateCertificat);

  const handleCopyClause = async () => {
    if (!clause) return;
    try {
      await navigator.clipboard.writeText(clause);
      setClauseCopied(true);
      window.setTimeout(() => setClauseCopied(false), 2000);
    } catch {
      setClauseCopied(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">
        {locale === 'fr'
          ? 'Diligence — Certificat de localisation (OACIQ)'
          : 'Diligence — Certificate of location (OACIQ)'}
      </p>

      {isExpired ? (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-2.5 py-2 text-[11px] font-semibold text-red-900">
          ⚠️{' '}
          {locale === 'fr'
            ? 'Certificat de plus de 10 ans — Renouvellement requis pour conformité transactionnelle'
            : 'Certificate over 10 years old — Renewal required for transactional compliance'}
        </div>
      ) : null}

      {meta ? (
        <dl className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
          {meta.dateCertificat ? (
            <div>
              <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                {locale === 'fr' ? 'Date du certificat' : 'Certificate date'}
              </dt>
              <dd className="text-[12px] font-black text-[#142c6a]">
                {formatCertificateDate(meta.dateCertificat, locale)}
              </dd>
            </div>
          ) : null}
          {meta.arpenteur ? (
            <div>
              <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                {locale === 'fr' ? 'Arpenteur-géomètre' : 'Land surveyor'}
              </dt>
              <dd className="text-[12px] font-black text-[#142c6a]">{meta.arpenteur}</dd>
            </div>
          ) : null}
          {meta.lotCadastral ? (
            <div>
              <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                {locale === 'fr' ? 'Lot cadastral' : 'Cadastral lot'}
              </dt>
              <dd className="font-mono text-[12px] font-black text-[#142c6a]">{meta.lotCadastral}</dd>
            </div>
          ) : null}
          {meta.superficieTerrainMetres != null ? (
            <div>
              <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                {locale === 'fr' ? 'Superficie terrain' : 'Land area'}
              </dt>
              <dd className="text-[12px] font-black text-[#142c6a]">
                {meta.superficieTerrainMetres.toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')}{' '}
                m²
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-3">
        <p className="text-[11px] font-semibold text-slate-800">
          {locale === 'fr' ? 'Vérification des contraintes légales' : 'Legal constraint verification'}
        </p>
        {irregularites.length > 0 ? (
          <ul className="mt-2 space-y-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2">
            {irregularites.map((item, idx) => (
              <li key={`irr-${idx}`} className="text-[11px] font-medium text-orange-950">
                • {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-600">
            {locale === 'fr'
              ? 'Aucune dérogation juridique relevée sur le certificat.'
              : 'No legal derogation noted on the certificate.'}
          </p>
        )}
      </div>

      {clause ? (
        <div
          className={cn(
            'mt-3 rounded-lg border border-[#D4AF37]/40 bg-amber-50/60 px-2.5 py-2.5'
          )}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-700">
            {locale === 'fr'
              ? 'Saisie suggérée pour la Déclaration du vendeur (DV)'
              : 'Suggested wording for the seller declaration (DV)'}
          </p>
          <textarea
            readOnly
            value={clause}
            rows={5}
            className={cn(
              'mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2',
              'text-[11px] leading-snug text-[#142c6a]'
            )}
            aria-label={
              locale === 'fr' ? 'Clause suggérée section D' : 'Suggested section D clause'
            }
          />
          <button
            type="button"
            onClick={() => void handleCopyClause()}
            className={cn(
              'mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200',
              'bg-slate-50 px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-800',
              'hover:border-[#D4AF37]/50 hover:bg-amber-50'
            )}
          >
            <Copy className="h-3 w-3" />
            {clauseCopied
              ? locale === 'fr'
                ? 'Copié'
                : 'Copied'
              : locale === 'fr'
                ? 'Copier la clause'
                : 'Copy clause'}
          </button>
        </div>
      ) : null}

      {isValidated ? (
        <p className="mt-3 text-[11px] text-emerald-900">
          {locale === 'fr'
            ? 'Arpentage injecté à la fiche (cadastre).'
            : 'Survey data injected into the listing (cadastre).'}
        </p>
      ) : (
        <>
          {injectError ? (
            <p className="mt-2 text-[10px] font-semibold text-red-800" role="alert">
              {injectError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || injecting}
            onClick={onInject}
            className={cn(
              'mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/60',
              'bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#142c6a]',
              'hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {injecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {locale === 'fr' ? 'Injecter l’arpentage à la fiche' : 'Inject survey data to listing'}
          </button>
        </>
      )}
    </section>
  );
}

function ExtractionVerificationSection({
  locale,
  isVerified,
  amountRows,
  checkedIds,
  toggleRow,
  comparableRows,
  checkedComparableIds,
  toggleComparable,
  evaluationSubject,
  hasEvaluationSubject,
  siloType,
  detectedSilo,
  setSiloType,
  regionDisplayName,
  siloLabel,
  injectError,
  injecting,
  busy,
  onInject,
}: {
  locale: 'fr' | 'en';
  isVerified: boolean;
  amountRows: ReturnType<typeof listExtractedAmounts>;
  checkedIds: Set<string>;
  toggleRow: (id: string) => void;
  comparableRows: ReturnType<typeof listExtractedComparables>;
  checkedComparableIds: Set<string>;
  toggleComparable: (id: string) => void;
  evaluationSubject?: PropertyDocumentExtractedData['sujet'];
  hasEvaluationSubject: boolean;
  siloType: MarketSiloType;
  detectedSilo: MarketSiloType;
  setSiloType: (v: MarketSiloType) => void;
  regionDisplayName: string;
  siloLabel: string;
  injectError: string | null;
  injecting: boolean;
  busy: boolean;
  onInject: () => void;
}) {
  const injectDisabled =
    busy ||
    injecting ||
    (checkedIds.size === 0 &&
      checkedComparableIds.size === 0 &&
      !hasEvaluationSubject);
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">
        {locale === 'fr' ? 'Détails de l’extraction IA' : 'AI extraction details'}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-800">
        {locale === 'fr'
          ? 'Vérification des montants et contraintes'
          : 'Amount and constraint verification'}
      </p>

      {isVerified ? (
        <p className="mt-2 text-[11px] text-emerald-900">
          {locale === 'fr'
            ? 'Données injectées dans la fiche et transmises au Big Data anonymisé.'
            : 'Data injected into the listing and sent to anonymized market data.'}
        </p>
      ) : (
        <>
          {hasEvaluationSubject && evaluationSubject ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                {locale === 'fr' ? 'Sujet évalué (Identité)' : 'Subject property (Identity)'}
              </p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-800">
                {evaluationSubject.anneeConstruction != null ? (
                  <li>
                    {locale === 'fr' ? 'Année construction : ' : 'Year built: '}
                    <span className="font-black text-[#142c6a]">
                      {evaluationSubject.anneeConstruction}
                    </span>
                  </li>
                ) : null}
                {evaluationSubject.superficieTotale != null ? (
                  <li>
                    {locale === 'fr' ? 'Superficie : ' : 'Area: '}
                    <span className="font-black text-[#142c6a]">
                      {evaluationSubject.superficieTotale.toLocaleString(
                        locale === 'fr' ? 'fr-CA' : 'en-CA'
                      )}{' '}
                      m²
                    </span>
                  </li>
                ) : null}
                {evaluationSubject.tgaRetenu != null ? (
                  <li>
                    {locale === 'fr' ? 'Taux de capitalisation (TGA) : ' : 'Capitalization rate (cap rate): '}
                    <span className="font-black text-[#142c6a]">
                      {capitalizationRateToPercent(evaluationSubject.tgaRetenu)?.toFixed(2) ?? '—'}
                      %
                    </span>
                  </li>
                ) : null}
                {evaluationSubject.valeurAvaluee != null ? (
                  <li>
                    {locale === 'fr' ? 'Valeur agréée : ' : 'Appraised value: '}
                    <span className="font-black text-[#142c6a]">
                      {formatExtractedCurrency(evaluationSubject.valeurAvaluee, locale)}
                    </span>
                  </li>
                ) : null}
              </ul>
              <p className="mt-1 text-[10px] text-slate-600">
                {locale === 'fr'
                  ? 'Ces champs seront injectés dans l’onglet Identité lors de l’injection.'
                  : 'These fields will be injected into Identity on save.'}
              </p>
            </div>
          ) : null}
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
              {locale === 'fr' ? 'Silo identifié (fiche)' : 'Silo identified (listing)'}
            </p>
            <p className="mt-0.5 text-[11px] font-black text-[#142c6a]">{siloLabel}</p>
            {siloType !== detectedSilo ? (
              <p className="mt-1 text-[10px] text-amber-800">
                {locale === 'fr' ? 'Ajustement manuel actif' : 'Manual override active'}
              </p>
            ) : null}
          </div>

          <label className="mt-2 block">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
              {locale === 'fr' ? 'Ajuster le silo (optionnel)' : 'Adjust silo (optional)'}
            </span>
            <select
              value={siloType}
              onChange={(e) => setSiloType(e.target.value as MarketSiloType)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-[#142c6a]"
            >
              {MARKET_SILO_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {locale === 'fr' ? opt.labelFr : opt.labelEn}
                </option>
              ))}
            </select>
          </label>

          {amountRows.length > 0 ? (
            <ul className="mt-3 max-h-[200px] space-y-2 overflow-y-auto pr-1">
              {amountRows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start gap-2 rounded-lg border border-white bg-white px-2 py-2 shadow-sm"
                >
                  <input
                    type="checkbox"
                    checked={checkedIds.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    className="mt-1 h-3.5 w-3.5 shrink-0 accent-[#D4AF37]"
                    aria-label={row.label}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium leading-snug text-slate-700">{row.label}</p>
                    <p className="font-mono text-[12px] font-black text-[#142c6a]">
                      {formatExtractedCurrency(row.value, locale)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {comparableRows.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-slate-800">
                {locale === 'fr'
                  ? 'Données des immeubles comparables détectées'
                  : 'Detected comparable building data'}
              </p>
              <ul className="mt-2 max-h-[180px] space-y-2 overflow-y-auto pr-1">
                {comparableRows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start gap-2 rounded-lg border border-white bg-white px-2 py-2 shadow-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checkedComparableIds.has(row.id)}
                      onChange={() => toggleComparable(row.id)}
                      className="mt-1 h-3.5 w-3.5 shrink-0 accent-[#D4AF37]"
                      aria-label={row.displayLabel}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black leading-snug text-[#142c6a]">
                        {row.displayLabel}
                      </p>
                      {row.salePrice != null ? (
                        <p className="text-[10px] text-slate-600">
                          {formatExtractedCurrency(row.salePrice, locale)}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {injectError ? (
            <p className="mt-2 text-[10px] font-semibold text-red-800" role="alert">
              {injectError}
            </p>
          ) : null}

          <button
            type="button"
            disabled={injectDisabled}
            onClick={onInject}
            className={cn(
              'mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/60',
              'bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#142c6a]',
              'hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {injecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {locale === 'fr' ? 'Injecter et alimenter le Big Data' : 'Inject and feed market data'}
          </button>

          <p className="mt-2 text-[10px] leading-snug text-slate-600">
            🔒{' '}
            {locale === 'fr'
              ? `En injectant, ces données anonymisées alimenteront les statistiques de marché de la région ${regionDisplayName} pour la catégorie ${siloLabel}.`
              : `By injecting, these anonymized data will feed market statistics for ${regionDisplayName} (${siloLabel}).`}
          </p>
        </>
      )}
    </section>
  );
}

function DocumentActions({
  labels,
  locale,
  document,
  downloadAllowed,
  busy,
  confirming,
  setConfirming,
  onDownload,
  onDelete,
}: {
  labels: DocumentMetadataPanelProps['labels'];
  locale: 'fr' | 'en';
  document: PropertyDocumentRecord;
  downloadAllowed: boolean;
  busy: boolean;
  confirming: boolean;
  setConfirming: (v: boolean) => void;
  onDownload: (doc: PropertyDocumentRecord) => Promise<void>;
  onDelete: (doc: PropertyDocumentRecord) => Promise<void>;
}) {
  return (
    <div className="mt-auto shrink-0 space-y-2 border-t border-slate-200 p-4">
      {!downloadAllowed ? (
        <p className="text-center text-[10px] font-semibold text-amber-800">{labels.downloadBlocked}</p>
      ) : null}
      <button
        type="button"
        disabled={busy || !downloadAllowed}
        onClick={() => void onDownload(document)}
        title={!downloadAllowed ? labels.downloadBlocked : undefined}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5',
          'text-[10px] font-black uppercase tracking-widest text-slate-800',
          'hover:border-[#D4AF37]/50 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {labels.download}
      </button>

      {!confirming ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-800 hover:bg-red-100 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {labels.delete}
        </button>
      ) : (
        
          <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-[11px] text-red-900">{labels.confirmDelete}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-700"
              >
                {locale === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void onDelete(document).finally(() => setConfirming(false));
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-700 px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-white"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                {labels.delete}
              </button>
            </div>
          </div>
        
      )}
    </div>
  );
}
