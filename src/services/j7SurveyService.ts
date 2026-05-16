import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../lib/auth';
import { userContactFields } from '../lib/userProfileHelpers';
import { buildJ7SupportAlertEmail } from '../config/nurtureEmailTemplates';
import { sendEmailPayload, getSupportEmail } from './nurtureEmailService';
import type { J7SurveyOption } from '../types/nurture';
import type { NurtureEmailSent } from '../types/billing';

export interface SubmitJ7SurveyInput {
  option: J7SurveyOption;
  comment?: string;
}

export async function submitJ7Survey(
  profile: UserProfile,
  input: SubmitJ7SurveyInput,
  locale: 'fr' | 'en' = 'fr'
): Promise<void> {
  const submittedAt = new Date().toISOString();
  const j7Survey = {
    option: input.option,
    comment: input.comment?.trim() || '',
    submittedAt,
  };

  await updateDoc(doc(db, 'users', profile.uid), {
    j7Survey,
    lastEmailSent: 'J7' as NurtureEmailSent,
  });

  if (input.option === 'B' || input.option === 'C') {
    const contact = userContactFields(profile);
    const payload = buildJ7SupportAlertEmail(contact, input.option, j7Survey.comment, locale);
    payload.to = getSupportEmail();
    await sendEmailPayload(profile.uid, 'j7_support_alert', payload);
  }
}
