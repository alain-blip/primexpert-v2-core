/**
 * Panneau d'assemblage — documents maîtres (contrats / promesse d'achat) et annexes.
 * Toutes les variables entre parenthèses ( ) sont reliées à l'état local réactif.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import {
  CONTRACT_DOCUMENT_CATALOG,
  buildContractAssemblerDefaults,
  buildPaActifsRenderData,
  renderContractAssemblerToHtml,
  type ContractAnnexeId,
  type ContractAssemblerFieldState,
  type ParenthesisFieldDef,
  type ParenthesisFieldKind,
} from '@primexpert/core/forms';
import {
  normalizeAdministrativeRegion,
  resolveResidenceRpaBuildingClass,
} from '@primexpert/core/market';
import type { Residence } from '../../../services/residences';
import { inst, InstitutionalSection } from '../institutional/InstitutionalUi';
import {
  institutionalListingsInlineInputClass,
  institutionalListingsSecondaryButtonClass,
} from '../../../lib/institutionalTheme';
import { useLanguage } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { useTerritorialCompetition } from '../../../hooks/useTerritorialCompetition';

const fieldClass = `${institutionalListingsInlineInputClass} text-sm disabled:bg-slate-50`;

function inputTypeFor(kind: ParenthesisFieldKind): 'number' | 'text' {
  return kind === 'money' || kind === 'percent' || kind === 'days' ? 'number' : 'text';
}

export interface ContractAssemblerPanelProps {
  residence: Residence;
  residenceDoc?: Record<string, unknown> | null;
  locked?: boolean;
}

export function ContractAssemblerPanel({
  residence,
  residenceDoc,
  locked = false,
}: ContractAssemblerPanelProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const { profile } = useAuth();
  const { financialData } = useFinancialData();

  const regionAdministrative = useMemo(() => {
    const raw = String(
      residenceDoc?.regionAdministrative ?? residence.region ?? residence.city ?? ''
    ).trim();
    if (!raw) return '';
    return normalizeAdministrativeRegion(raw, residence.city ?? undefined);
  }, [residenceDoc, residence]);

  const classeImmeuble = useMemo(
    () =>
      resolveResidenceRpaBuildingClass(
        (residenceDoc ?? undefined) as Record<string, unknown> | undefined,
        residence
      ),
    [residenceDoc, residence]
  );

  const territorialCompetition = useTerritorialCompetition({
    regionAdministrative,
    classeImmeuble,
    enabled: Boolean(regionAdministrative),
  });

  const broker = useMemo(
    () => ({
      displayName: profile?.displayName ?? '—',
      licenseNumber: profile?.licenseName ?? '—',
      agencyName: profile?.agency ?? '—',
      email: profile?.email,
      phone: profile?.phone,
    }),
    [profile]
  );

  const territorial = useMemo(
    () => ({
      medianTgaPct: territorialCompetition.medianTgaPct,
      sampleCount: territorialCompetition.sampleCount,
      regionAdministrative: territorialCompetition.regionAdministrative,
      classeImmeuble: territorialCompetition.classeImmeuble,
    }),
    [
      territorialCompetition.medianTgaPct,
      territorialCompetition.sampleCount,
      territorialCompetition.regionAdministrative,
      territorialCompetition.classeImmeuble,
    ]
  );

  const defaultState = useMemo(
    () =>
      buildContractAssemblerDefaults({
        locale,
        residence: residence as unknown as Record<string, unknown>,
        residenceDoc,
        financialData: financialData as Record<string, unknown> | null,
        promesseDoc: residenceDoc ?? undefined,
        broker,
        territorial,
      }),
    [locale, residence, residenceDoc, financialData, broker, territorial]
  );

  const [assembler, setAssembler] = useState<ContractAssemblerFieldState>(defaultState);

  const [generating, setGenerating] = useState(false);

  const suggestedPrix = defaultState.values['annexePrix.nouveauPrix'];

  useEffect(() => {
    setAssembler((prev) => ({
      ...prev,
      values: {
        ...prev.values,
        'annexePrix.nouveauPrix':
          prev.values['annexePrix.nouveauPrix'] ?? suggestedPrix,
      },
    }));
  }, [suggestedPrix]);

  const toggleAnnexe = useCallback((id: ContractAnnexeId, checked: boolean) => {
    setAssembler((prev) => ({
      ...prev,
      selection: { ...prev.selection, [id]: checked },
    }));
  }, []);

  const setFieldValue = useCallback(
    (field: ParenthesisFieldDef, raw: string) => {
      const next =
        raw === ''
          ? undefined
          : inputTypeFor(field.kind) === 'number'
            ? Number(raw)
            : raw;
      setAssembler((prev) => ({
        ...prev,
        values: { ...prev.values, [field.key]: next },
      }));
    },
    []
  );

  const paData = useMemo(
    () =>
      buildPaActifsRenderData({
        locale,
        residence: residence as unknown as Record<string, unknown>,
        residenceDoc,
        financialData: financialData as Record<string, unknown> | null,
        promesseDoc: residenceDoc ?? undefined,
        broker,
        territorial,
      }),
    [locale, residence, residenceDoc, financialData, broker, territorial]
  );

  const suggestedPrixLabel = useMemo(() => {
    if (suggestedPrix == null || typeof suggestedPrix !== 'number' || !Number.isFinite(suggestedPrix)) {
      return null;
    }
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    }).format(suggestedPrix);
  }, [suggestedPrix, locale]);

  const handleExportHtml = useCallback(() => {
    setGenerating(true);
    try {
      const html = renderContractAssemblerToHtml({
        locale,
        paData,
        assembler,
        residenceLabel: residence.address,
      });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dossier-courtage-${residence.id}-${Date.now()}.html`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }, [assembler, locale, paData, residence.address, residence.id]);

  return (
    <InstitutionalSection
      title={t('Assemblage contrat et annexes', 'Contract and schedule assembly')}
    >
      <p className="text-sm text-slate-600 leading-relaxed mb-4">
        {t(
          'Cochez les pièces à inclure. Les variables entre parenthèses des documents et annexes sont paramétrées ci-dessous — revue de conformité du graphe contractuel sans fusion Word.',
          'Select documents to include. Parenthesis variables for documents and schedules are configured below — contract graph compliance review without Word merge.'
        )}
      </p>

      <div className="space-y-3 mb-6">
        {CONTRACT_DOCUMENT_CATALOG.map((item) => {
          const checked = assembler.selection[item.id];
          return (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3"
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  checked={checked}
                  disabled={locked}
                  onChange={(e) => toggleAnnexe(item.id, e.target.checked)}
                />
                <span>
                  <span className="inline-block mb-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border border-slate-200 rounded px-1.5 py-0.5">
                    {item.codeFr}
                  </span>
                  <span className="block text-sm font-bold text-slate-900">
                    {language === 'fr' ? item.labelFr : item.labelEn}
                  </span>
                </span>
              </label>

              {checked && item.fields.length > 0 ? (
                <div className="mt-3 grid gap-3 pl-7 sm:grid-cols-2">
                  {item.fields.map((field) => (
                    <label key={field.key} className="block space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                        {language === 'fr' ? field.labelFr : field.labelEn}
                      </span>
                      <input
                        type={inputTypeFor(field.kind)}
                        step={field.kind === 'percent' ? 0.05 : undefined}
                        min={field.kind === 'percent' || field.kind === 'days' ? 0 : undefined}
                        className={fieldClass}
                        disabled={locked}
                        value={assembler.values[field.key] ?? ''}
                        onChange={(e) => setFieldValue(field, e.target.value)}
                      />
                      {field.key === 'annexePrix.nouveauPrix' && suggestedPrixLabel ? (
                        <p className="text-[11px] text-slate-600">
                          {t(
                            'Suggestion ACM (revenu net d’exploitation (RNE) ÷ taux de capitalisation global (TGA) ajusté)',
                            'ACM suggestion (net operating income (NOI) ÷ adjusted global cap rate)'
                          )}
                          : {suggestedPrixLabel}
                        </p>
                      ) : null}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {territorialCompetition.loading ? (
        <p className={inst.loadingText}>
          <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
          {t('Chargement comparables territoriaux…', 'Loading territorial comparables…')}
        </p>
      ) : null}

      <button
        type="button"
        disabled={locked || generating}
        onClick={handleExportHtml}
        className={institutionalListingsSecondaryButtonClass}
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        {t('Exporter le dossier HTML', 'Export HTML package')}
      </button>
    </InstitutionalSection>
  );
}
