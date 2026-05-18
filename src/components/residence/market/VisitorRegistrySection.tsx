/**
 * Pilier 3 — Registre de l’entrée visiteurs & achalandage physique.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { DoorOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  computeVisitorTractionStats,
  createVisitorVisitEntry,
  haversineKmBetweenEntrances,
  parseVisitorEntrance,
  parseVisitorVisitRegistry,
  type VisitorVisitChannel,
  type VisitorVisitEntry,
} from '@primexpert/core/market';
import { useLanguage } from '../../../lib/i18n';
import { cn } from '../../../lib/utils';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import {
  inst,
  InstitutionalKpi,
  InstitutionalSection,
} from '../institutional/InstitutionalUi';

const CHANNEL_OPTIONS: { value: VisitorVisitChannel; fr: string; en: string }[] = [
  { value: 'walk_in', fr: 'Passage spontané', en: 'Walk-in' },
  { value: 'referral', fr: 'Référence', en: 'Referral' },
  { value: 'web', fr: 'Site / annonce', en: 'Web / listing' },
  { value: 'broker', fr: 'Courtier', en: 'Broker' },
  { value: 'family', fr: 'Famille / proche', en: 'Family' },
  { value: 'other', fr: 'Autre', en: 'Other' },
];

export function VisitorRegistrySection() {
  const { t, language } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';
  const { residenceDoc, updateResidence, saving } = useResidenceDocument();

  const entries = useMemo(() => parseVisitorVisitRegistry(residenceDoc), [residenceDoc]);
  const stats = useMemo(() => computeVisitorTractionStats(entries), [entries]);
  const entrance = useMemo(() => parseVisitorEntrance(residenceDoc), [residenceDoc]);

  const marketLat = Number(residenceDoc?.latitude);
  const marketLng = Number(residenceDoc?.longitude);
  const hasMarket =
    !Number.isNaN(marketLat) && !Number.isNaN(marketLng) && marketLat !== 0 && marketLng !== 0;

  const offsetKm =
    entrance && hasMarket
      ? Math.round(haversineKmBetweenEntrances(marketLat, marketLng, entrance) * 1000) / 1000
      : null;

  const [entranceLat, setEntranceLat] = useState('');
  const [entranceLng, setEntranceLng] = useState('');
  const [savingEntrance, setSavingEntrance] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [visitorName, setVisitorName] = useState('');
  const [visitorRole, setVisitorRole] = useState('');
  const [channel, setChannel] = useState<VisitorVisitChannel>('walk_in');
  const [notes, setNotes] = useState('');

  const persistRegistry = useCallback(
    async (next: VisitorVisitEntry[]) => {
      await updateResidence({ visitorVisitRegistry: next });
    },
    [updateResidence]
  );

  const handleSaveEntrance = useCallback(async () => {
    const lat = Number(entranceLat.replace(',', '.'));
    const lng = Number(entranceLng.replace(',', '.'));
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    setSavingEntrance(true);
    try {
      await updateResidence({
        visitorEntrance: {
          lat,
          lng,
          source: 'manual_ui',
          label: t('Entrée visiteurs', 'Visitor entrance'),
          updatedAt: new Date().toISOString(),
        },
      });
    } finally {
      setSavingEntrance(false);
    }
  }, [entranceLat, entranceLng, updateResidence, t]);

  const handleClearEntrance = useCallback(async () => {
    setSavingEntrance(true);
    try {
      await updateResidence({ visitorEntrance: null });
      setEntranceLat('');
      setEntranceLng('');
    } finally {
      setSavingEntrance(false);
    }
  }, [updateResidence]);

  const handleAddVisit = useCallback(async () => {
    const entry = createVisitorVisitEntry({
      visitedAt: new Date(visitDate).toISOString(),
      visitorName: visitorName.trim() || undefined,
      visitorRole: visitorRole.trim() || undefined,
      channel,
      notes: notes.trim() || undefined,
    });
    await persistRegistry([entry, ...entries]);
    setVisitorName('');
    setVisitorRole('');
    setNotes('');
    setFormOpen(false);
  }, [visitDate, visitorName, visitorRole, channel, notes, entries, persistRegistry]);

  const handleRemoveVisit = useCallback(
    async (id: string) => {
      await persistRegistry(entries.filter((e) => e.id !== id));
    },
    [entries, persistRegistry]
  );

  const mapsLink =
    entrance && hasMarket
      ? `https://www.google.com/maps/dir/?api=1&origin=${marketLat},${marketLng}&destination=${entrance.lat},${entrance.lng}`
      : hasMarket
        ? `https://www.google.com/maps/search/?api=1&query=${marketLat},${marketLng}`
        : null;

  return (
    <InstitutionalSection
      title={t(
        'Pilier 3 — Registre de l’entrée visiteurs',
        'Pillar 3 — Visitor entrance registry'
      )}
    >
      <div className="space-y-6">
        <p className="text-sm text-slate-600 leading-relaxed">
          {t(
            'Achalandage physique : point d’accès visiteurs distinct du point marché (isochrones / concurrence). Fiches de visite pour la traction auprès des prêteurs commerciaux.',
            'Physical foot traffic: visitor access point distinct from market anchor (isochrones / competition). Visit log for commercial lender traction.'
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InstitutionalKpi
            label={t('Visites enregistrées', 'Recorded visits')}
            value={String(stats.totalVisits)}
          />
          <InstitutionalKpi
            label={t('30 derniers jours', 'Last 30 days')}
            value={String(stats.visitsLast30Days)}
          />
          <InstitutionalKpi
            label={t('90 derniers jours', 'Last 90 days')}
            value={String(stats.visitsLast90Days)}
          />
          <InstitutionalKpi
            label={t('Dernière visite', 'Last visit')}
            value={
              stats.lastVisitAt
                ? new Date(stats.lastVisitAt).toLocaleDateString(
                    lang === 'fr' ? 'fr-CA' : 'en-CA'
                  )
                : '—'
            }
          />
        </div>

        {/* Entrée visiteurs */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-[#D4AF37]" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.14em] text-[#000000]">
              {t('Entrée exacte (visites)', 'Exact visitor entrance')}
            </h4>
          </div>

          {!hasMarket ? (
            <p className="text-sm text-slate-600">
              {t(
                'Géolocalisez la résidence pour définir l’entrée visiteurs.',
                'Geolocate the residence to set the visitor entrance.'
              )}
            </p>
          ) : (
            <>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                {t(
                  'Point marché (concurrence) : coordonnées GPS de la résidence. L’entrée visiteurs peut différer (portail, stationnement visiteurs).',
                  'Market point (competition): residence GPS. Visitor entrance may differ (portal, visitor parking).'
                )}
              </p>
              {entrance ? (
                <p className="text-sm font-semibold text-[#000000] tabular-nums">
                  {entrance.lat.toFixed(6)}, {entrance.lng.toFixed(6)}
                  {offsetKm != null && (
                    <span className="text-slate-500 font-normal text-[10px] ml-2">
                      · {offsetKm} km {t('du point marché', 'from market point')}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-slate-500 italic">
                  {t('Aucune entrée enregistrée — navigation = point marché.', 'No entrance saved — navigation uses market point.')}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Latitude</span>
                  <input
                    type="text"
                    value={entranceLat || (entrance ? String(entrance.lat) : '')}
                    onChange={(e) => setEntranceLat(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-[#000000]"
                    placeholder={hasMarket ? String(marketLat) : ''}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Longitude</span>
                  <input
                    type="text"
                    value={entranceLng || (entrance ? String(entrance.lng) : '')}
                    onChange={(e) => setEntranceLng(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-[#000000]"
                    placeholder={hasMarket ? String(marketLng) : ''}
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingEntrance || saving}
                  onClick={() => void handleSaveEntrance()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#000000] hover:border-[#D4AF37]/50 disabled:opacity-50"
                >
                  {savingEntrance ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {t('Enregistrer l’entrée', 'Save entrance')}
                </button>
                {entrance && (
                  <button
                    type="button"
                    disabled={savingEntrance || saving}
                    onClick={() => void handleClearEntrance()}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-bold uppercase text-slate-600 hover:text-[#000000]"
                  >
                    {t('Effacer', 'Clear')}
                  </button>
                )}
                {mapsLink && (
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-bold uppercase text-slate-600 hover:text-[#000000]"
                  >
                    {t('Ouvrir dans Maps', 'Open in Maps')}
                  </a>
                )}
              </div>
            </>
          )}
        </div>

        {/* Fiches de visite */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.14em] text-[#000000]">
              {t('Fiches d’enregistrement', 'Visit log entries')}
            </h4>
            <button
              type="button"
              onClick={() => setFormOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#000000] hover:border-[#D4AF37]/50"
            >
              <Plus className="h-3.5 w-3.5" />
              {formOpen ? t('Fermer', 'Close') : t('Nouvelle visite', 'New visit')}
            </button>
          </div>

          {formOpen && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {t('Date de visite', 'Visit date')}
                  </span>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#000000]"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {t('Canal', 'Channel')}
                  </span>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as VisitorVisitChannel)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#000000]"
                  >
                    {CHANNEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {lang === 'fr' ? opt.fr : opt.en}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {t('Nom du visiteur', 'Visitor name')}
                  </span>
                  <input
                    type="text"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#000000]"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {t('Profil / rôle', 'Profile / role')}
                  </span>
                  <input
                    type="text"
                    value={visitorRole}
                    onChange={(e) => setVisitorRole(e.target.value)}
                    placeholder={t('Prospect, famille…', 'Prospect, family…')}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#000000]"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  {t('Notes', 'Notes')}
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#000000] resize-y"
                />
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleAddVisit()}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[#000000] hover:border-[#D4AF37]/50 disabled:opacity-50"
              >
                {t('Enregistrer la visite', 'Save visit')}
              </button>
            </div>
          )}

          {entries.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-4 text-center border border-dashed border-slate-200 rounded-xl">
              {t('Aucune visite physique enregistrée.', 'No physical visits recorded yet.')}
            </p>
          ) : (
            <div className={inst.tableWrap}>
              <table className={inst.table}>
                <thead>
                  <tr>
                    <th className={inst.th}>{t('Date', 'Date')}</th>
                    <th className={inst.th}>{t('Visiteur', 'Visitor')}</th>
                    <th className={inst.th}>{t('Canal', 'Channel')}</th>
                    <th className={inst.th}>{t('Notes', 'Notes')}</th>
                    <th className={inst.thRight} />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const ch = CHANNEL_OPTIONS.find((c) => c.value === entry.channel);
                    return (
                      <tr key={entry.id} className={inst.tr}>
                        <td className="px-4 py-2.5 text-sm font-semibold text-[#000000] tabular-nums">
                          {new Date(entry.visitedAt).toLocaleDateString(
                            lang === 'fr' ? 'fr-CA' : 'en-CA'
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-[#000000]">
                          {entry.visitorName || '—'}
                          {entry.visitorRole && (
                            <span className="block text-[10px] text-slate-500">
                              {entry.visitorRole}
                            </span>
                          )}
                        </td>
                        <td className={inst.td}>
                          {ch ? (lang === 'fr' ? ch.fr : ch.en) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-600 max-w-xs truncate">
                          {entry.notes || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => void handleRemoveVisit(entry.id)}
                            disabled={saving}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50"
                            aria-label={t('Supprimer', 'Delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </InstitutionalSection>
  );
}
