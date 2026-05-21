import React, { useCallback, useMemo } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import {
  buildComplianceItemStatusPatch,
  COMPLIANCE_ITEM_STATUSES,
  COMPLIANCE_STATUS_LABEL_EN,
  COMPLIANCE_STATUS_LABEL_FR,
  computeComplianceProgress,
  normalizeComplianceChecklist,
  RPA_DILIGENCE_CHECKLIST_ITEMS,
  type ComplianceItemStatus,
  type RpaDiligenceItemId,
} from '@primexpert/core/residence';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { useLanguage } from '../../../lib/i18n';
import { cn } from '../../../lib/utils';

export function RpaComplianceChecklistPanel() {
  const { t, language } = useLanguage();
  const { residenceDoc, updateResidence, saving } = useResidenceDocument();
  const isFr = language === 'fr';

  const checklist = useMemo(
    () => normalizeComplianceChecklist(residenceDoc ?? undefined),
    [residenceDoc]
  );

  const progress = useMemo(() => computeComplianceProgress(checklist), [checklist]);

  const handleStatusChange = useCallback(
    async (itemId: RpaDiligenceItemId, status: ComplianceItemStatus) => {
      if (!residenceDoc) return;
      await updateResidence(buildComplianceItemStatusPatch(residenceDoc, itemId, status));
    },
    [residenceDoc, updateResidence]
  );

  const statusLabel = (st: ComplianceItemStatus) =>
    isFr ? COMPLIANCE_STATUS_LABEL_FR[st] : COMPLIANCE_STATUS_LABEL_EN[st];

  const statusTone = (st: ComplianceItemStatus) => {
    switch (st) {
      case 'VERIFIED':
        return 'border-emerald-400 bg-emerald-50 text-emerald-900';
      case 'REJECTED':
        return 'border-red-300 bg-red-50 text-red-900';
      case 'NOT_APPLICABLE':
        return 'border-slate-300 bg-slate-100 text-slate-700';
      default:
        return 'border-amber-300 bg-amber-50 text-amber-950';
    }
  };

  return (
    <section className="mb-6 rounded-2xl border-2 border-primexpert-dark bg-primexpert-light p-5 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primexpert-dark" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-primexpert-dark">
              {t(
                'Diligence raisonnable — conformité RPA',
                'Due diligence — RPA compliance'
              )}
            </h3>
            <p className="text-[11px] font-medium text-primexpert-dark/80 mt-0.5">
              {t(
                'Suivi des preuves requises avant transaction (données sur la fiche résidence).',
                'Track required evidence before transaction (stored on residence record).'
              )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-primexpert-dark">{progress.pct}%</p>
          <p className="text-[10px] font-bold uppercase text-primexpert-dark/70">
            {progress.verified}/{progress.total}{' '}
            {t('points couverts', 'items covered')}
          </p>
        </div>
      </div>

      {saving ? (
        <div className="flex items-center gap-2 text-xs text-primexpert-dark mb-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('Enregistrement…', 'Saving…')}
        </div>
      ) : null}

      <ul className="space-y-2">
        {RPA_DILIGENCE_CHECKLIST_ITEMS.map((def) => {
          const st = checklist.items[def.id]?.status ?? 'PENDING';
          return (
            <li
              key={def.id}
              className={cn(
                'flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border-2 px-4 py-3 bg-white',
                statusTone(st)
              )}
            >
              <span className="flex-1 text-sm font-bold">
                {isFr ? def.labelFr : def.labelEn}
              </span>
              <select
                className="rounded-lg border-2 border-primexpert-dark/20 bg-white px-3 py-1.5 text-[11px] font-black uppercase text-primexpert-dark min-w-[140px]"
                value={st}
                disabled={saving}
                onChange={(e) =>
                  void handleStatusChange(def.id, e.target.value as ComplianceItemStatus)
                }
              >
                {COMPLIANCE_ITEM_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
