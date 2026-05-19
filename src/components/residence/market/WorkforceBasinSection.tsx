/**
 * Bassin de main-d'œuvre et clientèle — grilles démographiques éditables.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import {
  formatPopulationCount,
  resolveMarcheDemographics,
} from '@primexpert/core/market';
import { useLanguage } from '../../../lib/i18n';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import {
  useMarketDemographicsSave,
  type DemographicFieldId,
} from '../../../hooks/useMarketDemographicsSave';
import { InstitutionalSection } from '../institutional/InstitutionalUi';

function DemographicCell({
  label,
  sublabel,
  fieldId,
  displayValue,
  saving,
  getDraft,
  setDraft,
  onSave,
}: {
  label: string;
  sublabel?: string;
  fieldId: DemographicFieldId;
  displayValue: string;
  saving: boolean;
  getDraft: (fieldId: DemographicFieldId, display: string) => string;
  setDraft: (fieldId: DemographicFieldId, value: string) => void;
  onSave: (fieldId: DemographicFieldId, value: string) => void;
}) {
  const [local, setLocal] = useState(getDraft(fieldId, displayValue));

  useEffect(() => {
    setLocal(getDraft(fieldId, displayValue));
  }, [displayValue, fieldId, getDraft]);

  const handleBlur = useCallback(() => {
    setDraft(fieldId, local);
    void onSave(fieldId, local);
  }, [fieldId, local, onSave, setDraft]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5 flex items-center gap-1">
        {label}
        {saving ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : null}
      </p>
      {sublabel ? (
        <p className="text-[9px] text-slate-500 mb-2 leading-snug">{sublabel}</p>
      ) : null}
      <input
        type="text"
        inputMode="numeric"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleBlur}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xl font-black text-[#142c6a] tabular-nums focus:border-[#D4AF37]/50 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/25"
        placeholder="—"
      />
    </div>
  );
}

export function WorkforceBasinSection() {
  const { t } = useLanguage();
  const { residenceDoc } = useResidenceDocument();
  const demo = resolveMarcheDemographics(residenceDoc);
  const { savingFieldId, getDraft, setDraft, saveDemographicField } =
    useMarketDemographicsSave();

  const employmentTotal =
    demo.population15_24 != null || demo.population25_54 != null
      ? (demo.population15_24 ?? 0) + (demo.population25_54 ?? 0)
      : null;

  return (
    <InstitutionalSection
      title={t("Bassin de main-d'œuvre", 'Workforce basin')}
    >
      <div className="space-y-6">
        <p className="text-sm text-slate-600 leading-relaxed">
          {t(
            'Population locale par tranche d’âge — disponibilité des préposés (PAB) et réservoir de clients potentiels pour la souscription RPA.',
            'Local population by age band — PAB staffing availability and potential client pool for RPA underwriting.'
          )}
        </p>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-[#D4AF37]" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.14em] text-[#142c6a]">
              {t("Bassin d'emploi disponible", 'Available labour pool')}
            </h4>
            {employmentTotal != null && employmentTotal > 0 && (
              <span className="text-[10px] font-mono text-slate-500 ml-auto">
                {t('Total', 'Total')}: {formatPopulationCount(employmentTotal)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DemographicCell
              label={t('15 – 24 ans', '15 – 24 years')}
              sublabel={t('Relève, stages PAB', 'Entry-level, PAB trainees')}
              fieldId="population15_24"
              displayValue={formatPopulationCount(demo.population15_24)}
              saving={savingFieldId === 'population15_24'}
              getDraft={getDraft}
              setDraft={setDraft}
              onSave={saveDemographicField}
            />
            <DemographicCell
              label={t('25 – 54 ans', '25 – 54 years')}
              sublabel={t('Préposés et employés', 'Care aides and staff')}
              fieldId="population25_54"
              displayValue={formatPopulationCount(demo.population25_54)}
              saving={savingFieldId === 'population25_54'}
              getDraft={getDraft}
              setDraft={setDraft}
              onSave={saveDemographicField}
            />
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.14em] text-[#142c6a] mb-3">
            {t('Bassin de clients potentiels', 'Potential client pool')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <DemographicCell
              label={t('75 ans et plus', '75 years and over')}
              sublabel={
                demo.population75_source === 'regional_reference'
                  ? t(
                      `Repère régional${demo.regionalName ? ` — ${demo.regionalName}` : ''} (à affiner)`,
                      `Regional reference${demo.regionalName ? ` — ${demo.regionalName}` : ''} (refine as needed)`
                    )
                  : t('Clientèle cible RPA', 'RPA target clientele')
              }
              fieldId="population75_plus"
              displayValue={formatPopulationCount(demo.population75_plus)}
              saving={savingFieldId === 'population75_plus'}
              getDraft={getDraft}
              setDraft={setDraft}
              onSave={saveDemographicField}
            />
          </div>
        </div>

        <p className="text-[10px] text-slate-600 leading-relaxed border border-slate-200 rounded-xl bg-white px-4 py-2">
          {t(
            'Les effectifs se sauvegardent à la sortie du champ. Source recommandée : données municipales / ISQ pour la zone d’influence de la résidence.',
            'Counts save on blur. Recommended source: municipal / ISQ data for the residence trade area.'
          )}
        </p>
      </div>
    </InstitutionalSection>
  );
}
