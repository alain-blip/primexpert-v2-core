/**
 * Panneau d'assemblage — contrat de courtage et annexes (champs entre parenthèses).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import {
  CONTRACT_ANNEXE_CATALOG,
  buildContractAssemblerDefaults,
  buildPaActifsRenderData,
  renderContractAssemblerToHtml,
  type ContractAnnexeId,
  type ContractAssemblerFieldState,
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

const fieldClass = `${institutionalListingsInlineInputClass} text-sm disabled:bg-slate-50`;

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

  const defaultState = useMemo(
    () =>
      buildContractAssemblerDefaults({
        locale,
        residence: residence as unknown as Record<string, unknown>,
        residenceDoc,
        financialData: financialData as Record<string, unknown> | null,
        promesseDoc: residenceDoc ?? undefined,
        broker,
        territorial: {
          medianTgaPct: territorialCompetition.medianTgaPct,
          sampleCount: territorialCompetition.sampleCount,
          regionAdministrative: territorialCompetition.regionAdministrative,
          classeImmeuble: territorialCompetition.classeImmeuble,
        },
      }),
    [
      locale,
      residence,
      residenceDoc,
      financialData,
      broker,
      territorialCompetition.medianTgaPct,
      territorialCompetition.sampleCount,
      territorialCompetition.regionAdministrative,
      territorialCompetition.classeImmeuble,
    ]
  );

  const [assembler, setAssembler] = useState<ContractAssemblerFieldState>(defaultState);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setAssembler((prev) => ({
      ...prev,
      annexePrix: {
        ...prev.annexePrix,
        nouveauPrixNumerique:
          prev.annexePrix.nouveauPrixNumerique ??
          defaultState.annexePrix.nouveauPrixNumerique,
      },
    }));
  }, [defaultState.annexePrix.nouveauPrixNumerique]);

  const toggleAnnexe = useCallback((id: ContractAnnexeId, checked: boolean) => {
    setAssembler((prev) => ({
      ...prev,
      selection: { ...prev.selection, [id]: checked },
    }));
  }, []);

  const paData = useMemo(
    () =>
      buildPaActifsRenderData({
        locale,
        residence: residence as unknown as Record<string, unknown>,
        residenceDoc,
        financialData: financialData as Record<string, unknown> | null,
        promesseDoc: residenceDoc ?? undefined,
        broker,
        territorial: {
          medianTgaPct: territorialCompetition.medianTgaPct,
          sampleCount: territorialCompetition.sampleCount,
          regionAdministrative: territorialCompetition.regionAdministrative,
          classeImmeuble: territorialCompetition.classeImmeuble,
        },
      }),
    [
      locale,
      residence,
      residenceDoc,
      financialData,
      broker,
      territorialCompetition,
    ]
  );

  const suggestedPrixLabel = useMemo(() => {
    const v = defaultState.annexePrix.nouveauPrixNumerique;
    if (v == null || !Number.isFinite(v)) return null;
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    }).format(v);
  }, [defaultState.annexePrix.nouveauPrixNumerique, locale]);

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
          'Cochez les pièces à inclure. Les champs entre parenthèses des annexes sont paramétrés ci-dessous — validation de conformité de structure sans fusion Word.',
          'Select documents to include. Parenthesis fields for schedules are configured below — structural compliance validation without Word merge.'
        )}
      </p>

      <div className="space-y-3 mb-6">
        {CONTRACT_ANNEXE_CATALOG.map((item) => {
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
                  <span className="block text-sm font-bold text-slate-900">
                    {language === 'fr' ? item.labelFr : item.labelEn}
                  </span>
                  {item.parenthesisHintFr && language === 'fr' ? (
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      {item.parenthesisHintFr}
                    </span>
                  ) : null}
                </span>
              </label>

              {checked && item.id === 'annexePrix' ? (
                <label className="mt-3 block space-y-1 pl-7">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    {t('Nouveau prix ( $ )', 'New price ( $ )')}
                  </span>
                  <input
                    type="number"
                    className={fieldClass}
                    disabled={locked}
                    value={assembler.annexePrix.nouveauPrixNumerique ?? ''}
                    onChange={(e) =>
                      setAssembler((prev) => ({
                        ...prev,
                        annexePrix: {
                          nouveauPrixNumerique:
                            e.target.value === '' ? undefined : Number(e.target.value),
                        },
                      }))
                    }
                  />
                  {suggestedPrixLabel ? (
                    <p className="text-[11px] text-slate-600">
                      {t(
                        'Suggestion ACM (revenu net d’exploitation (RNE) ÷ taux de capitalisation global (TGA) ajusté)',
                        'ACM suggestion (net operating income (NOI) ÷ adjusted global cap rate)'
                      )}
                      : {suggestedPrixLabel}
                    </p>
                  ) : null}
                </label>
              ) : null}

              {checked && item.id === 'annexeR' ? (
                <label className="mt-3 block space-y-1 pl-7">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    {t(
                      'Rétribution réduite ( % )',
                      'Reduced remuneration ( % )'
                    )}
                  </span>
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    max={100}
                    className={fieldClass}
                    disabled={locked}
                    value={assembler.annexeR.retributionPct ?? ''}
                    onChange={(e) =>
                      setAssembler((prev) => ({
                        ...prev,
                        annexeR: {
                          retributionPct:
                            e.target.value === '' ? undefined : Number(e.target.value),
                        },
                      }))
                    }
                  />
                </label>
              ) : null}

              {checked && item.id === 'annexeG' ? (
                <label className="mt-3 block space-y-1 pl-7">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    {t('Référence CCV-', 'CCV- reference')}
                  </span>
                  <input
                    type="text"
                    className={fieldClass}
                    disabled={locked}
                    placeholder="12345"
                    value={assembler.annexeG.ccvReference ?? ''}
                    onChange={(e) =>
                      setAssembler((prev) => ({
                        ...prev,
                        annexeG: { ccvReference: e.target.value || undefined },
                      }))
                    }
                  />
                </label>
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
