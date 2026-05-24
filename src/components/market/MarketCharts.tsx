/**
 * Graphiques Dashboard GPS — clone exact V1 (Chart.js · MarketDashboard.jsx).
 */

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import type { MarketGpsDashboardMetrics } from '@primexpert/core/market';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

function fmtCurrency(n: number | undefined, locale: 'fr' | 'en'): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function MarketCharts({
  metrics,
  locale,
  t,
}: {
  metrics: MarketGpsDashboardMetrics;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
}) {
  const regionRows = metrics.byRegion.slice(0, 10);
  const ratioDepenses = metrics.rdeMedian != null ? metrics.rdeMedian / 100 : undefined;
  const capacityLabels = metrics.byCapacity.map((b) => (locale === 'fr' ? b.labelFr : b.labelEn));
  const capacityValues = metrics.byCapacity.map((b) => b.prixUnitMedian ?? 0);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {t('🗺️ TGA par Région', '🗺️ Cap rate by region')}
          </h3>
          <div className="h-64">
            {regionRows.length > 0 ? (
              <Bar
                data={{
                  labels: regionRows.map((r) => r.region.substring(0, 25)),
                  datasets: [
                    {
                      label: t('TGA (%)', 'Cap rate (%)'),
                      data: regionRows.map((r) =>
                        r.tgaMedian != null ? Number(r.tgaMedian.toFixed(1)) : 0
                      ),
                      backgroundColor: regionRows.map((r) => {
                        const tga = r.tgaMedian ?? 0;
                        if (tga >= 10) return 'rgba(16, 185, 129, 0.8)';
                        if (tga >= 8) return 'rgba(245, 158, 11, 0.8)';
                        return 'rgba(239, 68, 68, 0.8)';
                      }),
                    },
                  ],
                }}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { x: { beginAtZero: true, max: 15 } },
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                {t('Aucune donnée TGA disponible', 'No cap rate data available')}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {t('📏 Distribution Prix / Unité (par taille)', '📏 Price / unit distribution (by size)')}
          </h3>
          <div className="h-64">
            <Bar
              data={{
                labels: capacityLabels,
                datasets: [
                  {
                    label: t('Prix / unité', 'Price / unit'),
                    data: capacityValues,
                    backgroundColor: [
                      'rgba(59, 130, 246, 0.7)',
                      'rgba(16, 185, 129, 0.7)',
                      'rgba(245, 158, 11, 0.7)',
                      'rgba(139, 92, 246, 0.7)',
                    ],
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { callback: (v) => `${(Number(v) / 1000).toFixed(0)}k$` },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {t('⚙️ Santé Opérationnelle', '⚙️ Operational health')}
          </h3>
          <div className="flex flex-col items-center justify-center">
            <div className="w-40 h-40">
              <Doughnut
                data={{
                  labels: [t('Dépenses', 'Expenses'), t('Marge', 'Margin')],
                  datasets: [
                    {
                      data: [
                        ratioDepenses != null ? ratioDepenses * 100 : 60,
                        ratioDepenses != null ? 100 - ratioDepenses * 100 : 40,
                      ],
                      backgroundColor: [
                        ratioDepenses != null && ratioDepenses > 0.7
                          ? 'rgba(239, 68, 68, 0.8)'
                          : ratioDepenses != null && ratioDepenses > 0.6
                            ? 'rgba(245, 158, 11, 0.8)'
                            : 'rgba(16, 185, 129, 0.8)',
                        'rgba(226, 232, 240, 0.5)',
                      ],
                      borderWidth: 0,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  cutout: '70%',
                  plugins: { legend: { display: false } },
                }}
              />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {ratioDepenses != null
                ? locale === 'fr'
                  ? `${(ratioDepenses * 100).toFixed(0).replace('.', ',')} %`
                  : `${(ratioDepenses * 100).toFixed(0)} %`
                : '—'}
            </p>
            <p className="text-sm text-slate-500">
              {t(
                "Ratio des dépenses d'exploitation (RDE) médian",
                'Median operating expense ratio (OER)'
              )}
            </p>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {t('📋 Détail par Région', '📋 Detail by region')}
          </h3>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">{t('Région', 'Region')}</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">{t('TGA', 'Cap rate')}</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">{t('Prix / unité', 'Price / unit')}</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">{t('Nb', 'Count')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.byRegion.map((r) => (
                  <tr key={r.region} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-800">{r.region}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      <span
                        className={
                          r.tgaMedian != null && r.tgaMedian >= 10
                            ? 'text-emerald-600'
                            : r.tgaMedian != null && r.tgaMedian >= 8
                              ? 'text-amber-600'
                              : r.tgaMedian != null
                                ? 'text-red-600'
                                : 'text-slate-400'
                        }
                      >
                        {r.tgaMedian != null
                          ? locale === 'fr'
                            ? `${r.tgaMedian.toFixed(1).replace('.', ',')} %`
                            : `${r.tgaMedian.toFixed(1)} %`
                          : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtCurrency(r.prixUnitMedian, locale)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

