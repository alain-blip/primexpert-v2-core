/**
 * Cartes KPI Dashboard GPS — clone exact V1 (MarketDashboard.jsx · KPICard).
 */

import type { MarketGpsDashboardMetrics } from '@primexpert/core/market';

type KpiColor = 'emerald' | 'blue' | 'amber' | 'purple';

/** Carte KPI Marché — dégradés alignés sur l'UI V1. */
function KPICard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  color: KpiColor;
}) {
  const gradient = {
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    amber: 'from-amber-500 to-orange-600',
    purple: 'from-purple-500 to-purple-600',
  }[color];

  return (
    <div className={`rounded-xl p-5 text-white shadow-lg bg-gradient-to-br ${gradient}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/80 uppercase tracking-wide leading-tight">{title}</p>
          <p className="text-xl font-bold mt-2 tabular-nums break-words">{value}</p>
          {subtitle ? <p className="text-xs text-white/70 mt-1">{subtitle}</p> : null}
        </div>
        <span className="text-2xl shrink-0 opacity-95" aria-hidden>
          {icon}
        </span>
      </div>
    </div>
  );
}

function fmtCurrency(n: number | undefined, locale: 'fr' | 'en'): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function MarketGpsKpiCards({
  metrics,
  locale,
  t,
}: {
  metrics: MarketGpsDashboardMetrics;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
}) {
  const tgaValue =
    metrics.tgaMedian != null
      ? locale === 'fr'
        ? `${metrics.tgaMedian.toFixed(1).replace('.', ',')} %`
        : `${metrics.tgaMedian.toFixed(1)} %`
      : '—';

  const mrbValue = metrics.mrbMedian != null ? `${metrics.mrbMedian.toFixed(2)}x` : '—';
  const prixUnitValue = fmtCurrency(metrics.prixUnitMedian, locale);
  const rdeValue =
    metrics.rdeMedian != null
      ? locale === 'fr'
        ? `${metrics.rdeMedian.toFixed(1).replace('.', ',')} %`
        : `${metrics.rdeMedian.toFixed(1)} %`
      : '—';

  const countSubtitle = t(
    `${metrics.transactionCount} comparables`,
    `${metrics.transactionCount} comparables`
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <KPICard
        title={t('Taux de capitalisation (TGA)', 'Capitalization rate (cap rate)')}
        value={tgaValue}
        subtitle={t('Médiane marché', 'Market median')}
        icon="📈"
        color="emerald"
      />
      <KPICard
        title={t('Multiplicateur revenu brut (MRB)', 'Gross rent multiplier (GRM)')}
        value={mrbValue}
        subtitle={t('Médiane marché', 'Market median')}
        icon="💰"
        color="blue"
      />
      <KPICard
        title={t('Prix / unité', 'Price / unit')}
        value={prixUnitValue}
        subtitle={countSubtitle}
        icon="🏠"
        color="purple"
      />
      <KPICard
        title={t('Ratio des dépenses d\'exploitation (RDE)', 'Operating expense ratio (OER)')}
        value={rdeValue}
        subtitle={t('Médiane régionale', 'Regional median')}
        icon="💸"
        color="amber"
      />
    </div>
  );
}
