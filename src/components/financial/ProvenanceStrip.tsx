/**
 * Bandeau de provenance — charte institutionnelle (fond clair).
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';

export type ProvenanceConfidenceTier = 'high' | 'medium' | 'low' | 'validation_required';

export interface ProvenanceStripProps {
  lastUpdated?: unknown;
  source?: string;
  confidenceTier?: ProvenanceConfidenceTier;
  coveragePercent?: number | null;
}

function formatDate(date: unknown, locale: string): string | null {
  if (!date) return null;
  let d: Date;
  if (
    typeof date === 'object' &&
    date !== null &&
    'toDate' in date &&
    typeof (date as { toDate: () => Date }).toDate === 'function'
  ) {
    d = (date as { toDate: () => Date }).toDate();
  } else if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string' || typeof date === 'number') {
    d = new Date(date);
  } else {
    return null;
  }
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

const SOURCE_LABELS: Record<string, { fr: string; en: string }> = {
  calculatedResults: { fr: 'Grille Revenus & Dépenses', en: 'Revenue & expense grid' },
  derivedData: { fr: 'Extraction / dérivé PDF', en: 'PDF extraction / derived' },
  none: { fr: 'Aucune source', en: 'No source' },
  extraction: { fr: 'Extraction PDF', en: 'PDF extraction' },
  manual: { fr: 'Saisie manuelle', en: 'Manual entry' },
};

export function ProvenanceStrip({
  lastUpdated,
  source = 'calculatedResults',
  confidenceTier = 'medium',
  coveragePercent,
}: ProvenanceStripProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';

  const configs = {
    high: {
      icon: CheckCircle2,
      label: t('Haute confiance', 'High confidence'),
      border: 'border-emerald-300',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      iconColor: 'text-emerald-700',
    },
    medium: {
      icon: Info,
      label: t('Confiance moyenne', 'Medium confidence'),
      border: 'border-slate-300',
      bg: 'bg-white',
      text: 'text-slate-800',
      iconColor: 'text-slate-600',
    },
    low: {
      icon: AlertTriangle,
      label: t('Faible confiance', 'Low confidence'),
      border: 'border-amber-300',
      bg: 'bg-amber-50',
      text: 'text-amber-900',
      iconColor: 'text-amber-700',
    },
    validation_required: {
      icon: ShieldAlert,
      label: t('Validation requise', 'Validation required'),
      border: 'border-red-300',
      bg: 'bg-red-50',
      text: 'text-red-900',
      iconColor: 'text-red-700',
    },
  };

  const tierConfig = configs[confidenceTier] ?? configs.medium;
  const Icon = tierConfig.icon;
  const srcLabel = SOURCE_LABELS[source]?.[locale === 'fr' ? 'fr' : 'en'] ?? source;
  const formattedDate = formatDate(lastUpdated, locale);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 mb-4 shadow-sm',
        tierConfig.border,
        tierConfig.bg
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={cn('h-4 w-4 shrink-0', tierConfig.iconColor)} />
        <span className={cn('text-[9px] font-black uppercase tracking-widest', tierConfig.text)}>
          {tierConfig.label}
        </span>
      </div>
      <span className="text-[10px] text-slate-600">
        {t('Source', 'Source')}:{' '}
        <span className="text-[#000000] font-semibold">{srcLabel}</span>
      </span>
      {formattedDate && (
        <span className="text-[10px] text-slate-600 font-mono">
          {t('Calcul', 'Computed')}:{' '}
          <span className="text-[#000000] font-medium">{formattedDate}</span>
        </span>
      )}
      {coveragePercent != null && (
        <span className="text-[10px] text-slate-600">
          {t('Couverture', 'Coverage')}:{' '}
          <span className="text-[#000000] font-semibold">{coveragePercent}%</span>
        </span>
      )}
    </div>
  );
}
