/**
 * Assistant conseil — photo de permis > 5 ans (1826 jours, indicatif OACIQ).
 * Notification fluide : n'interdit aucune action payante.
 */

import React from 'react';
import { Info } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export function BrokerPhotoComplianceBanner() {
  const { t } = useLanguage();

  const message = t(
    '💡 Notification de conformité : Votre photo d\'identification de permis a atteint la limite indicative de 5 ans recommandée par l\'OACIQ. Pensez à la rafraîchir dans vos paramètres pour optimiser vos fiches descriptives.',
    '💡 Compliance notice: Your license identification photo has reached the 5-year indicative limit recommended by OACIQ. Consider refreshing it in your settings to optimize your listing sheets.'
  );

  return (
    <div
      role="status"
      className="w-full border-b border-slate-200/80 bg-slate-100/95 px-4 py-2.5 text-slate-800 backdrop-blur-sm"
    >
      <p className="mx-auto flex max-w-5xl items-start justify-center gap-2 text-center text-[11px] font-medium leading-snug sm:text-[12px] sm:leading-relaxed">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
        <span>{message}</span>
      </p>
    </div>
  );
}
