import React from 'react';
import { ScopedDocumentManager } from './documents/ScopedDocumentManager';
import { useLanguage } from '../lib/i18n';

export function BrokerToolsDocuments() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-blue-200/70">
          {t('Drive officiel PrimeXpert', 'Official PrimeXpert Drive')}
        </p>
        <h1 className="mt-2 text-4xl font-black italic uppercase tracking-tighter text-white">
          {t('Mes Documents Professionnels', 'My Professional Documents')}
        </h1>
        <p className="mt-2 max-w-2xl text-[12px] font-semibold text-slate-500">
          {t(
            'Boîte à outils personnelle du courtier : modèles, grilles, présentations et formulaires, triés par ordre alphabétique.',
            'Broker personal toolkit: templates, grids, presentations and forms, sorted alphabetically.'
          )}
        </p>
      </div>

      <ScopedDocumentManager
        scope="broker_tools"
        title={t('Boîte à outils du courtier', 'Broker toolkit')}
        subtitle={t(
          'Ces fichiers ne sont pas liés à une inscription ou à un contact.',
          'These files are not attached to a listing or contact.'
        )}
      />
    </div>
  );
}
