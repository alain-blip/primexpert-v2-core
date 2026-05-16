import { J7_OPTION_LABELS, type J7SurveyOption } from '../types/nurture';
import type { UserContactFields } from '../lib/userProfileHelpers';

export interface EmailPayload {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
}

/** Alerte interne support — sondage J7 options B ou C. */
export function buildJ7SupportAlertEmail(
  contact: UserContactFields,
  option: J7SurveyOption,
  comment: string,
  locale: 'fr' | 'en' = 'fr'
): EmailPayload {
  const L = locale === 'fr';
  const optionLabel = L ? J7_OPTION_LABELS[option].fr : J7_OPTION_LABELS[option].en;
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—';
  const commentBlock = comment.trim()
    ? `"${comment.trim()}"`
    : L
      ? '(aucun commentaire)'
      : '(no comment)';

  const subject = `🚨 [SUIVI REQUIS - J7] Client en difficulté : ${fullName}`;

  const textBody = [
    L ? 'Alerte Suivi Client — Primexpert' : 'Client follow-up alert — Primexpert',
    '',
    L
      ? "L'utilisateur suivant a complété son sondage J7 et requiert une assistance immédiate :"
      : 'The following user completed the J7 survey and needs immediate assistance:',
    '',
    `${L ? 'Nom du courtier' : 'Broker name'}: ${fullName}`,
    `${L ? 'Option choisie' : 'Selected option'}: ${optionLabel}`,
    `${L ? 'Commentaire' : 'Comment'}: ${commentBlock}`,
    '',
    L ? 'Coordonnées pour le contact :' : 'Contact details:',
    `${L ? 'Téléphone' : 'Phone'}: ${contact.phone}`,
    `${L ? 'Courriel' : 'Email'}: ${contact.email}`,
    `${L ? 'Agence immobilière' : 'Agency'}: ${contact.agency}`,
    '',
    L
      ? 'Action requise : effectuer un suivi téléphonique ou par courriel dans les 4 prochaines heures.'
      : 'Required action: follow up by phone or email within the next 4 hours.',
  ].join('\n');

  const htmlBody = `
<div style="font-family:sans-serif;max-width:640px;color:#111">
  <h2 style="color:#b91c1c">${L ? 'Alerte Suivi Client — Primexpert' : 'Client follow-up alert — Primexpert'}</h2>
  <p>${L ? "L'utilisateur suivant a complété son sondage <strong>J7</strong> et requiert une assistance immédiate :" : 'The following user completed the <strong>J7</strong> survey and needs immediate assistance:'}</p>
  <ul>
    <li><strong>${L ? 'Nom' : 'Name'}:</strong> ${fullName}</li>
    <li><strong>${L ? 'Option' : 'Option'}:</strong> ${optionLabel}</li>
    <li><strong>${L ? 'Commentaire' : 'Comment'}:</strong> <em>${commentBlock}</em></li>
  </ul>
  <h3>${L ? 'Coordonnées' : 'Contact'}</h3>
  <ul>
    <li><strong>${L ? 'Téléphone' : 'Phone'}:</strong> ${contact.phone}</li>
    <li><strong>${L ? 'Courriel' : 'Email'}:</strong> ${contact.email}</li>
    <li><strong>${L ? 'Agence' : 'Agency'}:</strong> ${contact.agency}</li>
  </ul>
  <p style="margin-top:24px;padding:12px;background:#fef3c7;border-left:4px solid #f59e0b">
    ${L ? '<strong>Action requise :</strong> suivi dans les 4 prochaines heures.' : '<strong>Action required:</strong> follow up within 4 hours.'}
  </p>
</div>`;

  return { to: '', subject, textBody, htmlBody };
}

/** Courriel courtier J21 — optimisation CMA / Radar. */
export function buildJ21BrokerEmail(firstName: string, locale: 'fr' | 'en' = 'fr'): EmailPayload {
  const L = locale === 'fr';
  const greeting = firstName.trim()
    ? L
      ? `Bonjour ${firstName},`
      : `Hello ${firstName},`
    : L
      ? 'Bonjour,'
      : 'Hello,';

  const subject = L
    ? "Comment optimiser vos présentations d'analyse de marché à vos clients ? 📊"
    : 'How to optimize your market analysis presentations for clients? 📊';

  const textBody = [
    greeting,
    '',
    L
      ? "En tant que courtier performant, vous savez qu'une analyse comparative de marché (CMA) percutante fait toute la différence lors d'un rendez-vous d'inscription."
      : 'As a high-performing broker, you know a sharp comparative market analysis (CMA) makes all the difference at a listing appointment.',
    '',
    L
      ? 'Le Radar Primexpert compile des données historiques précieuses qui peuvent transformer votre prochaine présentation. Voici comment maximiser l\'impact de vos rapports :'
      : 'Primexpert Radar compiles valuable historical data that can transform your next presentation. Here is how to maximize your report impact:',
    '',
    '1. ' +
      (L
        ? "L'historique des baisses de prix : montrez à votre client à quel rythme les propriétés similaires ont dû ajuster leur prix."
        : 'Price reduction history: show your client how similar properties had to adjust their price.'),
    '2. ' +
      (L
        ? 'Le temps de rétention du marché : fixez des attentes réalistes sur le délai de vente (Plex, commercial).'
        : 'Market retention time: set realistic expectations on time to sell (plex, commercial).'),
    '3. ' +
      (L
        ? "Les données hors-marché exclusives : des comparables que les autres courtiers n'ont pas vus dans l'historique Radar."
        : 'Exclusive off-market data: comparables other brokers have not seen in Radar history.'),
    '',
    L ? "Besoin d'intégrer ces graphiques à votre présentation ?" : 'Need to add these charts to your presentation?',
    L
      ? 'Allez dans votre Radar, exportez la fiche sectorielle en un clic et ajoutez-la à votre document client.'
      : 'Open your Radar, export the sector sheet in one click, and add it to your client document.',
    '',
    L ? 'Continuez votre excellent travail !' : 'Keep up the great work!',
    L ? "L'équipe Primexpert" : 'The Primexpert team',
  ].join('\n');

  const htmlBody = `
<div style="font-family:sans-serif;max-width:640px;line-height:1.6;color:#111">
  <p>${greeting}</p>
  <p>${L ? "En tant que courtier performant, vous savez qu'une <strong>analyse comparative de marché (CMA)</strong> percutante fait toute la différence lors d'un rendez-vous d'inscription." : 'As a high-performing broker, you know a sharp <strong>CMA</strong> makes all the difference at a listing appointment.'}</p>
  <p>${L ? 'Le <strong>Radar Primexpert</strong> compile des données historiques précieuses. Voici comment maximiser l\'impact de vos rapports :' : '<strong>Primexpert Radar</strong> compiles valuable historical data. Maximize your report impact:'}</p>
  <ol>
    <li>${L ? "<strong>Historique des baisses de prix</strong> — rythme d'ajustement sur le territoire." : '<strong>Price reduction history</strong> — adjustment pace in the territory.'}</li>
    <li>${L ? '<strong>Temps de rétention du marché</strong> — délais réalistes (Plex, commercial).' : '<strong>Market retention</strong> — realistic timelines (plex, commercial).'}</li>
    <li>${L ? '<strong>Données hors-marché exclusives</strong> — comparables archivés dans le Radar.' : '<strong>Exclusive off-market data</strong> — archived Radar comparables.'}</li>
  </ol>
  <p><strong>${L ? "Besoin d'intégrer ces graphiques ?" : 'Need these charts in your deck?'}</strong><br/>
  ${L ? 'Radar → export fiche sectorielle → document client.' : 'Radar → export sector sheet → client document.'}</p>
  <p>${L ? 'Continuez votre excellent travail !<br/><strong>L\'équipe Primexpert</strong>' : 'Keep up the great work!<br/><strong>The Primexpert team</strong>'}</p>
</div>`;

  return { to: '', subject, textBody, htmlBody };
}
