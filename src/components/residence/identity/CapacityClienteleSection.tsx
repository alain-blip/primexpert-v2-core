import React from 'react';
import type { CapacityAggregatesView } from '@primexpert/core/identity';
import { shouldShowRaphaelForPath } from '@primexpert/core/identity';
import { IdentitySectionCard } from './IdentitySectionCard';
import { RaphaelBadge } from '../../msss/RaphaelBadge';

export interface CapacityClienteleSectionProps {
  capacity: CapacityAggregatesView;
  residenceDoc: Record<string, unknown>;
  language: 'fr' | 'en';
}

export function CapacityClienteleSection({
  capacity,
  residenceDoc,
  language,
}: CapacityClienteleSectionProps) {
  const t = (fr: string, en: string) => (language === 'fr' ? fr : en);
  const showCapacityBadge = shouldShowRaphaelForPath(residenceDoc, ['nombreUnitesTotal']);
  const showClienteleBadge = shouldShowRaphaelForPath(residenceDoc, ['clientele']);
  const showEffectifsBadge = shouldShowRaphaelForPath(residenceDoc, ['effectifs']);

  const effectifs =
    residenceDoc.effectifs && typeof residenceDoc.effectifs === 'object'
      ? (residenceDoc.effectifs as Record<string, unknown>)
      : null;

  return (
    <IdentitySectionCard
      title={t(
        'Capacité — Unités, Clientèle & RH',
        'Capacity — Units, clientele & staffing'
      )}
      accent="#059669"
    >
      <div className="space-y-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">
            {t('Répartition des unités', 'Unit mix')}
            <RaphaelBadge show={showCapacityBadge} />
          </p>
          {capacity.totalUnits != null ? (
            <p className="text-2xl font-black text-[#000000] mb-3">
              {capacity.totalUnits}{' '}
              <span className="text-sm font-semibold text-slate-600">
                {t('unités', 'units')}
              </span>
              {capacity.occupancyRate ? (
                <span className="ml-3 text-sm font-mono text-slate-600">
                  · {t('Occupation', 'Occupancy')} {capacity.occupancyRate}
                </span>
              ) : null}
            </p>
          ) : null}
          {capacity.unitsByType.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {capacity.unitsByType.map((row) => (
                <div
                  key={row.labelFr}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <p className="text-[9px] font-bold uppercase text-slate-500">
                    {language === 'fr' ? row.labelFr : row.labelEn}
                  </p>
                  <p className="text-lg font-black text-[#000000]">{row.count}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">
              {t('Détail par type non renseigné.', 'Unit mix not specified.')}
            </p>
          )}
        </div>

        {capacity.agePyramid.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">
              {t('Pyramide des âges — clientèle', 'Age pyramid — clientele')}
              <RaphaelBadge show={showClienteleBadge} />
            </p>
            <div className="space-y-2">
              {capacity.agePyramid.map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs font-semibold text-[#000000]">
                    {row.label}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500/80"
                      style={{ width: `${Math.min(100, row.pct)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-xs font-mono text-slate-600">
                    {row.count} ({row.pct.toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {effectifs && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">
              {t('Effectifs par quart', 'Staffing by shift')}
              <RaphaelBadge show={showEffectifsBadge} />
            </p>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  ['jourSemaine', t('Jour (sem.)', 'Day (wkdy)')],
                  ['jourFinSemaine', t('Jour (f.s.)', 'Day (wknd)')],
                  ['soir', t('Soir', 'Evening')],
                  ['nuit', t('Nuit', 'Night')],
                ] as const
              ).map(([key, label]) => {
                const v = effectifs[key];
                if (v === undefined || v === null) return null;
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <dt className="text-[9px] font-bold uppercase text-slate-500">{label}</dt>
                    <dd className="text-lg font-black text-[#000000]">{String(v)}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}
      </div>
    </IdentitySectionCard>
  );
}
