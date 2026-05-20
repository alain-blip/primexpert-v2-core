import { Shield } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import type { PublicationGuardrailsEvaluation } from '@primexpert/core/diffusion';
import { PUBLICATION_GUARDRAIL_STATUS } from '@primexpert/core/diffusion';

export interface ConfidentialityChecklistProps {
  evaluation: PublicationGuardrailsEvaluation | null;
}

function statusIcon(status: string): string {
  if (status === PUBLICATION_GUARDRAIL_STATUS.PASS) return '✅';
  if (status === PUBLICATION_GUARDRAIL_STATUS.WARN) return '⚠️';
  return '❌';
}

function ProgressBlocks({ score, max }: { score: number; max: number }) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="img"
      aria-label={`${score} sur ${max} vérifications réussies`}
    >
      {Array.from({ length: max }, (_, index) => (
        <span
          key={index}
          className={cn(
            'h-5 w-5 rounded-sm border-2 border-black shrink-0',
            index < score ? 'bg-black' : 'bg-white'
          )}
        />
      ))}
    </div>
  );
}

export function ConfidentialityChecklist({ evaluation }: ConfidentialityChecklistProps) {
  const { t, language } = useLanguage();

  if (!evaluation) {
    return (
      <section className="rounded-xl border-2 border-primexpert-dark bg-white px-6 py-8">
        <p className="text-[15px] font-semibold text-slate-600">
          {t('Chargement des vérifications…', 'Loading compliance checks…')}
        </p>
      </section>
    );
  }

  const { score, maxScore, isPublishable, results } = evaluation;

  return (
    <section
      className="rounded-xl border-4 border-primexpert-dark bg-white px-6 py-8 space-y-6"
      aria-label={t('Vérification confidentialité OACIQ', 'OACIQ confidentiality verification')}
    >
      <header className="flex flex-wrap items-start gap-4 justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Shield className="h-10 w-10 text-primexpert-dark shrink-0" aria-hidden />
          <div>
            <p className="text-[14px] font-black uppercase tracking-wider text-primexpert-dark">
              {t('Diligence raisonnable — publication web', 'Due diligence — web publication')}
            </p>
            <p className="text-[28px] font-black tabular-nums text-primexpert-dark mt-2 leading-none">
              {t('Score de conformité', 'Compliance score')} : {score} / {maxScore}
            </p>
            <p className="text-[15px] font-semibold text-slate-700 mt-2">
              {isPublishable
                ? t(
                    'Tous les points bloquants sont validés — publication autorisée.',
                    'All blocking checks passed — publishing allowed.'
                  )
                : t(
                    'Points bloquants en échec — corrigez avant publication en ligne.',
                    'Blocking checks failed — fix before going live.'
                  )}
            </p>
          </div>
        </div>
        <ProgressBlocks score={score} max={maxScore} />
      </header>

      <ul className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        {results.map((item) => {
          const label = language === 'fr' ? item.labelFr : item.labelEn;
          const detail = language === 'fr' ? item.detailFr : item.detailEn;
          return (
            <li
              key={item.id}
              className={cn(
                'rounded-xl border-2 px-4 py-3',
                item.status === PUBLICATION_GUARDRAIL_STATUS.PASS &&
                  'border-emerald-300 bg-emerald-50',
                item.status === PUBLICATION_GUARDRAIL_STATUS.WARN &&
                  'border-amber-400 bg-amber-50',
                item.status === PUBLICATION_GUARDRAIL_STATUS.FAIL &&
                  'border-red-400 bg-red-50'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-[22px] leading-none shrink-0" aria-hidden>
                  {statusIcon(item.status)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-black text-primexpert-dark leading-snug">{label}</p>
                  {detail ? (
                    <p className="text-[14px] font-medium text-slate-700 mt-1 leading-relaxed">
                      {detail}
                    </p>
                  ) : null}
                  {item.blocking && item.status === PUBLICATION_GUARDRAIL_STATUS.FAIL ? (
                    <p className="text-[14px] font-black uppercase text-red-800 mt-2">
                      {t('Bloquant', 'Blocking')}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
