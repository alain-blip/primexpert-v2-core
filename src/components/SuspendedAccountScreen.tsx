/**
 * Écran de blocage « Chérif » — billingStatus === suspended.
 * Masque tout le Workhub ; action unique vers le portail Stripe.
 */

import React, { useState } from 'react';
import { ShieldAlert, CreditCard, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { openStripeCustomerPortal, isStripePortalConfigured } from '../lib/stripePortal';

export function SuspendedAccountScreen() {
  const { profile, logOut } = useAuth();
  const { t } = useLanguage();
  const [portalHint, setPortalHint] = useState(false);

  const handleUpdateCard = () => {
    const opened = openStripeCustomerPortal();
    if (!opened) setPortalHint(true);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0a0a0c]">
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-6 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-950/50">
          <ShieldAlert className="h-8 w-8 text-rose-400" aria-hidden />
        </div>

        <h1 className="text-2xl font-black uppercase italic tracking-tight text-white md:text-3xl">
          {t('Accès temporairement suspendu', 'Access temporarily suspended')}
        </h1>

        <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-300">
          {t(
            "Votre abonnement n'a pas pu être renouvelé. Pour récupérer l'accès instantané à vos radars de prospection, veuillez mettre à jour votre mode de paiement.",
            'Your subscription could not be renewed. To restore instant access to your prospecting radars, please update your payment method.'
          )}
        </p>

        {profile?.email ? (
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">{profile.email}</p>
        ) : null}

        <button
          type="button"
          onClick={handleUpdateCard}
          className="mt-8 flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border-2 border-[#FACC15] bg-[#FACC15]/10 px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-[#FACC15] shadow-[0_0_40px_rgba(250,204,21,0.15)] transition hover:bg-[#FACC15]/20"
        >
          <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
          {t('Mettre à jour ma carte', 'Update my card')}
        </button>

        {portalHint ? (
          <p className="mt-4 text-[10px] font-semibold text-amber-200/90">
            {t(
              'Portail Stripe non configuré (VITE_STRIPE_CUSTOMER_PORTAL_URL). Contactez le support Primexpert.',
              'Stripe portal not configured (VITE_STRIPE_CUSTOMER_PORTAL_URL). Contact Primexpert support.'
            )}
          </p>
        ) : !isStripePortalConfigured() ? (
          <p className="mt-3 text-[9px] text-slate-500">
            {t('Mode sandbox : portail à brancher.', 'Sandbox mode: portal pending.')}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => logOut()}
          className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          {t('Déconnexion', 'Sign out')}
        </button>
      </div>
    </div>
  );
}
