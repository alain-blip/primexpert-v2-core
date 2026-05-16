/**
 * Bandeau 72 h — billingStatus === grace_period (accès conservé, avertissement).
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { openStripeCustomerPortal } from '../lib/stripePortal';

export function GracePeriodBanner() {
  const { t } = useLanguage();

  return (
    <div
      role="alert"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/50 bg-amber-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#FACC15]" aria-hidden />
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#FACC15]">
            {t('Paiement en attente — 72 h de grâce', 'Payment pending — 72 h grace period')}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-amber-100/90">
            {t(
              'Votre dernier prélèvement a échoué. Mettez à jour votre carte avant la fin du délai pour éviter la suspension du Radar.',
              'Your last charge failed. Update your card before the grace period ends to avoid Radar suspension.'
            )}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => openStripeCustomerPortal()}
        className="shrink-0 rounded-lg border border-[#FACC15]/60 bg-[#FACC15]/15 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[#FACC15] transition hover:bg-[#FACC15]/25"
      >
        {t('Mettre à jour ma carte', 'Update my card')}
      </button>
    </div>
  );
}
