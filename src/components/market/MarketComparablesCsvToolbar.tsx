/**
 * Barre d'outils CSV comparables GPS — import / export / validation doublons.
 */

import React, { useCallback, useRef, useState } from 'react';
import { AlertTriangle, Download, Loader2, Upload } from 'lucide-react';
import {
  parseGpsComparablesCsv,
  type DedupeRowMetadata,
  type GpsComparableCsvRow,
  type MarketGpsTransaction,
} from '@primexpert/core/market';
import { cn } from '../../lib/utils';
import {
  downloadGpsComparablesTemplate,
  exportGpsComparablesCsv,
  importGpsComparableRows,
  prepareCsvImportWithDedupe,
} from '../../services/marketComparablesImportService';

type ImportRow = GpsComparableCsvRow & { _dedupe: DedupeRowMetadata };

export interface MarketComparablesCsvToolbarProps {
  locale: 'fr' | 'en';
  brokerId?: string | null;
  transactions: MarketGpsTransaction[];
  filteredTransactions: MarketGpsTransaction[];
  t: (fr: string, en: string) => string;
}

export function MarketComparablesCsvToolbar({
  locale,
  brokerId,
  transactions,
  filteredTransactions,
  t,
}: MarketComparablesCsvToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingRows, setPendingRows] = useState<ImportRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setImportMessage(null);
      const text = await file.text();
      const { rows, errors } = parseGpsComparablesCsv(text);
      setParseErrors(errors);
      if (!rows.length) return;
      const tagged = prepareCsvImportWithDedupe(rows, transactions) as ImportRow[];
      setPendingRows(tagged);
    },
    [transactions]
  );

  const setRowAction = (index: number, action: 'import' | 'skip') => {
    setPendingRows((prev) => {
      if (!prev) return prev;
      return prev.map((r, i) =>
        i === index ? { ...r, _dedupe: { ...r._dedupe, userAction: action } } : r
      );
    });
  };

  const confirmImport = async () => {
    if (!pendingRows?.length || !brokerId) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const result = await importGpsComparableRows(pendingRows, brokerId);
      setImportMessage(
        t(
          `${result.imported} comparable(s) importé(s), ${result.skipped} ignoré(s).`,
          `${result.imported} comparable(s) imported, ${result.skipped} skipped.`
        )
      );
      setPendingRows(null);
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const btnClass =
    'inline-flex items-center gap-1.5 rounded-lg border-2 border-[#142c6a]/40 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#142c6a] hover:bg-slate-50 disabled:opacity-50';

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnClass} onClick={() => downloadGpsComparablesTemplate()}>
          <Download className="h-3.5 w-3.5" />
          {t('Modèle CSV', 'CSV template')}
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={!brokerId}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          {t('Importer CSV', 'Import CSV')}
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={!filteredTransactions.length}
          onClick={() =>
            exportGpsComparablesCsv(
              filteredTransactions.map((row) => ({
                canal_import: 'Centris',
                ville: row.city,
                address: row.address,
                prixVente: row.prixVente,
                nombre_unites: row.nbPortes,
                prixParPorte: row.prixParPorte,
                date: row.date,
                region: row.region,
              }))
            )
          }
        >
          <Download className="h-3.5 w-3.5" />
          {t('Exporter CSV', 'Export CSV')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {parseErrors.length ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
          {parseErrors.slice(0, 5).map((err) => (
            <p key={err}>{err}</p>
          ))}
        </div>
      ) : null}

      {importMessage ? (
        <p className="text-[11px] font-bold text-emerald-800" role="status">
          {importMessage}
        </p>
      ) : null}

      {pendingRows ? (
        <div className="rounded-xl border-2 border-[#142c6a] bg-white p-4 space-y-3 shadow-lg">
          <p className="text-sm font-black text-[#142c6a]">
            {t('Validation import CSV — comparables', 'CSV import validation — comparables')}
          </p>
          <p className="text-[11px] text-slate-600">
            {t(
              'Les doublons potentiels sont marqués. Choisissez d’importer ou d’ignorer chaque ligne.',
              'Potential duplicates are flagged. Choose import or skip for each row.'
            )}
          </p>
          <div className="max-h-64 overflow-auto">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="py-1 pr-2">{t('Ville', 'City')}</th>
                  <th className="py-1 pr-2">{t('Prix', 'Price')}</th>
                  <th className="py-1 pr-2">{t('Date', 'Date')}</th>
                  <th className="py-1 pr-2">{t('Statut', 'Status')}</th>
                  <th className="py-1">{t('Action', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {pendingRows.map((row, i) => (
                  <tr
                    key={`${row.ville_comparable}-${row.prix_vente}-${i}`}
                    className="border-t border-slate-100"
                  >
                    <td className="py-2 pr-2 font-semibold">{row.ville_comparable}</td>
                    <td className="py-2 pr-2 tabular-nums">
                      {row.prix_vente.toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')} $
                    </td>
                    <td className="py-2 pr-2">{row.date_vente ?? '—'}</td>
                    <td className="py-2 pr-2">
                      {row._dedupe.status === 'duplicate' ? (
                        <span className="inline-flex items-center gap-1 text-amber-800 font-bold">
                          <AlertTriangle className="h-3 w-3" />
                          {t('Doublon', 'Duplicate')}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold">{t('Unique', 'Unique')}</span>
                      )}
                    </td>
                    <td className="py-2">
                      <select
                        value={row._dedupe.userAction}
                        onChange={(e) => setRowAction(i, e.target.value as 'import' | 'skip')}
                        className="rounded border border-slate-300 text-[11px] px-2 py-1"
                      >
                        <option value="import">{t('Importer', 'Import')}</option>
                        <option value="skip">{t('Ignorer', 'Skip')}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button type="button" className={btnClass} onClick={() => setPendingRows(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button
              type="button"
              className={cn(btnClass, 'bg-[#142c6a] text-white border-[#142c6a]')}
              disabled={importing || !brokerId}
              onClick={() => void confirmImport()}
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t('Confirmer l’import', 'Confirm import')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
