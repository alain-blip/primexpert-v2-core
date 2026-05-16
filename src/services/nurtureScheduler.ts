import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../lib/auth';
import { buildJ21BrokerEmail } from '../config/nurtureEmailTemplates';
import { sendEmailPayload } from './nurtureEmailService';
import { shouldSendJ21Email } from '../lib/trialTimeline';
import { userContactFields } from '../lib/userProfileHelpers';
import type { NurtureEmailSent } from '../types/billing';

/** Déclenche le courriel J21 si le courtier a atteint J+21 et ne l'a pas encore reçu. */
export async function maybeSendJ21NurtureEmail(
  profile: UserProfile,
  locale: 'fr' | 'en' = 'fr'
): Promise<boolean> {
  if (profile.role === 'admin_system') return false;
  if (!shouldSendJ21Email(profile.trialStartDate, profile.lastEmailSent)) return false;

  const { firstName } = userContactFields(profile);
  const payload = buildJ21BrokerEmail(firstName, locale);
  payload.to = profile.email;

  await sendEmailPayload(profile.uid, 'j21_broker_nurture', payload);
  await updateDoc(doc(db, 'users', profile.uid), {
    lastEmailSent: 'J21' as NurtureEmailSent,
  });

  return true;
}
