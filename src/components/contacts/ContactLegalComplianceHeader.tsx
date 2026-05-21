/**
 * En-tête de conformité — registre vérification légale (OACIQ art. 30).
 */

import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import {
  resolveContactLegalCompliance,
  type OrganizationContact,
} from '@primexpert/core/crm';

export interface ContactLegalComplianceHeaderProps {
  contact: Partial<OrganizationContact>;
  className?: string;
}

export function ContactLegalComplianceHeader({
  contact,
  className,
}: ContactLegalComplianceHeaderProps) {
  const { t } = useLanguage();
  const { status } = resolveContactLegalCompliance(contact);

  if (status === 'conform') {
    return (
      <div
        role="status"
        className={cn(
          'rounded-xl border-4 border-black bg-emerald-600 px-5 py-5 text-center shadow-md',
          className
        )}
      >
        <p className="text-xl sm:text-2xl font-black text-white leading-snug">
          ✅ {t('Vérification d’identité conforme', 'Identity verification compliant')}
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl border-4 border-black bg-slate-200 px-5 py-5 text-center shadow-md',
        className
      )}
    >
      <p className="text-xl sm:text-2xl font-black text-red-800 leading-snug">
        ⚠️{' '}
        {t(
          'Profil incomplet — Vérification légale requise',
          'Incomplete profile — Legal verification required'
        )}
      </p>
    </div>
  );
}
