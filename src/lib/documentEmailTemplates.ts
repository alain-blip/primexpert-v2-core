/** Modèles courriel — sélection documentaire Prime-Mail (FR / EN). */

export type DocumentEmailTargetRole = 'buyer' | 'notary' | 'banker' | 'custom';

export interface DocumentEmailTemplate {
  subject: string;
  message: string;
}

function propertyRef(label: string | undefined, locale: 'fr' | 'en'): string {
  const trimmed = label?.trim();
  if (trimmed) return trimmed;
  return locale === 'fr' ? 'cette inscription' : 'this listing';
}

export function buildDocumentEmailTemplate(
  role: DocumentEmailTargetRole,
  locale: 'fr' | 'en',
  contextLabel?: string
): DocumentEmailTemplate {
  const ref = propertyRef(contextLabel, locale);

  if (locale === 'fr') {
    switch (role) {
      case 'notary':
        return {
          subject: `Diligence raisonnable — ${ref}`,
          message: `Bonjour,

Veuillez trouver ci-dessous les documents de diligence raisonnable concernant la propriété ${ref}.

Les liens Prime-Drive sont disponibles de façon sécurisée pour une période de 21 jours. N'hésitez pas à me signaler tout document manquant.

Cordialement,`,
        };
      case 'banker':
        return {
          subject: `Dossier financement — ${ref}`,
          message: `Bonjour,

Conformément à votre demande, veuillez accéder aux pièces justificatives sélectionnées pour l'analyse de financement relative à ${ref}.

Les liens de téléchargement Prime-Drive sont disponibles de façon sécurisée pour une période de 21 jours.

Cordialement,`,
        };
      case 'buyer':
        return {
          subject: `Documents sélectionnés — ${ref}`,
          message: `Bonjour,

Conformément à notre échange, veuillez consulter les documents sélectionnés concernant ${ref}.

Les liens Prime-Drive sont disponibles de façon sécurisée pour une période de 21 jours. Je demeure disponible pour toute question.

Cordialement,`,
        };
      default:
        return {
          subject: `Transmission documentaire — ${ref}`,
          message: `Bonjour,

Veuillez trouver ci-dessous les documents sélectionnés via PrimeXpert.

Les liens Prime-Drive sont disponibles de façon sécurisée pour une période de 21 jours.

Cordialement,`,
        };
    }
  }

  switch (role) {
    case 'notary':
      return {
        subject: `Due diligence package — ${ref}`,
        message: `Hello,

Please find below the due diligence documents for ${ref}.

Prime-Drive links are secure and available for 21 days. Let me know if anything is missing.

Best regards,`,
      };
    case 'banker':
      return {
        subject: `Financing package — ${ref}`,
        message: `Hello,

As requested, please access the selected supporting documents for the financing review of ${ref}.

Prime-Drive download links are secure and available for 21 days.

Best regards,`,
      };
    case 'buyer':
      return {
        subject: `Selected documents — ${ref}`,
        message: `Hello,

Following our conversation, please review the selected documents for ${ref}.

Prime-Drive links are secure and available for 21 days. I remain available for any questions.

Best regards,`,
      };
    default:
      return {
        subject: `Document package — ${ref}`,
        message: `Hello,

Please find the selected documents shared via PrimeXpert below.

Prime-Drive links are secure and available for 21 days.

Best regards,`,
      };
  }
}
