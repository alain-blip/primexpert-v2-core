/**
 * Tour de contrôle — Finance (MRR, Cash-in, essai 45 j).
 * Rôle `admin_system` : KPIs complets. Rôle `admin` : liste + support, montants masqués.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { Wallet, TrendingUp, Banknote, CalendarDays, Gift, Sparkles, Lock, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  DEMO_SUBSCRIBERS,
  PLANS,
  PHONE_ADDON,
  TRIAL_DAYS_TOTAL,
  arrFromMrrCad,
  cashInForMonthCad,
  formatCad,
  formatTrialEndDate,
  getPlan,
  revenueByPlan,
  subscriberGiftValueMrrCad,
  subscriberInTrialDanger,
  subscriberNominalMrrCad,
  subscriberPaidMrrCad,
  totalGiftValueMrrCad,
  totalMrrCad,
  trialDaysRemaining,
  type BillingCycle,
  type Subscriber,
} from '../lib/subscriptionPricing';

function currentYearMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function showEssaiBadge(s: Subscriber): boolean {
  if (s.billingLifecycle === 'paying' && s.hasPaymentMethod) return false;
  const rem = trialDaysRemaining(s.trialStartDate);
  if (rem !== null && rem > 0) return true;
  return Boolean(s.trialStartDate) && s.billingLifecycle !== 'paying';
}

export function AdminSubscriptionsDashboard() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const locale = language === 'fr' ? 'fr' : 'en';
  const [chartLens, setChartLens] = useState<'monthly' | 'annual'>('monthly');
  const [filterDanger, setFilterDanger] = useState(false);

  const isFinanceSuper = profile?.role === 'admin_system';
  const ownerTrialLeft = trialDaysRemaining(profile?.trialStartDate);

  const yearMonth = useMemo(() => currentYearMonth(), []);

  const patchedDemo = useMemo(
    () =>
      DEMO_SUBSCRIBERS.map((s) => {
        if (s.billingCycle !== 'annual' || !s.annualLumpPaidOn) return s;
        if (s.id !== '1' && s.id !== '2' && s.id !== '3') return s;
        const day = s.annualLumpPaidOn.slice(8, 10) || '01';
        return { ...s, annualLumpPaidOn: `${yearMonth}-${day}` };
      }),
    [yearMonth]
  );

  const [rows, setRows] = useState<Subscriber[]>(patchedDemo);
  useEffect(() => {
    setRows(patchedDemo);
  }, [patchedDemo]);

  const filteredRows = useMemo(
    () => (filterDanger ? rows.filter((s) => subscriberInTrialDanger(s)) : rows),
    [rows, filterDanger]
  );

  const mrr = useMemo(() => totalMrrCad(rows), [rows]);
  const giftMrr = useMemo(() => totalGiftValueMrrCad(rows), [rows]);
  const arr = useMemo(() => arrFromMrrCad(mrr), [mrr]);
  const giftArr = useMemo(() => arrFromMrrCad(giftMrr), [giftMrr]);
  const cashIn = useMemo(() => cashInForMonthCad(rows, yearMonth), [rows, yearMonth]);
  const byPlan = useMemo(() => revenueByPlan(rows, chartLens), [rows, chartLens]);
  const maxBar = useMemo(() => Math.max(...byPlan.map((b) => b.valueCad), 1), [byPlan]);
  const dangerCount = useMemo(() => rows.filter((s) => subscriberInTrialDanger(s)).length, [rows]);

  const patchRow = (id: string, patch: Partial<Subscriber>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border-2 border-[#FACC15]/80 bg-gradient-to-r from-[#FACC15]/20 via-amber-400/15 to-[#FACC15]/20 px-4 py-4 shadow-[0_0_40px_rgba(250,204,21,0.12)] md:px-6">
        <p className="text-center text-[11px] font-black uppercase leading-snug tracking-[0.18em] text-[#FACC15] md:text-[12px] md:tracking-[0.22em]">
          {t(
            'Campagne : 45 jours d’essai gratuits — informez vos courtiers.',
            'Campaign: 45-day free trials — keep your brokers informed.'
          )}
        </p>
      </div>

      <div className="workhub-card rounded-[22px] border border-white/10 p-5 md:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 shrink-0 text-[#FACC15]" aria-hidden />
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#FACC15]">
                {t('Administration', 'Administration')}
              </p>
            </div>
            <h1 className="mt-1 text-2xl font-black uppercase italic tracking-tighter text-white md:text-3xl">
              {t('Tour de contrôle — Finance', 'Control tower — Finance')}
            </h1>
            <p className="mt-2 text-base font-black leading-snug text-[#FACC15] md:text-lg">
              {t(
                `${TRIAL_DAYS_TOTAL} jours d’essai gratuits pour tout nouveau compte.`,
                `${TRIAL_DAYS_TOTAL}-day free trial for every new account.`
              )}
            </p>
            {ownerTrialLeft !== null && ownerTrialLeft > 0 && (
              <p className="mt-2 text-sm font-black text-white">
                {t('Jours restants :', 'Days left:')}{' '}
                <span className="rounded-md bg-[#FACC15]/25 px-2 py-0.5 font-mono text-[#FACC15]">{ownerTrialLeft}</span>
              </p>
            )}
            <p className="mt-2 max-w-2xl text-[11px] font-semibold leading-relaxed text-white/85">
              {isFinanceSuper
                ? t(
                    'MRR payant : hors affiliés Prisma (0 $). Cash-in : encaissements réels du mois. Valeur offerte : équivalent catalogue des comptes exemptés.',
                    'Billable MRR: excludes Prisma affiliates ($0). Cash-in: actual monthly collections. Gift value: catalog equivalent for exempt accounts.'
                  )
                : t(
                    'Vue équipe : courtiers, essais et relances. Les montants agrégés (MRR, Cash-in) sont réservés à la direction (admin_system).',
                    'Team view: brokers, trials and follow-ups. Aggregated amounts (MRR, cash-in) are reserved for leadership (admin_system).'
                  )}
            </p>
          </div>

          {isFinanceSuper ? (
            <div
              className="flex shrink-0 flex-col gap-2 rounded-2xl border border-white/15 bg-black/35 p-1.5 sm:flex-row sm:items-center"
              role="group"
              aria-label={t('Vue graphiques mensuelle ou annualisée', 'Chart view: monthly or annualized')}
            >
              <span className="px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-500 sm:self-center">
                {t('Graphiques', 'Charts')}
              </span>
              <button
                type="button"
                onClick={() => setChartLens('monthly')}
                className={cn(
                  'rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] transition',
                  chartLens === 'monthly'
                    ? 'bg-blue-600 text-white shadow-[0_10px_28px_rgba(37,99,235,0.45)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                {t('Mensuel', 'Monthly')}
              </button>
              <button
                type="button"
                onClick={() => setChartLens('annual')}
                className={cn(
                  'rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] transition',
                  chartLens === 'annual'
                    ? 'bg-blue-600 text-white shadow-[0_10px_28px_rgba(37,99,235,0.45)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                {t('Annuel (ARR)', 'Annual (ARR)')}
              </button>
            </div>
          ) : null}
        </div>

        <p className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-bold text-white">
          <CalendarDays className="h-3.5 w-3.5 text-[#FACC15]" aria-hidden />
          {t('Période Cash-in :', 'Cash-in period:')}{' '}
          <span className="font-mono font-black text-white">{yearMonth}</span>
          <span className="text-slate-500">·</span>
          {t('Session :', 'Session:')}{' '}
          <span className="truncate font-semibold text-white">{profile?.displayName ?? '—'}</span>
          <span className="text-slate-500">·</span>
          <span className="rounded border border-white/20 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-300">
            {profile?.role ?? '—'}
          </span>
        </p>
      </div>

      {isFinanceSuper ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="workhub-card rounded-[22px] border border-emerald-500/25 bg-gradient-to-br from-slate-950/90 to-slate-900/80 p-6">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300">
                <TrendingUp className="h-4 w-4" />
                MRR {t('payant', 'billable')}
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white/90">
                {t('Hors affiliés Prisma', 'Excl. Prisma affiliates')}
              </p>
              <p className="mt-2 text-4xl font-black tabular-nums tracking-tight text-white sm:text-[2.5rem]">
                {formatCad(mrr, locale)}
              </p>
              <p className="mt-2 text-[10px] font-semibold text-white">
                {t('ARR payant :', 'Billable ARR:')}{' '}
                <span className="font-mono font-black text-white">{formatCad(arr, locale)}</span>
              </p>
            </div>

            <div className="workhub-card rounded-[22px] border-2 border-white/25 bg-slate-950/95 p-6 ring-1 ring-[#FACC15]/25">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-white">
                <Banknote className="h-4 w-4 text-[#FACC15]" />
                CASH-IN
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white">
                {t('Ce mois-ci (réel)', 'This month (actual)')}
              </p>
              <p className="mt-2 text-5xl font-black tabular-nums tracking-tight text-white sm:text-6xl">
                {formatCad(cashIn, locale)}
              </p>
              <p className="mt-2 text-[10px] font-semibold leading-snug text-white">
                {t('Affiliés exclus (0 $ encaissé).', 'Affiliates excluded ($0 collected).')}
              </p>
            </div>

            <div className="workhub-card rounded-[22px] border border-violet-500/35 bg-violet-950/30 p-6">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-violet-200">
                <Gift className="h-4 w-4 text-violet-300" />
                {t('Valeur offerte', 'Gift value')}
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white/90">
                {t('Affiliés Prisma (MRR)', 'Prisma affiliates (MRR)')}
              </p>
              <p className="mt-2 text-4xl font-black tabular-nums tracking-tight text-white sm:text-[2.5rem]">
                {formatCad(giftMrr, locale)}
                <span className="ml-1 text-[10px] font-black uppercase tracking-widest text-white/80">
                  /{t('mois', 'mo')}
                </span>
              </p>
              <p className="mt-2 text-[10px] font-semibold text-white">
                {t('Annualisé :', 'Annualized:')}{' '}
                <span className="font-mono font-black text-white">{formatCad(giftArr, locale)}</span>
              </p>
            </div>

            <div className="workhub-card rounded-[22px] border border-blue-500/25 p-6">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">
                <Wallet className="h-4 w-4" />
                {t('Répartition', 'Mix')}
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white/90">
                {chartLens === 'monthly'
                  ? t('MRR payant par forfait', 'Billable MRR by plan')
                  : t('ARR payant par forfait', 'Billable ARR by plan')}
              </p>
              <div className="mt-4 space-y-3">
                {byPlan.length === 0 ? (
                  <p className="text-[10px] text-slate-500">{t('Aucune donnée', 'No data')}</p>
                ) : (
                  byPlan.map((row) => (
                    <div key={row.plan}>
                      <div className="mb-1 flex justify-between text-[9px] font-black uppercase tracking-widest text-white">
                        <span>{locale === 'fr' ? row.labelFr : row.labelEn}</span>
                        <span className="font-mono text-white">{formatCad(row.valueCad, locale)}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-400"
                          style={{ width: `${(row.valueCad / maxBar) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="workhub-card rounded-[22px] border border-emerald-500/30 bg-emerald-950/20 p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-200">
                {t('Conversion essai → payant (mois en cours, démo)', 'Trial → paid conversions (this month, demo)')}
              </p>
              <p className="text-3xl font-black tabular-nums text-white">3</p>
            </div>
            <p className="mt-1 text-[9px] font-semibold text-white/70">
              {t(
                'Branchez Firestore + webhooks Stripe pour des chiffres réels. Réservé admin_system.',
                'Wire Firestore + Stripe webhooks for real numbers. admin_system only.'
              )}
            </p>
          </div>
        </>
      ) : (
        <div className="workhub-card rounded-[22px] border border-white/15 bg-black/40 p-8 text-center">
          <Lock className="mx-auto h-10 w-10 text-slate-500" aria-hidden />
          <p className="mt-4 text-lg font-black uppercase tracking-tight text-white">
            {t('Accès réservé à la direction', 'Access reserved for leadership')}
          </p>
          <p className="mx-auto mt-2 max-w-md text-[11px] font-semibold text-white/70">
            {t(
              'Les tuiles MRR, Cash-in et valeur offerte ne s’affichent pas pour les comptes admin standard.',
              'MRR, cash-in and gift KPI tiles are hidden for standard admin accounts.'
            )}
          </p>
        </div>
      )}

      <div className="workhub-card rounded-[22px] border border-violet-400/25 bg-violet-950/20 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />
          <p className="text-[11px] font-black uppercase tracking-widest text-violet-200">
            {t('Module exemptions agence', 'Agency exemption module')}
          </p>
        </div>
        <p className="mt-2 text-[10px] font-semibold leading-relaxed text-white/85">
          {t(
            'Case « Affilié Prisma » : MRR et Cash-in à 0 $, valeur cadeau affichée. Spécialités : déverrouillages manuels (Commercial, multi 5+) et zones Radar — sans changer le forfait catalogue.',
            '“Prisma affiliate” checkbox: MRR and cash-in at $0, gift value shown. Specialties: manual unlocks (commercial, multi > 5) and Radar zones — without changing the catalog plan.'
          )}
        </p>
      </div>

      <div className="workhub-card rounded-[22px] border border-white/10 p-5 md:p-6">
        <h2 className="text-lg font-black italic uppercase tracking-tight text-white">
          {t('Grille tarifaire', 'Price grid')}
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-white/15 text-[9px] font-black uppercase tracking-widest text-[#FACC15]">
                <th className="py-3 pr-4">{t('Forfait', 'Plan')}</th>
                <th className="py-3 pr-4">{t('Paiement unique (annuel)', 'One-time (annual)')}</th>
                <th className="py-3">{t('Mensuel', 'Monthly')}</th>
              </tr>
            </thead>
            <tbody className="text-white">
              {PLANS.map((p) => (
                <tr key={p.id} className="border-b border-white/10">
                  <td className="py-3 pr-4 font-black">{locale === 'fr' ? p.labelFr : p.labelEn}</td>
                  <td className="py-3 pr-4">
                    <span className="text-lg font-black tabular-nums text-white">{formatCad(p.annualLumpCad, locale)}</span>
                    <span className="ml-2 inline-block rounded border border-[#FACC15]/60 bg-[#FACC15]/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-[#FACC15]">
                      {t('Paiement unique', 'One-time')}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="text-base font-black tabular-nums text-white">{formatCad(p.monthlyRecurringCad, locale)}</span>
                    <span className="ml-2 text-[8px] font-black uppercase tracking-widest text-slate-400">
                      {t('Mensuel', 'Monthly')}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-b-0">
                <td className="py-3 pr-4 font-black text-sky-200">{t('Option Tél.', 'Phone add-on')}</td>
                <td className="py-3 pr-4 text-lg font-black text-white">
                  +{formatCad(PHONE_ADDON.annualLumpCad, locale)}
                </td>
                <td className="py-3 text-base font-black text-white">+{formatCad(PHONE_ADDON.monthlyRecurringCad, locale)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="workhub-card rounded-[22px] border border-white/10 p-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black italic uppercase tracking-tight text-white">
              {t('Abonnés (démo)', 'Subscribers (demo)')}
            </h2>
            <p className="mt-1 text-[10px] font-semibold text-white/70">
              {t(
                'Colonnes essai / relances : données Firestore (`trialStartDate`, relances). KPIs masqués pour admin standard.',
                'Trial / nurture columns: Firestore (`trialStartDate`, nurture). KPIs hidden for standard admin.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterDanger((v) => !v)}
              className={cn(
                'rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-widest transition',
                filterDanger
                  ? 'border-rose-400/80 bg-rose-500/20 text-rose-100'
                  : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/25 hover:text-white'
              )}
            >
              {filterDanger
                ? t(`En danger (${dangerCount}) — actif`, `At risk (${dangerCount}) — on`)
                : t('Filtre : en danger (J40+, sans carte)', 'Filter: at risk (day 40+, no card)')}
            </button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-white/15 text-[9px] font-black uppercase tracking-widest text-white">
                <th className="py-3 pr-2 text-left">{t('Nom', 'Name')}</th>
                <th className="py-3 pr-2 text-center">{t('Affilié', 'Affiliate')}</th>
                <th className="py-3 pr-2 text-left">{t('Forfait', 'Plan')}</th>
                <th className="py-3 pr-2 text-left">{t('Cycle', 'Cycle')}</th>
                <th className="py-3 pr-2 text-left">{t('Fin d’essai', 'Trial ends')}</th>
                <th className="py-3 pr-2 text-right">{t('J. rest.', 'Days left')}</th>
                <th className="py-3 pr-2 text-left">{t('Statut mail', 'Email status')}</th>
                <th className="py-3 pr-2 text-left">{t('Tél.', 'Phone')}</th>
                {isFinanceSuper ? (
                  <>
                    <th className="py-3 pr-2 text-right">{t('MRR payé', 'Billable MRR')}</th>
                    <th className="py-3 pr-2 text-right">{t('Valeur offerte', 'Gift /mo')}</th>
                    <th className="py-3 pr-2 text-left">{t('Spécialités', 'Specialties')}</th>
                    <th className="py-3 text-left">{t('Encaissement', 'Billing')}</th>
                  </>
                ) : (
                  <th className="py-3 text-left" colSpan={4}>
                    {t('Revenus (direction)', 'Revenue (leadership)')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((s) => {
                const plan = getPlan(s.plan);
                const paid = subscriberPaidMrrCad(s);
                const gift = subscriberGiftValueMrrCad(s);
                const nominal = subscriberNominalMrrCad(s);
                const lump = plan.annualLumpCad + (s.phoneOption ? PHONE_ADDON.annualLumpCad : 0);
                const monthly = plan.monthlyRecurringCad + (s.phoneOption ? PHONE_ADDON.monthlyRecurringCad : 0);
                const affiliated = Boolean(s.isAffiliated);
                const daysLeft = trialDaysRemaining(s.trialStartDate);
                return (
                  <tr
                    key={s.id}
                    className={cn(
                      'border-b border-white/10 text-white',
                      affiliated && 'bg-violet-950/35 ring-1 ring-inset ring-violet-500/25',
                      subscriberInTrialDanger(s) && 'bg-rose-950/20'
                    )}
                  >
                    <td className="py-3.5 pr-2 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-bold leading-tight">{s.displayName}</span>
                        <div className="flex flex-wrap gap-1">
                          {showEssaiBadge(s) && (
                            <span className="inline-flex w-fit items-center rounded-md border border-[#FACC15]/70 bg-[#FACC15]/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-[#FACC15]">
                              {t('Essai : 45 j', 'Trial: 45 d')}
                            </span>
                          )}
                          {affiliated && (
                            <span className="inline-flex w-fit items-center gap-1 rounded-md border border-violet-400/50 bg-violet-600/25 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-violet-100">
                              <Sparkles className="h-3 w-3" aria-hidden />
                              {s.affiliateAgencyLabel ?? 'Prisma'}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-2 text-center align-top">
                      <input
                        type="checkbox"
                        checked={affiliated}
                        onChange={(e) => patchRow(s.id, { isAffiliated: e.target.checked })}
                        className="h-4 w-4 rounded border-violet-400/60 text-violet-600 focus:ring-violet-500"
                        aria-label={t('Affilié Prisma Agence (exempté)', 'Prisma agency affiliate (exempt)')}
                      />
                    </td>
                    <td className="py-3.5 pr-2 align-top">
                      <span
                        className={cn(
                          'inline-block rounded-lg border-2 px-2.5 py-1 text-[10px] font-black uppercase tracking-tight',
                          plan.badgeClass,
                          'bg-black/30 text-white'
                        )}
                      >
                        {locale === 'fr' ? plan.labelFr : plan.labelEn}
                      </span>
                    </td>
                    <td className="py-3.5 pr-2 align-top">
                      <CycleBadge cycle={s.billingCycle} t={t} />
                    </td>
                    <td className="py-3.5 pr-2 align-top font-mono text-[11px] font-bold text-white/90">
                      {formatTrialEndDate(s.trialStartDate, locale)}
                    </td>
                    <td className="py-3.5 pr-2 text-right align-top font-mono text-[11px] font-black text-white">
                      {daysLeft === null ? '—' : daysLeft < 0 ? t('Terminé', 'Ended') : daysLeft}
                    </td>
                    <td className="py-3.5 pr-2 align-top text-[10px] font-semibold text-slate-300">
                      {s.lastNurtureEmailSent ?? '—'}
                    </td>
                    <td className="py-3.5 pr-2 align-top text-[11px] font-semibold">
                      {affiliated && s.phoneGifted ? (
                        <span className="text-violet-200">{t('Offert', 'Gift')}</span>
                      ) : s.phoneOption ? (
                        '✓'
                      ) : (
                        '—'
                      )}
                    </td>
                    {isFinanceSuper ? (
                      <>
                        <td className="py-3.5 pr-2 text-right align-top font-mono text-base font-black text-white">
                          {affiliated ? (
                            <span className="text-violet-200/90">{formatCad(0, locale)}</span>
                          ) : (
                            formatCad(paid, locale)
                          )}
                        </td>
                        <td className="py-3.5 pr-2 text-right align-top font-mono text-sm font-black text-white">
                          {gift > 0 ? formatCad(gift, locale) : '—'}
                        </td>
                        <td className="py-3.5 pr-2 align-top">
                          <SpecialtiesCell s={s} onPatch={(patch) => patchRow(s.id, patch)} t={t} />
                        </td>
                        <td className="py-3.5 align-top">
                          {affiliated ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-black uppercase tracking-wide text-violet-200">
                                {t('OFFERT', 'COMPLIMENTARY')}
                              </span>
                              <span className="text-[9px] font-semibold text-white/70">
                                {t('Équiv.', 'Equiv.')}{' '}
                                <span className="font-mono text-white">{formatCad(nominal, locale)}</span>/
                                {t('mois', 'mo')}
                              </span>
                            </div>
                          ) : s.billingCycle === 'annual' ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-sm font-black text-white">{formatCad(lump, locale)}</span>
                              {s.annualLumpPaidOn?.startsWith(yearMonth) ? (
                                <span className="w-fit rounded border border-[#FACC15]/70 bg-[#FACC15]/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-[#FACC15]">
                                  {t('Encaissé ce mois', 'Collected this month')}
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                  {t('Paiement unique', 'One-time')} · {s.annualLumpPaidOn ?? '—'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                {t('Mensuel', 'Monthly')}
                              </span>
                              <span className="font-mono text-sm font-black text-white">{formatCad(monthly, locale)}</span>
                            </div>
                          )}
                        </td>
                      </>
                    ) : (
                      <td className="py-3.5 align-middle text-[10px] font-bold text-slate-500" colSpan={4}>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-slate-400">
                          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {t('Accès réservé à la direction', 'Access reserved for leadership')}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CycleBadge({ cycle, t }: { cycle: BillingCycle; t: (fr: string, en: string) => string }) {
  const isAnnual = cycle === 'annual';
  return (
    <span
      className={cn(
        'inline-block rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest',
        isAnnual ? 'border border-[#FACC15]/60 bg-[#FACC15]/12 text-[#FACC15]' : 'border border-white/20 bg-white/5 text-white'
      )}
    >
      {isAnnual ? t('Annuel', 'Annual') : t('Mensuel', 'Monthly')}
    </span>
  );
}

function SpecialtiesCell({
  s,
  onPatch,
  t,
}: {
  s: Subscriber;
  onPatch: (patch: Partial<Subscriber>) => void;
  t: (fr: string, en: string) => string;
}) {
  const affiliated = Boolean(s.isAffiliated);
  return (
    <div className="flex max-w-[220px] flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {s.manualUnlockCommercial && (
          <span className="rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-amber-100">
            {t('Commercial', 'Commercial')}
          </span>
        )}
        {s.manualUnlockMultiOver5 && (
          <span className="rounded border border-sky-400/40 bg-sky-500/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-sky-100">
            {t('Multi 5+', 'Multi 5+')}
          </span>
        )}
        {(s.radarZones ?? []).map((z) => (
          <span key={z} className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[8px] font-bold text-slate-200">
            {z}
          </span>
        ))}
      </div>
      {affiliated && (
        <div className="flex flex-col gap-1 border-t border-white/10 pt-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
          <label className="flex cursor-pointer items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(s.manualUnlockCommercial)}
              onChange={(e) => onPatch({ manualUnlockCommercial: e.target.checked })}
              className="h-3 w-3 rounded"
            />
            {t('Commercial', 'Commercial')}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(s.manualUnlockMultiOver5)}
              onChange={(e) => onPatch({ manualUnlockMultiOver5: e.target.checked })}
              className="h-3 w-3 rounded"
            />
            {t('Multi 5+', 'Multi 5+')}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(s.phoneGifted)}
              onChange={(e) => onPatch({ phoneGifted: e.target.checked })}
              className="h-3 w-3 rounded"
            />
            {t('Tél. offert', 'Phone gifted')}
          </label>
        </div>
      )}
    </div>
  );
}
