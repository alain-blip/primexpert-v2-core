/**
 * Palmarès des concurrents majeurs — tri par nombre d'unités (région élargie).
 */

import React, { useMemo } from 'react';
import {
  competitorDisplayName,
  getCompetitorUnitCount,
  sortCompetitorsByUnitsDesc,
  type MarketCompetitorRow,
} from '@primexpert/core/market';
import { useLanguage } from '../../../lib/i18n';
import { inst } from '../institutional/InstitutionalUi';

const LEADERBOARD_SIZE = 10;

export function MajorCompetitorsLeaderboard({
  competitors,
}: {
  competitors: MarketCompetitorRow[];
}) {
  const { t, language } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';

  const leaders = useMemo(
    () => sortCompetitorsByUnitsDesc(competitors).slice(0, LEADERBOARD_SIZE),
    [competitors]
  );

  if (leaders.length === 0) return null;

  const maxUnits = getCompetitorUnitCount(leaders[0]);

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-[10px] font-black uppercase tracking-[0.14em] text-[#142c6a]">
          {t('Palmarès des concurrents majeurs', 'Major competitors leaderboard')}
        </h4>
        <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
          {t(
            'Classement par nombre d’unités dans le périmètre élargi — repère immédiat des gros joueurs locaux (distance Haversine).',
            'Ranked by unit count in the expanded perimeter — quick view of dominant local players (Haversine distance).'
          )}
        </p>
      </div>

      <div className={inst.tableWrap}>
        <table className={inst.table}>
          <thead>
            <tr>
              <th className={inst.th}>{t('Rang', 'Rank')}</th>
              <th className={inst.th}>{t('Résidence', 'Residence')}</th>
              <th className={inst.thRight}>{t('Unités', 'Units')}</th>
              <th className={inst.thRight}>{t('Distance', 'Distance')}</th>
              <th className={inst.th}>{t('Part relative', 'Relative share')}</th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((comp, index) => {
              const units = getCompetitorUnitCount(comp);
              const sharePct =
                maxUnits > 0 ? Math.round((units / maxUnits) * 100) : 0;
              const dist =
                comp._distanceKm != null ? `${comp._distanceKm} km` : '—';

              return (
                <tr key={comp.id} className={inst.tr}>
                  <td className="px-4 py-2.5 text-sm font-black text-[#142c6a]">
                    {index + 1}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-[#142c6a]">
                    {competitorDisplayName(comp)}
                  </td>
                  <td className={inst.tdValue}>{units > 0 ? units : '—'}</td>
                  <td className={inst.tdValueMono}>{dist}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div
                        className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden max-w-[100px]"
                        aria-hidden
                      >
                        <div
                          className="h-full rounded-full bg-[#D4AF37]/70"
                          style={{ width: `${sharePct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-[#142c6a] tabular-nums">
                        {units > 0 ? `${sharePct} %` : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
